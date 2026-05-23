import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

function extractPlaceId(input: string) {
  try {
    const url = new URL(input);
    return url.searchParams.get("place_id") || url.searchParams.get("query_place_id") || "";
  } catch {
    return "";
  }
}

function googleStatusHint(status?: string, errorMessage?: string) {
  if (errorMessage) return errorMessage;
  switch (status) {
    case "REQUEST_DENIED":
      return "Requisição negada. Verifique se a Places API está ativada, se a chave não está restrita incorretamente e se o faturamento do Google Cloud está ativo.";
    case "INVALID_REQUEST":
      return "Requisição inválida. Informe um Place ID válido ou confira nome/endereço do estabelecimento.";
    case "ZERO_RESULTS":
      return "Nenhum estabelecimento encontrado. Informe o Place ID manualmente para testar com precisão.";
    case "OVER_QUERY_LIMIT":
      return "Limite de cota excedido ou faturamento indisponível no Google Cloud.";
    case "NOT_FOUND":
      return "Place ID não encontrado pelo Google.";
    default:
      return `Status retornado pelo Google: ${status || "sem status"}.`;
  }
}

async function resolvePlaceId(apiKey: string, settings: any) {
  const configuredPlaceId = String(settings.googlePlaceId || "").trim();
  if (configuredPlaceId) {
    return { placeId: configuredPlaceId, source: "Place ID informado manualmente" };
  }

  const urlPlaceId = extractPlaceId(String(settings.googleMapsEmbedUrl || ""));
  if (urlPlaceId) {
    return { placeId: urlPlaceId, source: "Place ID extraído do link do Maps" };
  }

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
    throw new Error(googleStatusHint(data.status, data.error_message));
  }

  return {
    placeId: data.candidates[0].place_id as string,
    source: `Resolvido por nome/endereço (${query})`,
  };
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await prisma.systemSettings.findFirst({ where: { id: "default" } });
    if (!settings) {
      return NextResponse.json({ error: "Configurações não encontradas." }, { status: 404 });
    }

    const testSettings = { ...settings, ...body };
    const apiKey = String(testSettings.googlePlacesApiKey || "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Informe uma Google Places API Key para testar." }, { status: 400 });
    }

    const resolved = await resolvePlaceId(apiKey, testSettings);
    const params = new URLSearchParams({
      place_id: resolved.placeId,
      fields: "name,rating,user_ratings_total,reviews",
      reviews_sort: "newest",
      language: "pt-BR",
      key: apiKey,
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
    const data = await response.json();

    if (data.status !== "OK") {
      return NextResponse.json({
        success: false,
        placeId: resolved.placeId,
        error: googleStatusHint(data.status, data.error_message),
        status: data.status || "UNKNOWN",
      }, { status: 400 });
    }

    const result = data.result || {};
    const reviews = Array.isArray(result.reviews) ? result.reviews : [];

    return NextResponse.json({
      success: true,
      message: "Google Places API funcionando corretamente.",
      placeId: resolved.placeId,
      placeIdSource: resolved.source,
      name: result.name || "",
      rating: Number(result.rating) || 0,
      reviewsCount: Number(result.user_ratings_total) || 0,
      reviewsWithText: reviews.filter((review: any) => review.text).length,
      reviewsReturned: reviews.length,
    });
  } catch (error: any) {
    console.error("[google-reviews-test] Erro ao testar Google Places:", error);
    return NextResponse.json({ error: error.message || "Erro ao testar Google Places API." }, { status: 500 });
  }
}
