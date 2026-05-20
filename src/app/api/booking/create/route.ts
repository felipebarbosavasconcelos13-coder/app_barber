import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createGoogleCalendarEvent } from "@/lib/google";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientName, clientEmail, clientPhone, dateTime, barberId, serviceId } = body;

    if (!clientName || !clientEmail || !clientPhone || !dateTime || !barberId || !serviceId) {
      return NextResponse.json(
        { error: "Todos os campos do formulário são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca o barbeiro
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      return NextResponse.json({ error: "Barbeiro não encontrado." }, { status: 404 });
    }

    // Busca o serviço
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });
    }

    const bookingDate = new Date(dateTime);

    // Cria o agendamento localmente
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

    // Se o barbeiro tem conexão integrada com o Google Calendar, insere o agendamento lá também
    let googleEventId: string | null = null;
    if (barber.googleAccessToken && barber.googleRefreshToken) {
      try {
        googleEventId = await createGoogleCalendarEvent(
          {
            googleAccessToken: barber.googleAccessToken,
            googleRefreshToken: barber.googleRefreshToken,
          },
          {
            clientName,
            clientEmail,
            clientPhone,
            serviceName: service.name,
            price: service.price,
            startDateTime: bookingDate,
            durationMinutes: service.duration,
          }
        );

        if (googleEventId) {
          // Atualiza localmente o booking com o ID do evento do Google Calendar
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleEventId },
          });
        }
      } catch (err) {
        console.error("Falha ao criar o evento no Google Calendar:", err);
        // Prossegue com sucesso local para não invalidar a experiência do cliente
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        googleEventId,
      },
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar o agendamento." },
      { status: 500 }
    );
  }
}
