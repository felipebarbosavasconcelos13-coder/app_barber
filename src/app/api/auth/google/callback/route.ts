import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/google";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const barberId = searchParams.get("state"); // O state contém o barberId passado no início do fluxo

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code || !barberId) {
    console.error("Callback do Google chamado com parâmetros inválidos:", { code, barberId });
    return NextResponse.redirect(
      `${appUrl}/admin?tab=barbeiros&status=oauth_error&message=Parametros-invalidos`
    );
  }

  try {
    // Troca o código temporário retornado pelo Google pelos tokens reais
    const tokens = await getTokensFromCode(code);

    const updateData: any = {};
    
    if (tokens.access_token) {
      updateData.googleAccessToken = tokens.access_token;
    }
    
    if (tokens.refresh_token) {
      updateData.googleRefreshToken = tokens.refresh_token;
    }
    
    if (tokens.expiry_date) {
      updateData.googleTokenExpiry = new Date(tokens.expiry_date);
    }

    // Salva os tokens na tabela Barber associada
    await prisma.barber.update({
      where: { id: barberId },
      data: updateData,
    });

    console.log(`Google Calendar conectado com sucesso para o barbeiro ID: ${barberId}`);

    // Redireciona o administrador de volta para a aba de barbeiros com feedback de sucesso
    return NextResponse.redirect(`${appUrl}/admin?tab=barbeiros&status=oauth_success`);
  } catch (error: any) {
    console.error("Erro no callback do Google OAuth:", error);
    return NextResponse.redirect(
      `${appUrl}/admin?tab=barbeiros&status=oauth_error&message=${encodeURIComponent(
        error?.message || "Erro-na-autenticacao"
      )}`
    );
  }
}
