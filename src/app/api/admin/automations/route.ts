import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verifica autenticação administrativa
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

    return NextResponse.json({
      whatsappConfirmationEnabled: settings.whatsappConfirmationEnabled,
      whatsappConfirmationTemplate: settings.whatsappConfirmationTemplate,
      whatsappReengagementEnabled: settings.whatsappReengagementEnabled,
      whatsappReengagementDays: settings.whatsappReengagementDays,
      whatsappReengagementTemplate: settings.whatsappReengagementTemplate,
      whatsappReminderEnabled: settings.whatsappReminderEnabled,
      whatsappReminderTemplate: settings.whatsappReminderTemplate,
    });
  } catch (error) {
    console.error("[api-admin-automations] Erro ao buscar configurações de automação:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Verifica autenticação administrativa
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      whatsappConfirmationEnabled,
      whatsappConfirmationTemplate,
      whatsappReengagementEnabled,
      whatsappReengagementDays,
      whatsappReengagementTemplate,
      whatsappReminderEnabled,
      whatsappReminderTemplate,
    } = body;

    const updateData: any = {};

    if (whatsappConfirmationEnabled !== undefined) {
      updateData.whatsappConfirmationEnabled = !!whatsappConfirmationEnabled;
    }
    if (whatsappConfirmationTemplate !== undefined) {
      updateData.whatsappConfirmationTemplate = whatsappConfirmationTemplate;
    }
    if (whatsappReengagementEnabled !== undefined) {
      updateData.whatsappReengagementEnabled = !!whatsappReengagementEnabled;
    }
    if (whatsappReengagementDays !== undefined) {
      const days = parseInt(whatsappReengagementDays);
      updateData.whatsappReengagementDays = isNaN(days) ? 30 : days;
    }
    if (whatsappReengagementTemplate !== undefined) {
      updateData.whatsappReengagementTemplate = whatsappReengagementTemplate;
    }
    if (whatsappReminderEnabled !== undefined) {
      updateData.whatsappReminderEnabled = !!whatsappReminderEnabled;
    }
    if (whatsappReminderTemplate !== undefined) {
      updateData.whatsappReminderTemplate = whatsappReminderTemplate;
    }

    const updated = await prisma.systemSettings.update({
      where: { id: "default" },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      automations: {
        whatsappConfirmationEnabled: updated.whatsappConfirmationEnabled,
        whatsappConfirmationTemplate: updated.whatsappConfirmationTemplate,
        whatsappReengagementEnabled: updated.whatsappReengagementEnabled,
        whatsappReengagementDays: updated.whatsappReengagementDays,
        whatsappReengagementTemplate: updated.whatsappReengagementTemplate,
        whatsappReminderEnabled: updated.whatsappReminderEnabled,
        whatsappReminderTemplate: updated.whatsappReminderTemplate,
      },
    });
  } catch (error) {
    console.error("[api-admin-automations] Erro ao atualizar configurações de automação:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
