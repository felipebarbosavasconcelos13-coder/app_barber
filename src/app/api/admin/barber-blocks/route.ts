import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get("barberId");

    const whereClause = barberId ? { barberId } : {};

    const blocks = await prisma.barberBlock.findMany({
      where: whereClause,
      include: {
        barber: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json(blocks);
  } catch (error) {
    console.error("Erro ao listar bloqueios administrativos:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const { barberId, date, startTime, endTime, reason } = body;

    if (!barberId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "barberId, date, startTime e endTime são campos obrigatórios." },
        { status: 400 }
      );
    }

    // A data recebida deve ser salva sem a componente de fuso horário local modificando o dia
    const blockDate = new Date(date);
    // Zera horas para armazenar apenas o dia
    blockDate.setUTCHours(0, 0, 0, 0);

    const newBlock = await prisma.barberBlock.create({
      data: {
        barberId,
        date: blockDate,
        startTime,
        endTime,
        reason: reason || null,
      },
    });

    return NextResponse.json(newBlock, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar bloqueio na agenda:", error);
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
      return NextResponse.json({ error: "ID do bloqueio é obrigatório." }, { status: 400 });
    }

    await prisma.barberBlock.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar bloqueio:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
