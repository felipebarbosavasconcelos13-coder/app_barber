import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

function decodeHtml(input: string) {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function matchFirst(html: string, regex: RegExp) {
  return regex.exec(html)?.[1]?.trim() || "";
}

function parseWidgetHtml(html: string) {
  const headerRating = Number(matchFirst(html, /<span[^>]*class=["'][^"']*rpi-stars[^"']*["'][^>]*style=["'][^"']*--rating:([0-9.]+)/i)) || 0;
  const headerCount = Number(matchFirst(html, /Baseado\s+em\s+([0-9.]+)\s+avalia/i).replace(/\D/g, "")) || 0;
  const reviewBlocks = html.match(/<div[^>]*class=["'][^"']*rpi-slide[^"']*grw-review[^"']*["'][\s\S]*?(?=<div[^>]*class=["'][^"']*rpi-slide[^"']*grw-review|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<script|$)/gi) || [];

  const reviews = reviewBlocks
    .map((block) => {
      const authorHtml = matchFirst(block, /<a[^>]*class=["'][^"']*wp-google-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      const textHtml = matchFirst(block, /<span[^>]*class=["'][^"']*wp-google-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const rating = Number(matchFirst(block, /<span[^>]*class=["'][^"']*rpi-stars[^"']*["'][^>]*style=["'][^"']*--rating:([0-9.]+)/i)) || 5;
      const avatar = matchFirst(block, /<img[^>]*(?:data-lazy-src|src)=["']([^"']+)["'][^>]*>/i);

      return {
        authorName: decodeHtml(authorHtml),
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        content: decodeHtml(textHtml),
        avatarUrl: avatar.startsWith("data:image/") ? "" : avatar,
        source: "Google Widget",
      };
    })
    .filter((review) => review.authorName && review.content);

  return { headerRating, headerCount, reviews };
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let source = String(body.source || "").trim();

    if (!source) {
      const settings = await prisma.systemSettings.findFirst({ where: { id: "default" } });
      source = settings?.googleReviewsWidget || "";
    }

    if (!source) {
      return NextResponse.json({ error: "Cole o HTML do widget ou uma URL pública que contenha o widget de avaliações." }, { status: 400 });
    }

    let html = source;
    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source, { headers: { "user-agent": "Mozilla/5.0 GoogleReviewsImporter/1.0" } });
      if (!response.ok) {
        return NextResponse.json({ error: `Não foi possível carregar a URL do widget (${response.status}).` }, { status: 400 });
      }
      html = await response.text();
    }

    const parsed = parseWidgetHtml(html);
    if (parsed.reviews.length === 0) {
      return NextResponse.json({ error: "Nenhuma avaliação com texto foi encontrada no HTML/URL informado." }, { status: 400 });
    }

    const saved = [];
    for (const review of parsed.reviews) {
      const existing = await prisma.testimonial.findFirst({
        where: { authorName: review.authorName, content: review.content },
      });

      if (existing) {
        saved.push(existing);
        continue;
      }

      saved.push(await prisma.testimonial.create({ data: review }));
    }

    await prisma.systemSettings.update({
      where: { id: "default" },
      data: {
        googleReviewsWidget: /^https?:\/\//i.test(source) ? source : html,
        googleRating: parsed.headerRating || undefined,
        googleReviewsCount: parsed.headerCount || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      importedCount: saved.length,
      rating: parsed.headerRating,
      reviewsCount: parsed.headerCount,
      testimonials: saved,
    });
  } catch (error: any) {
    console.error("[google-widget-import] Erro ao importar avaliações do widget:", error);
    return NextResponse.json({ error: error.message || "Erro ao importar avaliações do widget." }, { status: 500 });
  }
}
