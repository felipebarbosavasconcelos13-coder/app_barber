import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Retorna os depoimentos cadastrados ou fallbacks padrão se a base estiver vazia
export async function GET(request: NextRequest) {
  try {
    const dbTestimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (dbTestimonials.length > 0) {
      return NextResponse.json(dbTestimonials);
    }

    // Fallbacks padrão de luxo caso o administrador não tenha cadastrado nenhum depoimento ainda
    const defaultTestimonials = [
      {
        id: "default-1",
        authorName: "Marcos Souza",
        rating: 5,
        content: "Excelente barbearia! O atendimento é impecável e o ambiente muito agradável. Recomendo o corte de cabelo masculino e o combo.",
        avatarUrl: "",
        source: "Google",
      },
      {
        id: "default-2",
        authorName: "Thiago Silva",
        rating: 5,
        content: "Melhor barba da cidade! O cuidado com a toalha quente e os produtos de alta qualidade fazem toda a diferença.",
        avatarUrl: "",
        source: "Google",
      },
      {
        id: "default-3",
        authorName: "Felipe Vasconcelos",
        rating: 5,
        content: "Lugar sensacional. Agendamento online prático e rápido pelo site, barbeiros super profissionais.",
        avatarUrl: "",
        source: "Google",
      },
    ];

    return NextResponse.json(defaultTestimonials);
  } catch (error) {
    console.error("[api-public-testimonials-get] Erro ao buscar depoimentos:", error);
    return NextResponse.json({ error: "Erro ao carregar depoimentos." }, { status: 500 });
  }
}
