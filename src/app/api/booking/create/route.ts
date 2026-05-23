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

    // Dispara notificação de WhatsApp em segundo plano de forma não-bloqueante se estiver ativado
    try {
      const settings = await prisma.systemSettings.findFirst({
        where: { id: "default" },
        select: {
          whatsappConfirmationEnabled: true,
          whatsappConfirmationTemplate: true,
          barberShopName: true,
          address: true,
        },
      });

      if (settings?.whatsappConfirmationEnabled !== false) {
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

        const template = settings?.whatsappConfirmationTemplate || 
          "Olá, *${clientName}*! Seu agendamento de *${booking.service.name}* com o profissional *${booking.barber.name}* foi confirmado para o dia *${formattedDate}* às *${formattedTime}*. Valor: *${formattedPrice}*. Esperamos você!";

        const message = template
          .replace(/{cliente}/gi, clientName)
          .replace(/{servico}/gi, booking.service.name)
          .replace(/{barbeiro}/gi, booking.barber.name)
          .replace(/{data}/gi, formattedDate)
          .replace(/{horario}/gi, formattedTime)
          .replace(/{valor}/gi, formattedPrice)
          .replace(/{estabelecimento}/gi, settings?.barberShopName || "Barbearia Premium")
          .replace(/{endereco}/gi, settings?.address || "");

        const whatsappRes = await sendWhatsappNotification({
          phone: clientPhone,
          message,
        });
        if (!whatsappRes.ok) {
          console.warn("[route-booking-create] Falha no disparo de confirmação imediata:", whatsappRes.error);
        } else {
          console.log("[route-booking-create] Confirmação imediata disparada com sucesso!");
        }
      }
    } catch (msgErr) {
      console.error("[route-booking-create] Falha ao processar notificação de WhatsApp:", msgErr);
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
