import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Busca as configurações do sistema para obter a senha admin
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });

    const correctPassword = settings?.adminPassword || "admin123";

    if (password === correctPassword) {
      const response = NextResponse.json({ success: true });
      
      // Define o cookie HttpOnly de sessão administrativa
      response.cookies.set("admin_session", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 1 dia
        path: "/",
      });
      
      return response;
    }

    return NextResponse.json(
      { error: "Senha administrativa incorreta." },
      { status: 401 }
    );
  } catch (error) {
    console.error("Erro no login admin:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
