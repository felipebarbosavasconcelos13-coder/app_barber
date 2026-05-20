import { google } from "googleapis";

// Escopos necessários para acessar e gerenciar o calendário do Google do barbeiro
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

/**
 * Cria e configura um cliente OAuth2 com as credenciais do Google Cloud
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Variáveis de ambiente do Google OAuth ausentes!");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Gera a URL para o barbeiro autorizar o acesso ao seu Google Calendar
 * @param barberId ID do barbeiro que está fazendo a conexão (passado via state)
 */
export function getAuthUrl(barberId: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // Solicita o refresh_token crucial para conexões de segundo plano
    scope: SCOPES,
    prompt: "consent", // Força a exibição da tela de consentimento para garantir o refresh_token
    state: barberId, // Passamos o ID do barbeiro no state para identificar no callback
  });
}

/**
 * Obtém os tokens (access_token, refresh_token, etc.) a partir do código do Google Callback
 * @param code Código retornado pelo Google na URL de callback
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Retorna um cliente do Google Calendar configurado e autenticado para o barbeiro
 */
export function getGoogleCalendarClient(accessToken: string, refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

interface TimeSlot {
  start: string; // Formato "HH:MM"
  end: string;
  dateTime: string; // Formato ISO completo
}

/**
 * Consulta a agenda do barbeiro e calcula quais slots de tempo estão disponíveis para agendamento
 */
export async function getBarberAvailableSlots(
  barberTokens: { googleAccessToken: string | null; googleRefreshToken: string | null },
  selectedDate: Date, // Data selecionada pelo cliente (sem hora, ex: YYYY-MM-DDT00:00:00.000Z)
  openingTime: string, // "09:00"
  closingTime: string, // "19:00"
  serviceDuration: number // Duração em minutos (ex: 30)
): Promise<TimeSlot[]> {
  const { googleAccessToken, googleRefreshToken } = barberTokens;

  // Se o barbeiro não conectou o Google Calendar, retornamos todos os horários padrão livres do expediente
  const useGoogle = googleAccessToken && googleRefreshToken;

  // Ajusta o início e fim do dia para a data selecionada na timezone local do servidor
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();

  // Horário de abertura da barbearia na data selecionada
  const [opHour, opMin] = openingTime.split(":").map(Number);
  const startExpediente = new Date(year, month, day, opHour, opMin, 0);

  // Horário de fechamento da barbearia
  const [clHour, clMin] = closingTime.split(":").map(Number);
  const endExpediente = new Date(year, month, day, clHour, clMin, 0);

  const now = new Date(); // Para não permitir agendamentos no passado

  // Se a data selecionada for hoje, o primeiro slot disponível deve ser após o horário atual
  const startTime = startExpediente < now ? now : startExpediente;

  // Lista para guardar os slots ocupados do Google
  let busyIntervals: { start: Date; end: Date }[] = [];

  if (useGoogle && googleAccessToken && googleRefreshToken) {
    try {
      const calendar = getGoogleCalendarClient(googleAccessToken, googleRefreshToken);

      // Limites de busca para a API do Google (do início do expediente ao fim do expediente do dia)
      const timeMin = startExpediente.toISOString();
      const timeMax = endExpediente.toISOString();

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: [{ id: "primary" }],
        },
      });

      const busy = response.data.calendars?.primary?.busy || [];
      busyIntervals = busy.map((interval) => ({
        start: new Date(interval.start || ""),
        end: new Date(interval.end || ""),
      }));
    } catch (error) {
      console.error("Erro ao consultar a API Google Calendar FreeBusy:", error);
      // Fallback: prossegue sem os bloqueios do Google para não quebrar a experiência do cliente
    }
  }

  // Geração de slots de tempo de 15 em 15 minutos (ou baseado na duração do serviço)
  const slots: TimeSlot[] = [];
  const slotStepMinutes = 15; // Intervalo entre cada opção de horário de início disponível
  
  let currentSlotStart = new Date(startTime);
  
  // Alinha o horário atual para o próximo múltiplo de 15 minutos (para fins estéticos e organização)
  const minutes = currentSlotStart.getMinutes();
  const remainder = minutes % slotStepMinutes;
  if (remainder > 0) {
    currentSlotStart.setMinutes(minutes + (slotStepMinutes - remainder));
    currentSlotStart.setSeconds(0);
    currentSlotStart.setMilliseconds(0);
  }

  while (currentSlotStart < endExpediente) {
    const currentSlotEnd = new Date(currentSlotStart.getTime() + serviceDuration * 60000);

    // Se o término do serviço ultrapassar o horário de fechamento, encerra a busca
    if (currentSlotEnd > endExpediente) {
      break;
    }

    // Verifica se este slot colide com algum intervalo ocupado do Google Calendar
    const isBusy = busyIntervals.some((busy) => {
      // Duas faixas de tempo [A, B] e [C, D] se sobrepõem se A < D e C < B
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

    // Incrementa para a próxima opção de horário de início (passo de 15 min)
    currentSlotStart = new Date(currentSlotStart.getTime() + slotStepMinutes * 60000);
  }

  return slots;
}

/**
 * Cria um evento de agendamento no Google Calendar do barbeiro
 */
export async function createGoogleCalendarEvent(
  barberTokens: { googleAccessToken: string; googleRefreshToken: string },
  booking: {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    serviceName: string;
    price: number;
    startDateTime: Date;
    durationMinutes: number;
  }
): Promise<string | null> {
  const { googleAccessToken, googleRefreshToken } = barberTokens;
  const calendar = getGoogleCalendarClient(googleAccessToken, googleRefreshToken);

  const start = booking.startDateTime;
  const end = new Date(start.getTime() + booking.durationMinutes * 60000);

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all", // Envia notificação por e-mail para o barbeiro e o cliente
      requestBody: {
        summary: `💈 Agendamento: ${booking.clientName} - ${booking.serviceName}`,
        description: `Agendamento feito via App Online da Barbearia.\n\n` +
          `👤 Cliente: ${booking.clientName}\n` +
          `📧 E-mail: ${booking.clientEmail}\n` +
          `📞 Telefone: ${booking.clientPhone}\n` +
          `✂ Serviço: ${booking.serviceName}\n` +
          `💵 Preço: R$ ${booking.price.toFixed(2)}`,
        start: {
          dateTime: start.toISOString(),
          timeZone: "America/Sao_Paulo", // Timezone padrão do Brasil
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        attendees: [
          { email: booking.clientEmail, displayName: booking.clientName }
        ],
      },
    });

    return response.data.id || null;
  } catch (error) {
    console.error("Erro ao criar evento no Google Calendar:", error);
    return null;
  }
}
