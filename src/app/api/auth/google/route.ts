import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json(
      { error: "O parâmetro barberId é obrigatório." },
      { status: 400 }
    );
  }

  try {
    const authUrl = getAuthUrl(barberId);
    // Redireciona o usuário para a página de consentimento do Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Erro ao iniciar fluxo OAuth do Google:", error);
    return NextResponse.json(
      { error: "Erro interno ao iniciar a autenticação com o Google." },
      { status: 500 }
    );
  }
}
