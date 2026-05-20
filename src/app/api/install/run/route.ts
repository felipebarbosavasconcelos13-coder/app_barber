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
  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    max: 1,
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
  try {
    const rawData = await req.json().catch(() => null);
    if (!rawData) {
      return NextResponse.json({ success: false, error: "Corpo da requisicao invalido" }, { status: 400 });
    }

    const {
      databaseUrl,
      supabaseToken,
      supabaseUrl,
      vercelToken,
      vercelProjectId,
      nextPublicAppUrl,
      adminPassword,
      gtmId,
    } = rawData;

    const steps: Array<{ id: string; status: string; message: string }> = [];

    // Resolve DATABASE_URL
    let resolvedDbUrl = databaseUrl?.trim();

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

        const dbResult = await resolveSupabaseDbUrl(supabaseToken, projectRef);
        if (!dbResult.ok) {
          return NextResponse.json({
            success: false,
            steps,
            error: dbResult.error,
          }, { status: 400 });
        }

        resolvedDbUrl = dbResult.dbUrl;
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

    // 1. Configurar env vars na Vercel via API
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

    // 2. Gravar .env localmente (dev)
    try {
      const envPath = path.join(process.cwd(), ".env");
      fs.writeFileSync(envPath, [
        `DATABASE_URL="${resolvedDbUrl}"`,
        `NEXT_PUBLIC_APP_URL="${nextPublicAppUrl || "http://localhost:3000"}"`,
        `ADMIN_PASSWORD="${adminPassword || "admin123"}"`,
        "",
      ].join("\n"), "utf-8");
    } catch {}

    // 3. Inject no processo atual
    process.env.DATABASE_URL = resolvedDbUrl;

    // 4. Aplicar schema diretamente. Executar `npx prisma db push` dentro da
    // Vercel e fragil porque o runtime serverless nao e um ambiente de CLI.
    steps.push({ id: "prisma_push", status: "running", message: "Aplicando schema no banco..." });
    try {
      await applySchema(resolvedDbUrl);
      steps.push({ id: "prisma_push", status: "ok", message: "Schema aplicado." });
    } catch (pushError: any) {
      return NextResponse.json({
        success: false,
        steps,
        error: "Falha ao aplicar o schema. Verifique a conexao com o banco.",
        details: String(pushError.message || pushError),
      }, { status: 500 });
    }

    // 5. Seed inicial
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

    return NextResponse.json({ success: true, steps, message: "Aplicativo configurado com sucesso!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
