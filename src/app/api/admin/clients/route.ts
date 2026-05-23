import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ClientAggregate {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  totalSpent: number;
  bookingsCount: number;
  lastBookingDate: string;
  lastService: string;
  daysSinceLast: number;
  hasFutureBooking: boolean;
}

export async function GET(request: NextRequest) {
  // 1. Verifica autenticação do administrador
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    // 2. Busca todos os agendamentos com seus respectivos serviços associados
    const bookings = await prisma.booking.findMany({
      include: {
        service: {
          select: {
            name: true,
            price: true,
          },
        },
      },
      orderBy: {
        dateTime: "desc", // Ordena por data decrescente (o agendamento mais recente vem primeiro)
      },
    });

    const clientsMap = new Map<string, ClientAggregate>();
    const now = new Date();

    // 3. Processa e agrupa os agendamentos por telefone único do cliente
    for (const booking of bookings) {
      const phone = booking.clientPhone.trim();
      const bookingPrice = booking.service?.price || 0;
      const isFuture = new Date(booking.dateTime) > now;

      if (!clientsMap.has(phone)) {
        // Como a query está em ordem descrescente, o primeiro registro deste telefone é a visita mais recente
        clientsMap.set(phone, {
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          clientPhone: phone,
          totalSpent: bookingPrice,
          bookingsCount: 1,
          lastBookingDate: booking.dateTime.toISOString(),
          lastService: booking.service?.name || "Desconhecido",
          daysSinceLast: 0,
          hasFutureBooking: isFuture,
        });
      } else {
        const existing = clientsMap.get(phone)!;
        existing.totalSpent += bookingPrice;
        existing.bookingsCount += 1;
        if (isFuture) {
          existing.hasFutureBooking = true;
        }
      }
    }

    const clientsList: ClientAggregate[] = [];

    // 4. Calcula o número de dias sem retornar de cada cliente
    for (const client of clientsMap.values()) {
      const lastDate = new Date(client.lastBookingDate);
      
      if (client.hasFutureBooking || lastDate > now) {
        // Se tem agendamento ativo no futuro, dias sem retornar é zerado
        client.daysSinceLast = 0;
      } else {
        // Calcula a diferença em dias entre hoje e a última visita
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        client.daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
      
      clientsList.push(client);
    }

    // 5. Ordena por valor total gasto de forma decrescente por padrão (clientes que mais gastam no topo)
    clientsList.sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json(clientsList);
  } catch (error) {
    console.error("[api-admin-clients] Erro ao processar lista de clientes:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao processar clientes." }, { status: 500 });
  }
}
