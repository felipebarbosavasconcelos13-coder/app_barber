import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Limpa o cookie de sessão administrativa definindo a data de expiração para o passado
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  
  return response;
}
