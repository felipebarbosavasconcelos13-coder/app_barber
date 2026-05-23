import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Retorna apenas depoimentos reais cadastrados pelo administrador.
export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(testimonials);
  } catch (error) {
    console.error("[api-public-testimonials-get] Erro ao buscar depoimentos:", error);
    return NextResponse.json({ error: "Erro ao carregar depoimentos." }, { status: 500 });
  }
}
