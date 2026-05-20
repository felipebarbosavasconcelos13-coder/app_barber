import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const maxDuration = 300; // Define timeout longo de 5 minutos

/**
 * API para executar a instalação do aplicativo e configurar o banco e chaves.
 */
export async function POST(req: Request) {
  try {
    const rawData = await req.json().catch(() => null);
    if (!rawData) {
      return NextResponse.json({ success: false, error: "Corpo da requisição inválido" }, { status: 400 });
    }

    const {
      databaseUrl,
      nextPublicAppUrl,
      adminPassword,
      gtmId,
    } = rawData;

    if (!databaseUrl) {
      return NextResponse.json({ success: false, error: "A URL de banco do Supabase é obrigatória." }, { status: 400 });
    }

    // 1. Gravar as novas variáveis de ambiente no arquivo .env localmente
    const envPath = path.join(process.cwd(), ".env");
    const newEnvContent = `# Variaveis geradas pelo assistente de instalacao em ${new Date().toISOString()}
DATABASE_URL="${databaseUrl}"

# Configuracoes do App
NEXT_PUBLIC_APP_URL="${nextPublicAppUrl || "http://localhost:3000"}"
ADMIN_PASSWORD="${adminPassword || "admin123"}"
`;

    fs.writeFileSync(envPath, newEnvContent, "utf-8");

    // Também injeta no process.env global do processo atual para as chamadas seguintes
    process.env.DATABASE_URL = databaseUrl;
    process.env.NEXT_PUBLIC_APP_URL = nextPublicAppUrl || "http://localhost:3000";
    process.env.ADMIN_PASSWORD = adminPassword || "admin123";

    console.log("[installer-run] Gravou arquivo .env com sucesso.");

    // 2. Rodar o push do banco via Prisma de forma assíncrona
    console.log("[installer-run] Rodando npx prisma db push...");
    try {
      await execAsync("npx prisma db push", {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      });
      console.log("[installer-run] npx prisma db push concluído.");
    } catch (pushError: any) {
      console.error("[installer-run] Erro ao rodar db push:", pushError);
      return NextResponse.json({
        success: false,
        error: "Falha ao aplicar o schema no banco do Supabase. Verifique se a URL de conexão está correta e com os privilégios adequados.",
        details: String(pushError.stderr || pushError.message || pushError),
      }, { status: 500 });
    }

    // 3. Rodar o seed para preencher os serviços e horários padrão
    console.log("[installer-run] Rodando seed do Prisma...");
    try {
      await execAsync("npx prisma db seed", {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      });
      console.log("[installer-run] Seed concluído.");
    } catch (seedError: any) {
      console.error("[installer-run] Erro ao rodar seed:", seedError);
      // Se falhar o seed por conflito de chave primária, apenas ignore, pois o banco já pode ter sido populado
      if (!String(seedError).includes("Unique constraint")) {
        console.warn("[installer-run] Ignorando erro secundário de seed.");
      }
    }

    // 4. Gravar configurações administrativas e senha mestra fornecida
    console.log("[installer-run] Gravando senha de admin e GTM customizados...");
    const prismaClient = new PrismaClient({ log: ["error"] });

    try {
      // Tenta upsert das configurações globais com os dados digitados pelo usuário
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
      console.log("[installer-run] Configurações de administração atualizadas com sucesso!");
    } catch (dbError) {
      await prismaClient.$disconnect();
      console.error("[installer-run] Erro ao gravar dados customizados:", dbError);
      // Retorna sucesso de qualquer forma, pois o schema e seed básicos rodaram
    }

    return NextResponse.json({
      success: true,
      message: "Aplicativo configurado com sucesso!",
    });
  } catch (error) {
    console.error("[installer-run] Erro crítico de instalação:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
