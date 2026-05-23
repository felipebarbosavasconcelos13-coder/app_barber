import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type GoogleReview = {
  author_name?: string;
  rating?: number;
  text?: string;
  profile_photo_url?: string;
};

function extractPlaceId(input: string) {
  try {
    const url = new URL(input);
    return url.searchParams.get("place_id") || url.searchParams.get("query_place_id") || "";
  } catch {
    return "";
  }
}

async function resolvePlaceId(apiKey: string, settings: any) {
  const configuredPlaceId = String(settings.googlePlaceId || "").trim();
  if (configuredPlaceId) return configuredPlaceId;

  const urlPlaceId = extractPlaceId(String(settings.googleMapsEmbedUrl || ""));
  if (urlPlaceId) return urlPlaceId;

  const query = [settings.barberShopName, settings.address].filter(Boolean).join(" - ");
  if (!query.trim()) {
    throw new Error("Informe o nome/endereço da barbearia ou o Place ID do Google Maps.");
  }

  const params = new URLSearchParams({
    input: query,
    inputtype: "textquery",
    fields: "place_id,name,rating,user_ratings_total",
    language: "pt-BR",
    key: apiKey,
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.candidates?.[0]?.place_id) {
    throw new Error(data.error_message || `Google Places não encontrou o estabelecimento (${data.status || "sem status"}).`);
  }

  return data.candidates[0].place_id as string;
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const settings = await prisma.systemSettings.findFirst({ where: { id: "default" } });
    if (!settings) {
      return NextResponse.json({ error: "Configurações não encontradas." }, { status: 404 });
    }

    const apiKey = String(settings.googlePlacesApiKey || "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Informe a chave Google Places API ou use a importação por widget sem API." }, { status: 400 });
    }

    const placeId = await resolvePlaceId(apiKey, settings);
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "name,rating,user_ratings_total,reviews",
      reviews_sort: "newest",
      language: "pt-BR",
      key: apiKey,
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
    const data = await response.json();

    if (data.status !== "OK") {
      return NextResponse.json({ error: data.error_message || `Falha ao consultar Google Places (${data.status || "sem status"}).` }, { status: 400 });
    }

    const result = data.result || {};
    const reviews: GoogleReview[] = Array.isArray(result.reviews) ? result.reviews : [];

    await prisma.systemSettings.update({
      where: { id: "default" },
      data: {
        googlePlaceId: placeId,
        googleRating: Number(result.rating) || 0,
        googleReviewsCount: Number(result.user_ratings_total) || 0,
      },
    });

    const saved = [];
    for (const review of reviews.filter((item) => item.author_name && item.text)) {
      const existing = await prisma.testimonial.findFirst({
        where: { authorName: review.author_name!, content: review.text! },
      });

      if (existing) {
        saved.push(existing);
        continue;
      }

      saved.push(await prisma.testimonial.create({
        data: {
          authorName: review.author_name!,
          rating: Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))),
          content: review.text!,
          avatarUrl: review.profile_photo_url || "",
          source: "Google Places",
        },
      }));
    }

    return NextResponse.json({
      success: true,
      placeId,
      rating: Number(result.rating) || 0,
      reviewsCount: Number(result.user_ratings_total) || 0,
      importedCount: saved.length,
      testimonials: saved,
    });
  } catch (error: any) {
    console.error("[google-reviews-sync] Erro ao sincronizar avaliações:", error);
    return NextResponse.json({ error: error.message || "Erro ao sincronizar avaliações do Google Places." }, { status: 500 });
  }
}
