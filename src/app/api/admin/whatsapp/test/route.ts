import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { checkEvolutionConnection } from "@/lib/evolution";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  // Verifica se a requisição é de um administrador autenticado
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let { url, apiKey, instance } = body;

    // Se as credenciais enviadas estiverem em branco, tenta carregar as salvas no banco
    if (!url || !apiKey || !instance) {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: "default" },
        select: {
          evolutionUrl: true,
          evolutionApiKey: true,
          evolutionInstance: true,
        },
      });

      if (settings) {
        if (!url) url = settings.evolutionUrl || "";
        if (!apiKey) apiKey = settings.evolutionApiKey || "";
        if (!instance) instance = settings.evolutionInstance || "";
      }
    }

    // Valida se as configurações mínimas existem
    if (!url || !apiKey || !instance) {
      return NextResponse.json({
        success: false,
        status: "DESCONECTADO",
        details: "Configurações do WhatsApp incompletas. Preencha os campos de URL, Token API e Instância antes de testar.",
      });
    }

    // Executa a verificação de conexão
    const result = await checkEvolutionConnection(url, apiKey, instance);

    return NextResponse.json({
      success: result.ok,
      status: result.status,
      details: result.details,
    });
  } catch (error: any) {
    console.error("Erro na rota de teste de conexão com o WhatsApp:", error);
    return NextResponse.json(
      {
        success: false,
        status: "ERRO_CONEXAO",
        details: `Erro interno ao tentar validar conexão: ${error.message || error}`,
      },
      { status: 500 }
    );
  }
}
