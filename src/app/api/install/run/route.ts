import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { upsertProjectEnvs } from "@/lib/installer/vercel";
import { resolveSupabaseDbUrl, extractProjectRefFromUrl } from "@/lib/installer/supabase";

export const maxDuration = 300;

const schemaSql = `
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "SystemSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "gtmId" TEXT,
  "openingTime" TEXT NOT NULL DEFAULT '09:00',
  "closingTime" TEXT NOT NULL DEFAULT '19:00',
  "adminPassword" TEXT NOT NULL DEFAULT 'admin123',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Barber" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "openingTime" TEXT NOT NULL DEFAULT '09:00',
  "closingTime" TEXT NOT NULL DEFAULT '19:00',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Service" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "duration" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT NOT NULL,
  "clientPhone" TEXT NOT NULL,
  "dateTime" TIMESTAMP(3) NOT NULL,
  "serviceId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "googleEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "_BarberServices" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_BarberServices_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Barber_email_key" ON "Barber"("email");
CREATE INDEX IF NOT EXISTS "_BarberServices_B_index" ON "_BarberServices"("B");

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "_BarberServices" ADD CONSTRAINT "_BarberServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "_BarberServices" ADD CONSTRAINT "_BarberServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

function createPool(databaseUrl: string) {
  // Remove parametros de query string da URL para evitar conflitos no analisador nativo do pg,
  // e define explicitamente a configuracao SSL com rejectUnauthorized: false para conexoes Supabase ou seguras.
  const cleanUrl = databaseUrl.split("?")[0];
  const hasSsl = databaseUrl.includes("sslmode=require") || 
                 databaseUrl.includes("ssl=true") || 
                 databaseUrl.includes("supabase.co") || 
                 databaseUrl.includes("supabase.com");

  return new Pool({
    connectionString: cleanUrl,
    ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
}

async function applySchema(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  try {
    await pool.query(schemaSql);
  } finally {
    await pool.end();
  }
}

async function seedInitialData(databaseUrl: string, adminPassword: string, gtmId?: string | null) {
  const pool = createPool(databaseUrl);
  const services = [
    { name: "Corte de Cabelo Masculino", price: 45.0, duration: 30 },
    { name: "Barba Completa", price: 30.0, duration: 30 },
    { name: "Combo Corte + Barba", price: 70.0, duration: 60 },
    { name: "Sobrancelha na Navalha", price: 15.0, duration: 15 },
  ];

  try {
    await pool.query(
      `INSERT INTO "SystemSettings" ("id", "gtmId", "openingTime", "closingTime", "adminPassword", "updatedAt")
       VALUES ('default', $1, '09:00', '19:00', $2, NOW())
       ON CONFLICT ("id") DO UPDATE SET "gtmId" = EXCLUDED."gtmId", "adminPassword" = EXCLUDED."adminPassword", "updatedAt" = NOW()`,
      [gtmId || null, adminPassword]
    );

    for (const service of services) {
      await pool.query(
        `INSERT INTO "Service" ("id", "name", "price", "duration", "createdAt", "updatedAt")
         SELECT $1, $2, $3, $4, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM "Service" WHERE "name" = $2)`,
        [randomUUID(), service.name, service.price, service.duration]
      );
    }
  } finally {
    await pool.end();
  }
}

export async function POST(req: Request) {
  const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    // Desativa a validação estrita temporariamente para a migração inicial do banco
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const rawData = await req.json().catch(() => null);
    if (!rawData) {
      return NextResponse.json({ success: false, error: "Corpo da requisicao invalido" }, { status: 400 });
    }

    const {
      databaseUrl,
      supabaseToken,
      supabaseUrl,
      dbPass,
      vercelToken,
      vercelProjectId,
      nextPublicAppUrl,
      adminPassword,
      gtmId,
    } = rawData;

    const steps: Array<{ id: string; status: string; message: string }> = [];

    // Resolve DATABASE_URL
    let resolvedDbUrl = databaseUrl?.trim();
    let dbUrlCandidates: Array<{ label: string; url: string; host?: string }> = resolvedDbUrl
      ? [{ label: "manual", url: resolvedDbUrl }]
      : [];

    if (!resolvedDbUrl && supabaseToken && supabaseUrl) {
      steps.push({ id: "supabase_resolve", status: "running", message: "Resolvendo DATABASE_URL via Supabase API..." });
      try {
        const projectRef = extractProjectRefFromUrl(supabaseUrl);
        if (!projectRef) {
          return NextResponse.json({
            success: false,
            steps,
            error: "Nao foi possivel extrair o Project Ref da URL do Supabase.",
          }, { status: 400 });
        }

        const dbResult = await resolveSupabaseDbUrl(supabaseToken, projectRef, dbPass);
        if (!dbResult.ok) {
          return NextResponse.json({
            success: false,
            steps,
            error: dbResult.error,
          }, { status: 400 });
        }

        dbUrlCandidates = Array.isArray(dbResult.dbUrls)
          ? dbResult.dbUrls.filter((c: any) => typeof c?.url === "string" && c.url.trim())
          : [];
        if (dbUrlCandidates.length === 0 && typeof dbResult.dbUrl === "string" && dbResult.dbUrl.trim()) {
          dbUrlCandidates = [{ label: "supabase", url: dbResult.dbUrl, host: dbResult.host }];
        }
        resolvedDbUrl = dbUrlCandidates[0]?.url;
        steps.push({ id: "supabase_resolve", status: "ok", message: `DATABASE_URL resolvida (host: ${dbResult.host}).` });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          steps,
          error: `Erro ao resolver DATABASE_URL: ${err.message}`,
        }, { status: 500 });
      }
    }

    if (!resolvedDbUrl) {
      return NextResponse.json({
        success: false,
        steps,
        error: "A URL de banco do Supabase e obrigatoria. Forneca DATABASE_URL ou Supabase Token + URL.",
      }, { status: 400 });
    }

    // 1. Aplicar schema diretamente. Executar `npx prisma db push` dentro da
    // Vercel e fragil porque o runtime serverless nao e um ambiente de CLI.
    steps.push({ id: "prisma_push", status: "running", message: "Aplicando schema no banco..." });
    const schemaErrors: string[] = [];
    try {
      let applied = false;
      for (const candidate of dbUrlCandidates) {
        try {
          await applySchema(candidate.url);
          resolvedDbUrl = candidate.url;
          process.env.DATABASE_URL = resolvedDbUrl;
          steps.push({ id: "prisma_push", status: "ok", message: `Schema aplicado (${candidate.label}).` });
          applied = true;
          break;
        } catch (err: any) {
          schemaErrors.push(`${candidate.label}${candidate.host ? ` ${candidate.host}` : ""}: ${String(err.message || err)}`);
        }
      }
      if (!applied) throw new Error(schemaErrors.join(" | "));
    } catch (pushError: any) {
      const errMessage = schemaErrors.join(" | ");
      
      // Erro clássico de host não encontrado (ENOTFOUND)
      const isDnsError = errMessage.includes("ENOTFOUND") && 
                         (errMessage.includes("supabase.co") || errMessage.includes("supabase.com") || errMessage.includes("pooler"));
                         
      // Erro clássico de tenant/user não encontrado no pooler do Supavisor
      const isPoolerTenantError = errMessage.includes("tenant/user") && errMessage.includes("not found");

      if (isDnsError || isPoolerTenantError) {
        return NextResponse.json({
          success: false,
          steps,
          error: "O banco de dados da Supabase está inacessível ou o Connection Pooler está inativo.",
          details: "Não foi possível conectar ao banco de dados. Isso geralmente ocorre por dois motivos:\n\n" +
                   "1. O seu projeto está PAUSADO ou INATIVO na Supabase (se estiver, clique em 'Restaurar / Restore' no painel da Supabase).\n" +
                   "2. Se o seu projeto estiver ativo e saudável, o recurso de 'Connection Pooler' pode estar DESATIVADO (Disabled) nas configurações de banco da Supabase, ou a infraestrutura do pooler ainda está se propagando/sincronizando na rede (projetos criados recentemente podem levar de 5 a 15 minutos para ativar o pooler de conexões).\n\n" +
                   "Por favor, acesse o painel (https://supabase.com/dashboard), ative o seu Connection Pooler em 'Settings -> Database' se necessário, e tente novamente.",
          supabasePaused: true,
          supabasePoolerError: true,
        }, { status: 503 });
      }

      return NextResponse.json({
        success: false,
        steps,
        error: "Falha ao aplicar o schema. Verifique a conexao com o banco.",
        details: schemaErrors.length ? schemaErrors.join(" | ") : String(pushError.message || pushError),
      }, { status: 500 });
    }

    // 2. Seed inicial
    steps.push({ id: "prisma_seed", status: "running", message: "Inserindo dados iniciais..." });
    try {
      await seedInitialData(resolvedDbUrl, adminPassword || "admin123", gtmId || null);
      steps.push({ id: "prisma_seed", status: "ok", message: "Dados iniciais inseridos." });
    } catch (seedError: any) {
      return NextResponse.json({
        success: false,
        steps,
        error: "Falha ao inserir dados iniciais.",
        details: String(seedError.message || seedError),
      }, { status: 500 });
    }

    // 3. Gravar .env localmente (dev) apenas depois de validar a URL final
    try {
      const envPath = path.join(process.cwd(), ".env");
      fs.writeFileSync(envPath, [
        `DATABASE_URL="${resolvedDbUrl}"`,
        `NEXT_PUBLIC_APP_URL="${nextPublicAppUrl || "http://localhost:3000"}"`,
        `ADMIN_PASSWORD="${adminPassword || "admin123"}"`,
        "",
      ].join("\n"), "utf-8");
    } catch {}

    // 4. Configurar env vars na Vercel via API apenas depois de validar a URL final
    if (vercelToken && vercelProjectId) {
      steps.push({ id: "vercel_env", status: "running", message: "Configurando variaveis na Vercel..." });
      try {
        await upsertProjectEnvs(vercelToken, vercelProjectId, [
          { key: "DATABASE_URL", value: resolvedDbUrl, targets: ["production", "preview", "development"] },
          { key: "ADMIN_PASSWORD", value: adminPassword || "admin123", targets: ["production", "preview", "development"] },
          { key: "NEXT_PUBLIC_APP_URL", value: nextPublicAppUrl || "http://localhost:3000", targets: ["production", "preview", "development"] },
        ]);
        steps.push({ id: "vercel_env", status: "ok", message: "Variaveis configuradas na Vercel." });
      } catch (vercelErr: any) {
        steps.push({ id: "vercel_env", status: "warning", message: `Vercel API: ${vercelErr.message}` });
      }
    }

    return NextResponse.json({ success: true, steps, message: "Aplicativo configurado com sucesso!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  } finally {
    // Restaura o estado original de segurança do Node.js
    if (originalRejectUnauthorized !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}
