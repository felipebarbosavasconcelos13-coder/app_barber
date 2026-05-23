import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import prisma from "@/lib/prisma";
import GTM from "@/components/GTM";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barbearia Premium - Agendamento Online",
  description: "Reserve seu horário com os melhores profissionais de forma rápida e prática.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Busca o ID do GTM das configurações do sistema do banco
  let gtmId: string | null = null;
  let themeVars: React.CSSProperties = {};
  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });
    gtmId = settings?.gtmId || null;
    if (settings) {
      themeVars = {
        "--accent-gold": settings.colorAccentGold || "#c5a880",
        "--bg-primary": settings.colorBgPrimary || "#0a0a0c",
        "--bg-secondary": settings.colorBgSecondary || "#121216",
        "--bg-tertiary": settings.colorBgTertiary || "#1b1b22",
      } as React.CSSProperties;
    }
  } catch (error) {
    console.error("Erro ao buscar GTM ID no layout:", error);
  }

  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={themeVars}>
        <GTM gtmId={gtmId} />
        {children}
      </body>
    </html>
  );
}
