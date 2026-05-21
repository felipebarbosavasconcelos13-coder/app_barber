import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const barbers = await prisma.barber.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formattedBarbers = barbers.map((b: any) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      openingTime: b.openingTime,
      closingTime: b.closingTime,
      lunchStart: b.lunchStart,
      lunchEnd: b.lunchEnd,
      workDays: b.workDays,
      createdAt: b.createdAt,
    }));

    return NextResponse.json(formattedBarbers);
  } catch (error) {
    console.error("Erro ao listar barbeiros:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, openingTime, closingTime, lunchStart, lunchEnd, workDays } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nome e e-mail sao obrigatorios." },
        { status: 400 }
      );
    }

    const existing = await prisma.barber.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ja existe um barbeiro cadastrado com este e-mail." },
        { status: 400 }
      );
    }

    const newBarber = await prisma.barber.create({
      data: {
        name,
        email,
        openingTime: openingTime || "09:00",
        closingTime: closingTime || "19:00",
        lunchStart: lunchStart || "12:00",
        lunchEnd: lunchEnd || "13:00",
        workDays: workDays || "1,2,3,4,5,6",
      },
    });

    return NextResponse.json({
      success: true,
      barber: {
        id: newBarber.id,
        name: newBarber.name,
        email: newBarber.email,
        openingTime: newBarber.openingTime,
        closingTime: newBarber.closingTime,
        lunchStart: newBarber.lunchStart,
        lunchEnd: newBarber.lunchEnd,
        workDays: newBarber.workDays,
      },
    });
  } catch (error) {
    console.error("Erro ao criar barbeiro:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, email, openingTime, closingTime, lunchStart, lunchEnd, workDays } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do barbeiro e obrigatorio." }, { status: 400 });
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nome e e-mail sao obrigatorios." },
        { status: 400 }
      );
    }

    const existing = await prisma.barber.findFirst({
      where: {
        email,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ja existe um barbeiro cadastrado com este e-mail." },
        { status: 400 }
      );
    }

    const updated = await prisma.barber.update({
      where: { id },
      data: {
        name,
        email,
        openingTime: openingTime || "09:00",
        closingTime: closingTime || "19:00",
        lunchStart: lunchStart || "12:00",
        lunchEnd: lunchEnd || "13:00",
        workDays: workDays || "1,2,3,4,5,6",
      },
    });

    return NextResponse.json({
      success: true,
      barber: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        openingTime: updated.openingTime,
        closingTime: updated.closingTime,
        lunchStart: updated.lunchStart,
        lunchEnd: updated.lunchEnd,
        workDays: updated.workDays,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar barbeiro:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do barbeiro e obrigatorio." }, { status: 400 });
    }

    await prisma.barber.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir barbeiro:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
