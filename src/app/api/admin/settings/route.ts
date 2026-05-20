import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Verifica se a requisição é de um administrador autenticado
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    if (!settings) {
      return NextResponse.json({ error: "Configurações não encontradas." }, { status: 404 });
    }

    // Retorna as configurações omitindo a senha do administrador por segurança
    return NextResponse.json({
      gtmId: settings.gtmId || "",
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
    });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Verifica se a requisição é de um administrador autenticado
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { gtmId, openingTime, closingTime, newPassword } = body;

    const updateData: any = {
      gtmId: gtmId || "",
      openingTime: openingTime || "09:00",
      closingTime: closingTime || "19:00",
    };

    // Atualiza a senha administrativa apenas se fornecida
    if (newPassword && newPassword.trim() !== "") {
      updateData.adminPassword = newPassword;
    }

    const updated = await prisma.systemSettings.update({
      where: { id: "default" },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        gtmId: updated.gtmId || "",
        openingTime: updated.openingTime,
        closingTime: updated.closingTime,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
