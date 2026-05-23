import { NextResponse } from "next/server";
import prisma, { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * API para checar se o aplicativo de agendamento já está inicializado.
 * Utiliza a verificação de ambiente isDatabaseConfigured e o proxy dinâmico.
 */
export async function GET() {
  const configured = isDatabaseConfigured();

  // Se já está configurado no ambiente, consideramos o app instalado definitivamente.
  // Isso protege o aplicativo de solicitar reinstalações se o banco estiver inativo ou com falhas de rede.
  if (configured) {
    try {
      // Tenta consultar para verificar se as tabelas já foram criadas e estão funcionais
      const settings = await prisma.systemSettings.findFirst({
        where: { id: "default" },
      });

      if (settings && settings.adminPassword) {
        return NextResponse.json({ initialized: true, configured: true });
      }
    } catch (e) {
      console.warn("[install-check] DATABASE_URL ativa nas env vars mas tabelas não respondem (banco pausado ou offline):", e);
      // Retorna initialized: true para travar o Wizard inicial e instruir o redirecionamento
      return NextResponse.json({ 
        initialized: true, 
        configured: true,
        databaseOffline: true,
        reason: "DATABASE_URL ativa no servidor, mas banco está inacessível ou inativo temporariamente" 
      });
    }

    // Se a DATABASE_URL está configurada mas as tabelas não foram criadas (ex: instalador interrompido),
    // retorna initialized: false para permitir a aplicação final do schema
    return NextResponse.json({
      initialized: false,
      configured: true,
      reason: "DATABASE_URL configurada mas tabelas vazias no banco"
    });
  }

  // Se não possui nenhuma DATABASE_URL configurada (estado virgem), deve rodar o Wizard do início
  return NextResponse.json({
    initialized: false,
    configured: false,
    reason: "DATABASE_URL não configurada no ambiente"
  });
}

