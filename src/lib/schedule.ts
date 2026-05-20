import prisma from "@/lib/prisma";

export interface TimeSlot {
  start: string;
  end: string;
  dateTime: string;
}

/**
 * Calcula os slots de horario disponiveis para um barbeiro em uma data,
 * considerando os horarios customizados do barbeiro e os agendamentos locais existentes.
 */
export async function getBarberAvailableSlots(
  barberId: string,
  selectedDate: Date,
  serviceDuration: number
): Promise<TimeSlot[]> {
  const barber = await prisma.barber.findUnique({
    where: { id: barberId },
  });

  if (!barber) return [];

  const openingTime = barber.openingTime || "09:00";
  const closingTime = barber.closingTime || "19:00";

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();

  const [opHour, opMin] = openingTime.split(":").map(Number);
  const startExpediente = new Date(year, month, day, opHour, opMin, 0);

  const [clHour, clMin] = closingTime.split(":").map(Number);
  const endExpediente = new Date(year, month, day, clHour, clMin, 0);

  const now = new Date();
  const startTime = startExpediente < now ? now : startExpediente;

  // Busca agendamentos locais do barbeiro na data selecionada
  const startOfDay = new Date(year, month, day, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59);

  const bookings = await prisma.booking.findMany({
    where: {
      barberId: barberId,
      dateTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      service: {
        select: { duration: true },
      },
    },
  });

  const busyIntervals = bookings.map((booking) => {
    const start = new Date(booking.dateTime);
    const end = new Date(start.getTime() + (booking.service?.duration || 30) * 60000);
    return { start, end };
  });

  const slots: TimeSlot[] = [];
  const slotStepMinutes = 15;

  let currentSlotStart = new Date(startTime);

  const minutes = currentSlotStart.getMinutes();
  const remainder = minutes % slotStepMinutes;
  if (remainder > 0) {
    currentSlotStart.setMinutes(minutes + (slotStepMinutes - remainder));
    currentSlotStart.setSeconds(0);
    currentSlotStart.setMilliseconds(0);
  }

  while (currentSlotStart < endExpediente) {
    const currentSlotEnd = new Date(currentSlotStart.getTime() + serviceDuration * 60000);

    if (currentSlotEnd > endExpediente) {
      break;
    }

    const isBusy = busyIntervals.some((busy) => {
      return currentSlotStart < busy.end && busy.start < currentSlotEnd;
    });

    if (!isBusy) {
      const startHourStr = String(currentSlotStart.getHours()).padStart(2, "0");
      const startMinStr = String(currentSlotStart.getMinutes()).padStart(2, "0");
      const endHourStr = String(currentSlotEnd.getHours()).padStart(2, "0");
      const endMinStr = String(currentSlotEnd.getMinutes()).padStart(2, "0");

      slots.push({
        start: `${startHourStr}:${startMinStr}`,
        end: `${endHourStr}:${endMinStr}`,
        dateTime: currentSlotStart.toISOString(),
      });
    }

    currentSlotStart = new Date(currentSlotStart.getTime() + slotStepMinutes * 60000);
  }

  return slots;
}
