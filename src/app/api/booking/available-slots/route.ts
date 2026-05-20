import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBarberAvailableSlots } from "@/lib/google";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date"); // Formato "YYYY-MM-DD"
    const barberId = searchParams.get("barberId");
    const serviceId = searchParams.get("serviceId");

    if (!dateStr || !barberId || !serviceId) {
      return NextResponse.json(
        { error: "Os parâmetros 'date', 'barberId' e 'serviceId' são obrigatórios." },
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

    // Busca as configurações padrão da barbearia
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    const openingTime = settings?.openingTime || "09:00";
    const closingTime = settings?.closingTime || "19:00";

    // Converte a string de data "YYYY-MM-DD" para um objeto Date da timezone local
    const [year, month, day] = dateStr.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day, 12, 0, 0); // Define meio-dia para evitar problemas de timezone

    // Consulta os slots livres
    const slots = await getBarberAvailableSlots(
      {
        googleAccessToken: barber.googleAccessToken,
        googleRefreshToken: barber.googleRefreshToken,
      },
      selectedDate,
      openingTime,
      closingTime,
      service.duration
    );

    return NextResponse.json(slots);
  } catch (error) {
    console.error("Erro ao buscar horários disponíveis:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar horários disponíveis." },
      { status: 500 }
    );
  }
}
