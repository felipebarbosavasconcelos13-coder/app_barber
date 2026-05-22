import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * API para checar se o aplicativo de agendamento já está inicializado.
 * Utiliza o Proxy dinâmico e resiliente do Prisma que lê e atualiza as credenciais
 * dinamicamente em runtime a partir do .env do disco ou do process.env.
 */
export async function GET() {
  try {
    // Consulta as configurações diretamente pelo proxy do Prisma.
    // O próprio proxy cuida de validar a connection string e reconectar de forma limpa.
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    if (settings && settings.adminPassword) {
      return NextResponse.json({ initialized: true });
    }

    return NextResponse.json({
      initialized: false,
      reason: "Tabelas vazias ou sem senha mestra definida",
    });
  } catch (error) {
    console.warn("[install-check] Banco de dados inacessível ou tabelas não criadas:", error);
    return NextResponse.json({
      initialized: false,
      reason: "Conexao com o banco falhou ou tabelas nao criadas",
      error: String(error),
    });
  }
}

