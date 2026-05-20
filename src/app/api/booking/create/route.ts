import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
