import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PendingReengagement {
  bookingId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  lastBookingDate: string;
  lastService: string;
  daysSinceLast: number;
}

export async function GET(request: NextRequest) {
  // 1. Verifica autenticação administrativa
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    // 2. Carrega as configurações de automação (para obter o número de dias)
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: {
        whatsappReengagementDays: true,
        whatsappReengagementEnabled: true,
      },
    });

    const daysLimit = settings?.whatsappReengagementDays ?? 30;
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - daysLimit); // Data limite (ex: 30 dias atrás)

    // 3. Busca todos os agendamentos ordenados por data descrescente (do mais recente para o mais antigo)
    const bookings = await prisma.booking.findMany({
      include: {
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
      orderBy: {
        dateTime: "desc",
      },
    });

    // Mapa para consolidar os agendamentos de cada cliente
    const clientLatestBookings = new Map<string, typeof bookings[number]>();
    const clientsWithFutureBookings = new Set<string>();

    // 4. Separa os clientes por agendamentos futuros vs última visita no passado
    for (const booking of bookings) {
      const phone = booking.clientPhone.trim();
      const bookingDate = new Date(booking.dateTime);

      if (bookingDate > now) {
        // Se possui agendamento futuro, registra
        clientsWithFutureBookings.add(phone);
      } else {
        // Se for no passado, e ainda não temos registro (como a lista é descrescente, o primeiro é a última visita real)
        if (!clientLatestBookings.has(phone)) {
          clientLatestBookings.set(phone, booking);
        }
      }
    }

    const pendingList: PendingReengagement[] = [];

    // 5. Filtra os clientes que estão ausentes há mais de X dias e pendentes de disparo
    for (const [phone, booking] of clientLatestBookings.entries()) {
      // Regra A: Se o cliente tem agendamento futuro ativo, não reengajar
      if (clientsWithFutureBookings.has(phone)) continue;

      // Regra B: Se já foi enviado o lembrete para a última visita, não duplicar
      if (booking.reengagementSent) continue;

      const lastDate = new Date(booking.dateTime);

      // Regra C: O agendamento deve ser mais antigo que o limite de dias configurado
      if (lastDate < limitDate) {
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        pendingList.push({
          bookingId: booking.id,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          clientPhone: phone,
          lastBookingDate: booking.dateTime.toISOString(),
          lastService: booking.service?.name || "Desconhecido",
          daysSinceLast,
        });
      }
    }

    // Ordena do cliente mais ausente para o menos ausente
    pendingList.sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    return NextResponse.json(pendingList);
  } catch (error) {
    console.error("[api-admin-automations-pending] Erro ao buscar pendentes:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao processar pendências." }, { status: 500 });
  }
}
