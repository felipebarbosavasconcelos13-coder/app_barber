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

    const adapter = new PrismaPg(pool);
    globalThis.prismaGlobal = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    globalThis.prismaDbUrlGlobal = currentUrl;
  }

  return globalThis.prismaGlobal;
};

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

