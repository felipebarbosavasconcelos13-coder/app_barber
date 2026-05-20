import { NextRequest } from "next/server";

/**
 * Verifica se a requisição possui um cookie de sessão administrativa válido
 */
export function isAdminAuthenticated(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get("admin_session")?.value;
  return sessionCookie === "true";
}
