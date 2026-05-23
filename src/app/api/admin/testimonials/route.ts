import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Lista todos os depoimentos (Visão administrativa)
export async function GET(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(testimonials);
  } catch (error) {
    console.error("[api-admin-testimonials-get] Erro ao buscar depoimentos:", error);
    return NextResponse.json({ error: "Erro ao buscar depoimentos no banco." }, { status: 500 });
  }
}

// POST: Cria um novo depoimento curado
export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { authorName, rating, content, avatarUrl, source } = body;

    if (!authorName || !content) {
      return NextResponse.json({ error: "Nome do autor e comentário são obrigatórios." }, { status: 400 });
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        authorName,
        rating: parseInt(rating) || 5,
        content,
        avatarUrl: avatarUrl || "",
        source: source || "Google",
      },
    });

    return NextResponse.json({ success: true, testimonial });
  } catch (error) {
    console.error("[api-admin-testimonials-post] Erro ao criar depoimento:", error);
    return NextResponse.json({ error: "Erro ao cadastrar depoimento." }, { status: 500 });
  }
}

// PUT: Edita um depoimento existente
export async function PUT(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id, authorName, rating, content, avatarUrl, source } = body;

    if (!id || !authorName || !content) {
      return NextResponse.json({ error: "ID, nome do autor e comentário são obrigatórios." }, { status: 400 });
    }

    const updated = await prisma.testimonial.update({
      where: { id },
      data: {
        authorName,
        rating: parseInt(rating) || 5,
        content,
        avatarUrl: avatarUrl || "",
        source: source || "Google",
      },
    });

    return NextResponse.json({ success: true, testimonial: updated });
  } catch (error) {
    console.error("[api-admin-testimonials-put] Erro ao editar depoimento:", error);
    return NextResponse.json({ error: "Erro ao atualizar depoimento." }, { status: 500 });
  }
}

// DELETE: Remove um depoimento
export async function DELETE(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "O ID do depoimento é obrigatório para remoção." }, { status: 400 });
    }

    await prisma.testimonial.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Depoimento removido com sucesso." });
  } catch (error) {
    console.error("[api-admin-testimonials-delete] Erro ao remover depoimento:", error);
    return NextResponse.json({ error: "Erro ao remover depoimento do banco." }, { status: 500 });
  }
}
