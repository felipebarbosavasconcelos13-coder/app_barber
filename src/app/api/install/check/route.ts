import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * API para checar se o aplicativo de agendamento já está inicializado.
 */
export async function GET() {
  try {
    // 1. Verifica se o arquivo .env existe e possui chaves preenchidas
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ initialized: false, reason: "No env file" });
    }

    const envContent = fs.readFileSync(envPath, "utf-8");
    
    // Se a DATABASE_URL for a string placeholder, assume desconfigurado
    if (
      envContent.includes("[SENHA_DO_BANCO]") || 
      !process.env.DATABASE_URL
    ) {
      return NextResponse.json({ initialized: false, reason: "Default placeholder placeholders detected" });
    }

    // 2. Tenta conectar ao banco de dados via Prisma Client para ver se as tabelas existem e estão populadas
    const tempPrisma = new PrismaClient({ log: ["error"] });
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
      // Se der erro ao tentar consultar a tabela (ex: tabela não existe), assume desconfigurado
      await tempPrisma.$disconnect();
      console.warn("[install-check] Banco de dados inacessível ou tabelas não criadas:", dbError);
      return NextResponse.json({ initialized: false, reason: "Database connection failed or tables not created" });
    }
  } catch (error) {
    console.error("[install-check] Falha geral ao verificar instalação:", error);
    return NextResponse.json({ initialized: false, error: String(error) });
  }
}
