/**
 * Módulo de Integração com a Evolution API para envio de mensagens via WhatsApp.
 * Baseado no cliente de integração robusto e resiliente.
 */

import prisma from "./prisma";

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
  // Como precisamos do DDD, assumimos que se tiver menos de 10 dígitos, não podemos garantir o envio.
  // Se tiver 10 ou 11 dígitos (DDD + Número), adicionamos o DDI 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }

  // A Evolution API e o WhatsApp esperam que o número de celular brasileiro possua o DDI 55
  return cleaned;
}

/**
 * Normaliza a URL (remove barras finais) e auto-corrige preenchimento invertido de URL/Instância do usuário.
 */
export function normalizeEvolutionConfig(url: string, apiKey: string, instance: string) {
  let normalizedUrl = (url || "").trim();
  let normalizedApiKey = (apiKey || "").trim();
  let normalizedInstance = (instance || "").trim();

  // Correção de inputs invertidos: se a instância contém "http://" ou "https://",
  // e a URL não contém, é bem provável que o usuário inverteu os campos!
  if (
    (normalizedInstance.startsWith("http://") || normalizedInstance.startsWith("https://")) &&
    !(normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://"))
  ) {
    const temp = normalizedUrl;
    normalizedUrl = normalizedInstance;
    normalizedInstance = temp;
  }

  // Remove barra final da URL se houver
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

  return {
    url: normalizedUrl,
    apiKey: normalizedApiKey,
    instance: normalizedInstance,
  };
}

/**
 * Captura mensagens de erro amigáveis percorrendo até 8 chaves profundas dos retornos de erro da API.
 */
export function extractEvolutionError(payload: any, defaultMessage: string = "Erro desconhecido na API."): string {
  if (!payload) return defaultMessage;
  if (typeof payload === "string") return payload;

  if (payload.message && typeof payload.message === "string") return payload.message;
  if (payload.error && typeof payload.error === "string") return payload.error;
  if (payload.response?.message && typeof payload.response.message === "string") return payload.response.message;
  if (payload.response?.error && typeof payload.response.error === "string") return payload.response.error;
  if (payload.data?.message && typeof payload.data.message === "string") return payload.data.message;
  if (payload.data?.error && typeof payload.data.error === "string") return payload.data.error;
  if (payload.err?.message && typeof payload.err.message === "string") return payload.err.message;
  if (payload.err?.error && typeof payload.err.error === "string") return payload.err.error;

  if (Array.isArray(payload.message) && payload.message.length > 0) {
    return String(payload.message[0]);
  }

  return defaultMessage;
}

/**
 * Testa se a instância do WhatsApp está online cruzando /instance/connectionState e o fallback /instance/fetchInstances.
 */
export async function checkEvolutionConnection(
  url: string,
  apiKey: string,
  instance: string
): Promise<{ ok: boolean; status: "CONECTADO" | "DESCONECTADO" | "ERRO_CONEXAO"; details?: string }> {
  const config = normalizeEvolutionConfig(url, apiKey, instance);
  if (!config.url || !config.apiKey || !config.instance) {
    return { ok: false, status: "DESCONECTADO", details: "Configurações incompletas de URL, chave API ou Instância." };
  }

  try {
    // Primeiro endpoint: /instance/connectionState/:instance
    const firstUrl = `${config.url}/instance/connectionState/${encodeURIComponent(config.instance)}`;
    console.log(`[evolution-api] Testando status via connectionState: ${firstUrl}`);
    
    const response = await fetch(firstUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      cache: "no-store",
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {}

    if (response.ok && payload) {
      // Retornos típicos da Evolution API
      const state = payload.instance?.state || payload.instance || payload.state || "";
      if (state === "open" || state === "connected" || payload.connectionState === "open") {
        return { ok: true, status: "CONECTADO", details: "WhatsApp conectado e pronto para uso." };
      } else {
        return {
          ok: false,
          status: "DESCONECTADO",
          details: `Instância existe, mas o status é: "${state || "desconectado"}". Escaneie o QR Code no painel do seu servidor Evolution.`,
        };
      }
    }

    // Se o endpoint principal falhou (ex: 404, método indisponível), tentamos o fallback: /instance/fetchInstances
    console.log(`[evolution-api] connectionState falhou (HTTP ${response.status}). Tentando fallback em fetchInstances...`);
    const fallbackUrl = `${config.url}/instance/fetchInstances`;
    
    const fallbackResponse = await fetch(fallbackUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      cache: "no-store",
    });

    let fallbackPayload: any = null;
    try {
      fallbackPayload = await fallbackResponse.json();
    } catch {}

    if (fallbackResponse.ok && Array.isArray(fallbackPayload)) {
      const foundInstance = fallbackPayload.find(
        (inst: any) => inst.name === config.instance || inst.instanceName === config.instance
      );
      if (foundInstance) {
        const state = foundInstance.connectionStatus || foundInstance.status || foundInstance.state || "";
        if (state === "open" || state === "connected" || foundInstance.online === true) {
          return { ok: true, status: "CONECTADO", details: "Instância localizada e ativa (fetchInstances fallback)." };
        }
        return {
          ok: false,
          status: "DESCONECTADO",
          details: `Instância encontrada no servidor, mas está inativa (Status: ${state || "desconectada"}).`,
        };
      } else {
        return {
          ok: false,
          status: "DESCONECTADO",
          details: `A instância "${config.instance}" não foi localizada neste servidor Evolution.`,
        };
      }
    }

    // Se os dois endpoints falharem, extrai o erro descritivo do payload
    const errMsg = extractEvolutionError(payload || fallbackPayload, `Servidor retornou HTTP ${response.status}`);
    return { ok: false, status: "DESCONECTADO", details: `Falha na verificação da API: ${errMsg}` };
  } catch (error: any) {
    return {
      ok: false,
      status: "ERRO_CONEXAO",
      details: `Não foi possível conectar ao servidor da Evolution API: ${error.message || error}`,
    };
  }
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
  let url = "";
  let apiKey = "";
  let instance = "";

  try {
    // Busca as credenciais persistidas no banco de dados
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: {
        evolutionUrl: true,
        evolutionApiKey: true,
        evolutionInstance: true,
      },
    });

    if (settings) {
      url = settings.evolutionUrl || "";
      apiKey = settings.evolutionApiKey || "";
      instance = settings.evolutionInstance || "";
    }
  } catch (dbError) {
    console.error("[evolution-api] Erro ao carregar credenciais do banco, usando fallback do env:", dbError);
  }

  // Fallback para variáveis de ambiente se as credenciais do banco estiverem em branco
  if (!url) url = process.env.EVOLUTION_API_URL || "";
  if (!apiKey) apiKey = process.env.EVOLUTION_API_KEY || "";
  if (!instance) instance = process.env.EVOLUTION_INSTANCE || "";

  // Normaliza e corrige as credenciais
  const config = normalizeEvolutionConfig(url, apiKey, instance);

  if (!config.url || !config.apiKey || !config.instance) {
    console.warn(
      "[evolution-api] Notificação de WhatsApp não enviada: credenciais não configuradas no banco de dados e nem no arquivo .env"
    );
    return {
      ok: false,
      status: 409,
      error: "Evolution API não configurada",
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
    const sendUrl = `${config.url}/message/sendText/${encodeURIComponent(config.instance)}`;
    console.log(`[evolution-api] Enviando WhatsApp para ${formattedPhone} via ${sendUrl}...`);

    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
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
      const errorMsg = extractEvolutionError(payload, `Erro HTTP ${response.status} ao enviar mensagem.`);
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
