import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const bookings = await prisma.booking.findMany({
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
      orderBy: { dateTime: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Erro ao listar agendamentos administrativos:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do agendamento é obrigatório." }, { status: 400 });
    }

    await prisma.booking.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

