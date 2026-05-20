import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const barbers = await prisma.barber.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Formata o retorno ocultando dados sensíveis e gerando a flag de conexão do Google
    const formattedBarbers = barbers.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      isGoogleConnected: !!b.googleRefreshToken,
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
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nome e e-mail do Google são obrigatórios." },
        { status: 400 }
      );
    }

    // Verifica se já existe barbeiro com este e-mail do Google
    const existing = await prisma.barber.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um barbeiro cadastrado com este e-mail do Google." },
        { status: 400 }
      );
    }

    const newBarber = await prisma.barber.create({
      data: {
        name,
        email,
      },
    });

    return NextResponse.json({
      success: true,
      barber: {
        id: newBarber.id,
        name: newBarber.name,
        email: newBarber.email,
        isGoogleConnected: false,
      },
    });
  } catch (error) {
    console.error("Erro ao criar barbeiro:", error);
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
      return NextResponse.json({ error: "ID do barbeiro é obrigatório." }, { status: 400 });
    }

    // Deleta o barbeiro (a cascade ou exclusão simples)
    await prisma.barber.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir barbeiro:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
