import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Verifica se a requisição é de um administrador autenticado
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    if (!settings) {
      return NextResponse.json({ error: "Configurações não encontradas." }, { status: 404 });
    }

    // Retorna as configurações omitindo a senha do administrador por segurança
    return NextResponse.json({
      gtmId: settings.gtmId || "",
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      barberShopName: settings.barberShopName,
      logoUrl: settings.logoUrl || "",
      address: settings.address,
      phone: settings.phone,
      evolutionUrl: settings.evolutionUrl || "",
      evolutionApiKey: settings.evolutionApiKey || "",
      evolutionInstance: settings.evolutionInstance || "",
      googleMapsEmbedUrl: settings.googleMapsEmbedUrl || "",
      googleReviewsWidget: settings.googleReviewsWidget || "",
      googleRating: settings.googleRating || 0,
      googleReviewsCount: settings.googleReviewsCount || 0,
      colorAccentGold: settings.colorAccentGold || "#c5a880",
      colorBgPrimary: settings.colorBgPrimary || "#0a0a0c",
      colorBgSecondary: settings.colorBgSecondary || "#121216",
      colorBgTertiary: settings.colorBgTertiary || "#1b1b22",
    });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // Verifica se a requisição é de um administrador autenticado
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      gtmId, 
      openingTime, 
      closingTime, 
      barberShopName, 
      logoUrl, 
      address, 
      phone, 
      evolutionUrl,
      evolutionApiKey,
      evolutionInstance,
      googleMapsEmbedUrl,
      googleReviewsWidget,
      googleRating,
      googleReviewsCount,
      colorAccentGold,
      colorBgPrimary,
      colorBgSecondary,
      colorBgTertiary,
      newPassword 
    } = body;

    const updateData: any = {};

    if (gtmId !== undefined) updateData.gtmId = gtmId || "";
    if (openingTime !== undefined) updateData.openingTime = openingTime || "09:00";
    if (closingTime !== undefined) updateData.closingTime = closingTime || "19:00";
    if (barberShopName !== undefined) updateData.barberShopName = barberShopName || "Barbearia Premium";
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || "";
    if (address !== undefined) updateData.address = address || "";
    if (phone !== undefined) updateData.phone = phone || "";
    if (evolutionUrl !== undefined) updateData.evolutionUrl = evolutionUrl || "";
    if (evolutionApiKey !== undefined) updateData.evolutionApiKey = evolutionApiKey || "";
    if (evolutionInstance !== undefined) updateData.evolutionInstance = evolutionInstance || "";
    if (googleMapsEmbedUrl !== undefined) updateData.googleMapsEmbedUrl = googleMapsEmbedUrl || "";
    if (googleReviewsWidget !== undefined) updateData.googleReviewsWidget = googleReviewsWidget || "";
    if (googleRating !== undefined) updateData.googleRating = Number(googleRating) || 0;
    if (googleReviewsCount !== undefined) updateData.googleReviewsCount = Number(googleReviewsCount) || 0;
    if (colorAccentGold !== undefined) updateData.colorAccentGold = colorAccentGold || "#c5a880";
    if (colorBgPrimary !== undefined) updateData.colorBgPrimary = colorBgPrimary || "#0a0a0c";
    if (colorBgSecondary !== undefined) updateData.colorBgSecondary = colorBgSecondary || "#121216";
    if (colorBgTertiary !== undefined) updateData.colorBgTertiary = colorBgTertiary || "#1b1b22";

    // Atualiza a senha administrativa apenas se fornecida
    if (newPassword && newPassword.trim() !== "") {
      updateData.adminPassword = newPassword;
    }

    const updated = await prisma.systemSettings.update({
      where: { id: "default" },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        gtmId: updated.gtmId || "",
        openingTime: updated.openingTime,
        closingTime: updated.closingTime,
        barberShopName: updated.barberShopName,
        logoUrl: updated.logoUrl || "",
        address: updated.address,
        phone: updated.phone,
        evolutionUrl: updated.evolutionUrl || "",
        evolutionApiKey: updated.evolutionApiKey || "",
        evolutionInstance: updated.evolutionInstance || "",
        googleMapsEmbedUrl: updated.googleMapsEmbedUrl || "",
        googleReviewsWidget: updated.googleReviewsWidget || "",
        googleRating: updated.googleRating || 0,
        googleReviewsCount: updated.googleReviewsCount || 0,
        colorAccentGold: updated.colorAccentGold || "#c5a880",
        colorBgPrimary: updated.colorBgPrimary || "#0a0a0c",
        colorBgSecondary: updated.colorBgSecondary || "#121216",
        colorBgTertiary: updated.colorBgTertiary || "#1b1b22",
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
