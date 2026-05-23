import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendWhatsappNotification } from "@/lib/evolution";

export const dynamic = "force-dynamic";

interface TriggerTarget {
  bookingId: string;
  clientPhone: string;
  clientName: string;
  lastService: string;
  daysSinceLast: number;
}

export async function POST(request: NextRequest) {
  // 1. Verifica autenticação administrativa
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { targets } = body as { targets?: TriggerTarget[] };

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: "Nenhum cliente elegível fornecido para disparo." }, { status: 400 });
    }

    // 2. Carrega as configurações de reengajamento
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: {
        whatsappReengagementEnabled: true,
        whatsappReengagementTemplate: true,
        phone: true, // Usado como contato se link_app não existir
      },
    });

    const template = settings?.whatsappReengagementTemplate || 
      "Olá, *{cliente}*! Faz *{dias}* dias desde o seu último serviço de *{servico}* com a gente. Que tal agendar um novo horário para manter o visual em dia? Agende no link: {link_app}";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let sentCount = 0;
    const errors: string[] = [];

    // 3. Dispara as notificações individualmente em segundo plano
    for (const target of targets) {
      try {
        const { bookingId, clientPhone, clientName, lastService, daysSinceLast } = target;

        // Formata a mensagem substituindo as variáveis dinâmicas do template
        let formattedMessage = template
          .replace(/{cliente}/gi, clientName)
          .replace(/{servico}/gi, lastService)
          .replace(/{ultimo_servico}/gi, lastService)
          .replace(/{dias}/gi, String(daysSinceLast))
          .replace(/{link_app}/gi, appUrl);

        console.log(`[trigger-reengagement] Disparando reengajamento para ${clientPhone}...`);
        
        // Envia via Evolution API
        const sendResult = await sendWhatsappNotification({
          phone: clientPhone,
          message: formattedMessage,
        });

        if (sendResult.ok) {
          sentCount++;
          // 4. Marca o agendamento como notificado com sucesso no banco de dados
          await prisma.booking.update({
            where: { id: bookingId },
            data: { reengagementSent: true },
          });
        } else {
          errors.push(`${clientPhone}: ${sendResult.error || "Erro de envio"}`);
        }
      } catch (err: any) {
        errors.push(`Erro geral no envio para ${target.clientPhone}: ${err.message || err}`);
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalRequested: targets.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[api-admin-automations-trigger] Erro ao disparar reengajamento:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao processar disparos." }, { status: 500 });
  }
}
