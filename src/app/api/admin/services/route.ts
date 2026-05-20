import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error("Erro ao listar serviços:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, price, duration } = body;

    if (!name || price === undefined || duration === undefined) {
      return NextResponse.json(
        { error: "Nome, preço e duração são obrigatórios." },
        { status: 400 }
      );
    }

    const priceNum = parseFloat(price);
    const durationNum = parseInt(duration);

    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      return NextResponse.json({ error: "Duração em minutos inválida." }, { status: 400 });
    }

    const newService = await prisma.service.create({
      data: {
        name,
        price: priceNum,
        duration: durationNum,
      },
    });

    return NextResponse.json({ success: true, service: newService });
  } catch (error) {
    console.error("Erro ao criar serviço:", error);
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
      return NextResponse.json({ error: "ID do serviço é obrigatório." }, { status: 400 });
    }

    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
