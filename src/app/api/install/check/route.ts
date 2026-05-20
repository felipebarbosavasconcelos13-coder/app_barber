import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * API para checar se o aplicativo de agendamento já está inicializado.
 * Cria uma conexão temporária com o banco usando o DATABASE_URL atual
 * (que pode ter sido atualizado em runtime pelo instalador).
 */
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;

    // 1. Se não houver DATABASE_URL ou se for placeholder, não está inicializado
    if (
      !dbUrl ||
      dbUrl.includes("[SENHA_DO_BANCO]") ||
      dbUrl.includes("[ID_DO_PROJETO]") ||
      dbUrl === "postgresql://localhost:5432/postgres"
    ) {
      // Verifica também se o .env em disco possui a URL real (pode ser que o dev server
      // tenha carregado o .env antigo mas o instalador já gravou um novo)
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/^DATABASE_URL="(.+)"/m);
        if (match && match[1] && !match[1].includes("[SENHA_DO_BANCO]") && !match[1].includes("[ID_DO_PROJETO]")) {
          // O .env em disco tem uma URL válida, mas o process.env ainda não a leu.
          // Atualiza process.env em runtime para que as próximas chamadas funcionem.
          process.env.DATABASE_URL = match[1];
        } else {
          return NextResponse.json({ initialized: false, reason: "DATABASE_URL is placeholder" });
        }
      } else {
        return NextResponse.json({ initialized: false, reason: "No env file" });
      }
    }

    const currentDbUrl = process.env.DATABASE_URL;
    if (!currentDbUrl || currentDbUrl.includes("[SENHA_DO_BANCO]")) {
      return NextResponse.json({ initialized: false, reason: "DATABASE_URL still placeholder" });
    }

    // 2. Tenta conectar ao banco de dados usando PrismaPg adapter (obrigatório no Prisma v7)
    const adapter = new PrismaPg({ connectionString: currentDbUrl });
    const tempPrisma = new PrismaClient({ adapter, log: ["error"] });
    try {
      const settings = await tempPrisma.systemSettings.findFirst({
        where: { id: "default" },
      });
      
      await tempPrisma.$disconnect();

      if (settings && settings.adminPassword) {
        return NextResponse.json({ initialized: true });
      }
      
      return NextResponse.json({ initialized: false, reason: "Tabelas vazias ou sem senha definida" });
    } catch (dbError) {
      await tempPrisma.$disconnect().catch(() => {});
      console.warn("[install-check] Banco de dados inacessível ou tabelas não criadas:", dbError);
      return NextResponse.json({ initialized: false, reason: "Database connection failed or tables not created" });
    }
  } catch (error) {
    console.error("[install-check] Falha geral ao verificar instalação:", error);
    return NextResponse.json({ initialized: false, error: String(error) });
  }
}
