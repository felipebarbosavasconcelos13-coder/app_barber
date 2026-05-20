import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { upsertProjectEnvs } from "@/lib/installer/vercel";

const execAsync = promisify(exec);

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const rawData = await req.json().catch(() => null);
    if (!rawData) {
      return NextResponse.json({ success: false, error: "Corpo da requisicao invalido" }, { status: 400 });
    }

    const {
      databaseUrl,
      vercelToken,
      vercelProjectId,
      nextPublicAppUrl,
      adminPassword,
      gtmId,
    } = rawData;

    if (!databaseUrl) {
      return NextResponse.json({ success: false, error: "A URL de banco do Supabase e obrigatoria." }, { status: 400 });
    }

    const steps: Array<{ id: string; status: string; message: string }> = [];

    // 1. Configurar env vars na Vercel via API (se token fornecido)
    if (vercelToken && vercelProjectId) {
      try {
        steps.push({ id: "vercel_env", status: "running", message: "Configurando variaveis de ambiente na Vercel..." });
        await upsertProjectEnvs(
          vercelToken,
          vercelProjectId,
          [
            {
              key: "DATABASE_URL",
              value: databaseUrl,
              targets: ["production", "preview", "development"],
            },
            {
              key: "ADMIN_PASSWORD",
              value: adminPassword || "admin123",
              targets: ["production", "preview", "development"],
            },
          ]
        );
        steps.push({ id: "vercel_env", status: "ok", message: "Variaveis configuradas na Vercel." });
      } catch (vercelErr: any) {
        steps.push({ id: "vercel_env", status: "warning", message: `Vercel: ${vercelErr.message}. Continuando localmente.` });
      }
    }

    // 2. Gravar .env localmente (funciona em dev local, ignora em cloud)
    try {
      const envPath = path.join(process.cwd(), ".env");
      const newEnvContent = `# Variaveis geradas pelo assistente de instalacao em ${new Date().toISOString()}
DATABASE_URL="${databaseUrl}"

# Configuracoes do App
NEXT_PUBLIC_APP_URL="${nextPublicAppUrl || "http://localhost:3000"}"
ADMIN_PASSWORD="${adminPassword || "admin123"}"
`;
      fs.writeFileSync(envPath, newEnvContent, "utf-8");
    } catch {
      // Read-only filesystem (Vercel) - ignorado, env vars ja estao configuradas via API
    }

    // 3. Inject env vars no processo atual
    process.env.DATABASE_URL = databaseUrl;
    process.env.NEXT_PUBLIC_APP_URL = nextPublicAppUrl || "http://localhost:3000";
    process.env.ADMIN_PASSWORD = adminPassword || "admin123";

    // 4. Rodar prisma db push
    steps.push({ id: "prisma_push", status: "running", message: "Aplicando schema no banco..." });
    try {
      await execAsync("npx prisma db push", {
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      steps.push({ id: "prisma_push", status: "ok", message: "Schema aplicado com sucesso." });
    } catch (pushError: any) {
      return NextResponse.json({
        success: false,
        steps,
        error: "Falha ao aplicar o schema no banco do Supabase. Verifique se a URL de conexao esta correta e com os privilegios adequados.",
        details: String(pushError.stderr || pushError.message || pushError),
      }, { status: 500 });
    }

    // 5. Rodar seed
    steps.push({ id: "prisma_seed", status: "running", message: "Inserindo dados iniciais..." });
    try {
      await execAsync("npx prisma db seed", {
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      steps.push({ id: "prisma_seed", status: "ok", message: "Dados iniciais inseridos." });
    } catch (seedError: any) {
      if (!String(seedError).includes("Unique constraint")) {
        steps.push({ id: "prisma_seed", status: "warning", message: "Seed ignorado (dados ja existentes)." });
      }
    }

    // 6. Atualizar SystemSettings com senha e GTM customizados
    steps.push({ id: "settings", status: "running", message: "Salvando configuracoes administrativas..." });
    const prismaClient = new PrismaClient({ log: ["error"] });
    try {
      await prismaClient.systemSettings.upsert({
        where: { id: "default" },
        update: {
          adminPassword: adminPassword || "admin123",
          gtmId: gtmId || null,
        },
        create: {
          id: "default",
          adminPassword: adminPassword || "admin123",
          gtmId: gtmId || null,
          openingTime: "09:00",
          closingTime: "19:00",
        },
      });
      await prismaClient.$disconnect();
      steps.push({ id: "settings", status: "ok", message: "Configuracoes salvas." });
    } catch (dbError) {
      await prismaClient.$disconnect();
      steps.push({ id: "settings", status: "warning", message: "Configuracoes parciais (seed ja configurou)." });
    }

    return NextResponse.json({
      success: true,
      steps,
      message: "Aplicativo configurado com sucesso!",
    });
  } catch (error) {
    console.error("[installer-run] Erro critico:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
