import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBarberAvailableSlots } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const barberId = searchParams.get("barberId");
    const serviceId = searchParams.get("serviceId");

    if (!dateStr || !barberId || !serviceId) {
      return NextResponse.json(
        { error: "Os parametros 'date', 'barberId' e 'serviceId' sao obrigatorios." },
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

    const [year, month, day] = dateStr.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day, 12, 0, 0);

    const slots = await getBarberAvailableSlots(
      barberId,
      selectedDate,
      service.duration
    );

    return NextResponse.json(slots);
  } catch (error) {
    console.error("Erro ao buscar horarios disponiveis:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar horarios disponiveis." },
      { status: 500 }
    );
  }
}
