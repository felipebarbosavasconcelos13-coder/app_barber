import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { upsertProjectEnvs } from "@/lib/installer/vercel";
import { resolveSupabaseDbUrl, extractProjectRefFromUrl } from "@/lib/installer/supabase";

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

    // 4. prisma db push
    steps.push({ id: "prisma_push", status: "running", message: "Aplicando schema no banco..." });
    try {
      await execAsync("npx prisma db push", { env: { ...process.env, DATABASE_URL: resolvedDbUrl } });
      steps.push({ id: "prisma_push", status: "ok", message: "Schema aplicado." });
    } catch (pushError: any) {
      return NextResponse.json({
        success: false,
        steps,
        error: "Falha ao aplicar o schema. Verifique a conexao com o banco.",
        details: String(pushError.stderr || pushError.message || pushError),
      }, { status: 500 });
    }

    // 5. prisma db seed
    steps.push({ id: "prisma_seed", status: "running", message: "Inserindo dados iniciais..." });
    try {
      await execAsync("npx prisma db seed", { env: { ...process.env, DATABASE_URL: resolvedDbUrl } });
      steps.push({ id: "prisma_seed", status: "ok", message: "Dados iniciais inseridos." });
    } catch (seedError: any) {
      if (!String(seedError).includes("Unique constraint")) {
        steps.push({ id: "prisma_seed", status: "warning", message: "Dados ja existentes." });
      }
    }

    // 6. SystemSettings
    steps.push({ id: "settings", status: "running", message: "Salvando configuracoes..." });
    const prismaClient = new PrismaClient({ log: ["error"] });
    try {
      await prismaClient.systemSettings.upsert({
        where: { id: "default" },
        update: { adminPassword: adminPassword || "admin123", gtmId: gtmId || null },
        create: { id: "default", adminPassword: adminPassword || "admin123", gtmId: gtmId || null, openingTime: "09:00", closingTime: "19:00" },
      });
      await prismaClient.$disconnect();
      steps.push({ id: "settings", status: "ok", message: "Configuracoes salvas." });
    } catch {
      await prismaClient.$disconnect();
    }

    return NextResponse.json({ success: true, steps, message: "Aplicativo configurado com sucesso!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
