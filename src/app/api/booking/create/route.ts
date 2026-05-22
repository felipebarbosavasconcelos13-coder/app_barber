import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWhatsappNotification } from "@/lib/evolution";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientName, clientEmail, clientPhone, dateTime, barberId, serviceId } = body;

    if (!clientName || !clientEmail || !clientPhone || !dateTime || !barberId || !serviceId) {
      return NextResponse.json(
        { error: "Todos os campos do formulario sao obrigatorios." },
        { status: 400 }
      );
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      return NextResponse.json({ error: "Barbeiro nao encontrado." }, { status: 404 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: "Servico nao encontrado." }, { status: 404 });
    }

    const bookingDate = new Date(dateTime);

    const booking = await prisma.booking.create({
      data: {
        clientName,
        clientEmail,
        clientPhone,
        dateTime: bookingDate,
        barberId,
        serviceId,
      },
      include: {
        barber: {
          select: {
            name: true,
            email: true,
          },
        },
        service: {
          select: {
            name: true,
            price: true,
            duration: true,
          },
        },
      },
    });

    // Dispara notificação de WhatsApp em segundo plano de forma não-bloqueante
    try {
      const formattedDate = bookingDate.toLocaleDateString("pt-BR");
      const formattedTime = bookingDate.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo", // Garante o fuso correto brasileiro
      });
      const formattedPrice = booking.service.price.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const message = `Olá, *${clientName}*! Seu agendamento na barbearia foi confirmado com sucesso! 🎉\n\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `⏰ *Horário:* ${formattedTime}\n` +
        `💈 *Barbeiro:* ${booking.barber.name}\n` +
        `✂️ *Serviço:* ${booking.service.name}\n` +
        `💰 *Valor:* ${formattedPrice}\n\n` +
        `Agradecemos a preferência e te aguardamos no horário agendado!`;

      sendWhatsappNotification({
        phone: clientPhone,
        message,
      }).catch((err) => {
        console.error("[route-booking-create] Erro no envio assíncrono do WhatsApp:", err);
      });
    } catch (msgErr) {
      console.error("[route-booking-create] Falha ao formatar mensagem de WhatsApp:", msgErr);
    }

    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar o agendamento." },
      { status: 500 }
    );
  }
}
