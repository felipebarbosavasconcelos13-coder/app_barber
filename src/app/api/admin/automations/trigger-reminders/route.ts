import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWhatsappNotification } from "@/lib/evolution";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Permite autenticação por cookie (administrador no painel) OU por token de API na URL/Query (para Cron Jobs automáticos)
  const hasSession = isAdminAuthenticated(request);
  
  // Recupera configurações de marca e credenciais do banco
  const settings = await prisma.systemSettings.findFirst({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({ error: "Configurações não encontradas." }, { status: 404 });
  }

  // O token de bypass do cron é a própria senha administrativa do painel
  const queryToken = request.nextUrl.searchParams.get("token");
  const headerToken = request.headers.get("x-cron-token");
  const isValidToken = (queryToken && queryToken === settings.adminPassword) || 
                       (headerToken && headerToken === settings.adminPassword);

  if (!hasSession && !isValidToken) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Se o recurso de lembrete de WhatsApp estiver desativado
  if (!settings.whatsappReminderEnabled) {
    return NextResponse.json({ success: true, sentCount: 0, message: "Lembretes do WhatsApp desativados nas configurações." });
  }

  // Se a Evolution API não estiver devidamente configurada
  if (!settings.evolutionUrl || !settings.evolutionInstance) {
    return NextResponse.json({ success: false, sentCount: 0, error: "Evolution API do WhatsApp não está configurada no sistema." }, { status: 400 });
  }

  try {
    const agora = new Date();
    
    // Intervalo de 1 hora antes (janela de resiliência: agendamentos marcados entre agora + 45 minutos e agora + 75 minutos)
    // Isso é ideal para que chamadas periódicas de crons externos (ex: a cada 15 min) não pulem nenhum agendamento
    const minLimite = new Date(agora.getTime() + 45 * 60 * 1000);
    const maxLimite = new Date(agora.getTime() + 75 * 60 * 1000);

    // Busca agendamentos dentro da janela que ainda não receberam a notificação de lembrete
    const bookings = await prisma.booking.findMany({
      where: {
        dateTime: {
          gte: minLimite,
          lte: maxLimite,
        },
        reminderSent: false,
      },
      include: {
        service: true,
        barber: true,
      },
    });

    let sentCount = 0;
    const logs: string[] = [];

    for (const booking of bookings) {
      // Formata a data e horário em pt-BR
      const dateFormatted = new Date(booking.dateTime).toLocaleDateString("pt-BR");
      const timeFormatted = new Date(booking.dateTime).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Substitui variáveis do template dinâmico
      let message = settings.whatsappReminderTemplate || "";
      message = message
        .replace(/{{cliente}}/g, booking.clientName)
        .replace(/{cliente}/g, booking.clientName)
        .replace(/{{servico}}/g, booking.service.name)
        .replace(/{servico}/g, booking.service.name)
        .replace(/{{barbeiro}}/g, booking.barber.name)
        .replace(/{barbeiro}/g, booking.barber.name)
        .replace(/{{hora}}/g, timeFormatted)
        .replace(/{{horario}}/g, timeFormatted)
        .replace(/{horario}/g, timeFormatted)
        .replace(/{hora}/g, timeFormatted)
        .replace(/{{data}}/g, dateFormatted)
        .replace(/{data}/g, dateFormatted)
        .replace(/{{preco}}/g, `R$ ${booking.service.price.toFixed(2)}`)
        .replace(/{{valor}}/g, `R$ ${booking.service.price.toFixed(2)}`)
        .replace(/{valor}/g, `R$ ${booking.service.price.toFixed(2)}`)
        .replace(/{preco}/g, `R$ ${booking.service.price.toFixed(2)}`)
        .replace(/{{barbearia}}/g, settings.barberShopName);

      // Dispara a mensagem via Evolution API do WhatsApp
      const notificationResult = await sendWhatsappNotification({
        phone: booking.clientPhone,
        message,
      });

      if (notificationResult.ok) {
        sentCount++;
        // Marca o lembrete como enviado no banco de dados
        await prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSent: true },
        });
        logs.push(`Lembrete enviado com sucesso para ${booking.clientName} (${booking.clientPhone}).`);
      } else {
        logs.push(`Falha ao enviar lembrete para ${booking.clientName} (${booking.clientPhone}): ${notificationResult.error || "Erro desconhecido"}`);
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      message: `Processamento de lembretes concluído. Disparos realizados: ${sentCount}.`,
      logs,
    });
  } catch (error: any) {
    console.error("[api-trigger-reminders] Erro no processador de lembretes:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao processar lembretes.", details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
