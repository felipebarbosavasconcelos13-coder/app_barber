import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Função para obter a string de conexão atualizada do banco, lendo do disco se necessário
const getLiveDatabaseUrl = (): string => {
  let dbUrl = process.env.DATABASE_URL;

  // 1. Tenta ler o .env físico em disco para ver se já foi atualizado pelo instalador
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/^DATABASE_URL="(.+)"/m);
      if (match && match[1] && !match[1].includes("[SENHA_DO_BANCO]") && !match[1].includes("[ID_DO_PROJETO]")) {
        dbUrl = match[1];
        process.env.DATABASE_URL = dbUrl; // Sincroniza em runtime
      }
    }
  } catch (err) {
    console.warn("[prisma-client] Erro ao ler .env do disco em runtime:", err);
  }

  // 2. Se a URL final ainda contiver placeholders ou colchetes inválidos do template original,
  // retorna uma URI padrão e válida sintaticamente para evitar que o pg lance a exceção ERR_INVALID_URL
  if (
    !dbUrl ||
    dbUrl.includes("[SENHA_DO_BANCO]") ||
    dbUrl.includes("[ID_DO_PROJETO]") ||
    dbUrl.includes("[") ||
    dbUrl.includes("]")
  ) {
    return "postgresql://postgres:postgres@localhost:5432/postgres";
  }

  return dbUrl;
};

// Função para checar se a DATABASE_URL real do banco está configurada de forma definitiva no servidor
export const isDatabaseConfigured = (): boolean => {
  let dbUrl = process.env.DATABASE_URL;

  // Tenta ler o .env físico em disco
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/^DATABASE_URL="(.+)"/m);
      if (match && match[1] && !match[1].includes("[SENHA_DO_BANCO]") && !match[1].includes("[ID_DO_PROJETO]") && !match[1].includes("[")) {
        dbUrl = match[1];
      }
    }
  } catch {}

  if (
    !dbUrl ||
    dbUrl.includes("[SENHA_DO_BANCO]") ||
    dbUrl.includes("[ID_DO_PROJETO]") ||
    dbUrl.includes("[") ||
    dbUrl.includes("]") ||
    dbUrl.includes("localhost:5432/postgres")
  ) {
    return false;
  }

  return true;
};

// Declaração de propriedades globais para armazenar as referências ativas
declare global {
  var prismaGlobal: undefined | PrismaClient;
  var prismaDbUrlGlobal: undefined | string;
}

// Retorna ou cria a instância ativa do PrismaClient
const getPrismaInstance = (): PrismaClient => {
  const currentUrl = getLiveDatabaseUrl();

  // Se a URL mudou em tempo de execução, desconecta o cliente anterior para evitar vazamentos e força a reinicialização
  if (globalThis.prismaGlobal && globalThis.prismaDbUrlGlobal !== currentUrl) {
    console.log("[prisma-client] Detectada alteração na DATABASE_URL. Reinicializando pool de conexões...");
    try {
      globalThis.prismaGlobal.$disconnect().catch(() => {});
    } catch {}
    globalThis.prismaGlobal = undefined;
  }

  if (!globalThis.prismaGlobal) {
    const cleanUrl = currentUrl.split("?")[0];
    const hasSsl = currentUrl.includes("sslmode=require") || 
                   currentUrl.includes("ssl=true") || 
                   currentUrl.includes("supabase.co") || 
                   currentUrl.includes("supabase.com");

    // Instancia o Pool de conexões do pg de forma resiliente
    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    // Auto-migração para garantir que a tabela BarberBlock existe no banco
    ensureBarberBlockTableExists(pool).catch((err) => {
      console.error("[prisma-client] Erro na auto-migração de BarberBlock:", err);
    });

    const adapter = new PrismaPg(pool);
    globalThis.prismaGlobal = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    globalThis.prismaDbUrlGlobal = currentUrl;
  }

  return globalThis.prismaGlobal;
};

// Função auxiliar assíncrona de auto-migração do banco em runtime
async function ensureBarberBlockTableExists(pool: Pool) {
  const ddl = `
    CREATE TABLE IF NOT EXISTS "BarberBlock" (
      "id" TEXT NOT NULL,
      "barberId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BarberBlock_pkey" PRIMARY KEY ("id")
    );

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BarberBlock_barberId_fkey'
      ) THEN
        ALTER TABLE "BarberBlock" ADD CONSTRAINT "BarberBlock_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;

    -- Patches de Migração Retrocompatível para Automações de WhatsApp
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappConfirmationEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappConfirmationTemplate" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Seu agendamento de *{servico}* com o profissional *{barbeiro}* foi confirmado para o dia *{data}* às *{horario}*. Valor: *{valor}*. Esperamos você!';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappReengagementEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappReengagementDays" INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappReengagementTemplate" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Faz *{dias}* dias desde o seu último serviço de *{servico}* com a gente. Que tal agendar um novo horário para manter o visual em dia? Agende no link: {link_app}';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappReminderEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "whatsappReminderTemplate" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Passando para lembrar que seu horário de *{servico}* com o profissional *{barbeiro}* está agendado para hoje às *{horario}*. Esperamos você!';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "aboutText" TEXT NOT NULL DEFAULT 'Ambiente climatizado com estacionamento privativo, café gourmet e cerveja gelada esperando por você. Cada detalhe foi planejado para transformar o seu corte de cabelo em um momento exclusivo de relaxamento.';

    ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reengagementSent" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT FALSE;

    -- Fase 25: Integração Google, Testimonials CRUD & Maps Embeds
    CREATE TABLE IF NOT EXISTS "Testimonial" (
      "id" TEXT NOT NULL,
      "authorName" TEXT NOT NULL,
      "rating" INTEGER NOT NULL DEFAULT 5,
      "content" TEXT NOT NULL,
      "avatarUrl" TEXT DEFAULT '',
      "source" TEXT NOT NULL DEFAULT 'Google',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
    );
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleMapsEmbedUrl" TEXT DEFAULT '';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleReviewsWidget" TEXT DEFAULT '';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googlePlacesApiKey" TEXT DEFAULT '';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT DEFAULT '';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleRating" DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleReviewsCount" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "colorAccentGold" TEXT NOT NULL DEFAULT '#c5a880';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "colorBgPrimary" TEXT NOT NULL DEFAULT '#0a0a0c';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "colorBgSecondary" TEXT NOT NULL DEFAULT '#121216';
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "colorBgTertiary" TEXT NOT NULL DEFAULT '#1b1b22';

    -- Adicionado na Fase 36: Upload de Fotos de Barbeiros
    ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT DEFAULT '';
  `;
  try {
    await pool.query(ddl);
    console.log("[prisma-client] Auto-migração executada: Tabela BarberBlock, colunas SystemSettings e Booking garantidas!");
  } catch (err) {
    console.error("[prisma-client] Falha ao rodar auto-migração:", err);
  }
}


// Exportamos um Proxy dinâmico para o PrismaClient.
// Isso garante que todas as referências de importação direta continuem funcionando,
// mas intercepta as chamadas para usar sempre a instância conectada ao banco de dados real.
const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const instance = getPrismaInstance();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  }
});

export default prisma;
