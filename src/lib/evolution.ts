/**
 * Módulo de Integração com a Evolution API para envio de mensagens via WhatsApp.
 * Baseado no cliente de integração do CRM parceiro.
 */

interface SendWhatsappInput {
  phone: string;
  message: string;
}

/**
 * Limpa e formata o número de telefone para o padrão exigido pelo WhatsApp/Evolution API.
 * Garante que apenas números sejam enviados e que possua o DDI (55 para Brasil).
 */
export function formatPhoneNumber(phone: string): string {
  // Remove todos os caracteres que não são dígitos
  let cleaned = phone.replace(/\D/g, "");

  // Se estiver vazio, retorna
  if (!cleaned) return "";

  // Se o número tiver 8 ou 9 dígitos, provavelmente é um número local sem DDD.
  // Como precisamos do DDD, assumimos que se tiver menos de 10 dígitos, não podemos garantir o envio
  // Se tiver 10 ou 11 dígitos (DDD + Número), adicionamos o DDI 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }

  // A Evolution API e o WhatsApp esperam que o número de celular brasileiro possua o DDI 55
  // Alguns números possuem ou não o nono dígito (especialmente com DDI 55).
  // A Evolution API geralmente resolve isso, mas o formato ideal é "55DDD9XXXXXXXX" ou "55DDDX XXXXXXX"
  return cleaned;
}

/**
 * Envia uma mensagem de texto pelo WhatsApp utilizando a Evolution API.
 */
export async function sendWhatsappNotification(input: SendWhatsappInput): Promise<{
  ok: boolean;
  status: number;
  message?: string;
  error?: string;
}> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, ""); // Remove barra final se houver
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  // Se a API não estiver configurada no .env, silencia o erro e retorna uma mensagem informativa
  if (!baseUrl || !apiKey || !instance) {
    console.warn(
      "[evolution-api] Notificação de WhatsApp não enviada: credenciais não configuradas no arquivo .env"
    );
    return {
      ok: false,
      status: 409,
      error: "Evolution API não configurada no arquivo .env",
    };
  }

  const formattedPhone = formatPhoneNumber(input.phone);
  if (!formattedPhone) {
    console.warn(`[evolution-api] Número de telefone inválido para envio: "${input.phone}"`);
    return {
      ok: false,
      status: 400,
      error: "Número de telefone inválido",
    };
  }

  try {
    const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
    console.log(`[evolution-api] Enviando WhatsApp para ${formattedPhone} via ${url}...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: input.message,
        delay: 0,
      }),
      cache: "no-store",
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMsg =
        payload?.message ||
        payload?.error ||
        `Erro HTTP ${response.status} ao enviar mensagem.`;
      console.error(`[evolution-api] Erro ao enviar mensagem:`, errorMsg, payload);
      return {
        ok: false,
        status: response.status,
        error: errorMsg,
      };
    }

    console.log(`[evolution-api] Mensagem enviada com sucesso para ${formattedPhone}!`);
    return {
      ok: true,
      status: 200,
      message: "Mensagem enviada com sucesso",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao acessar Evolution API.";
    console.error(`[evolution-api] Falha de conexão:`, message);
    return {
      ok: false,
      status: 502,
      error: `Falha de conexão com a API: ${message}`,
    };
  }
}
