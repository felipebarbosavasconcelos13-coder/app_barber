const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("dotenv").config();

console.log("DATABASE_URL no seed:", process.env.DATABASE_URL);

const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

const cleanUrl = databaseUrl.split("?")[0];
const hasSsl = databaseUrl.includes("sslmode=require") || 
               databaseUrl.includes("ssl=true") || 
               databaseUrl.includes("supabase.co") || 
               databaseUrl.includes("supabase.com");

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // 1. Configurações do Sistema
  const settings = await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      gtmId: "", // Vazio por padrão, barbeiro configura depois
      openingTime: "09:00",
      closingTime: "19:00",
      adminPassword: "admin123", // Senha admin padrão
    },
  });
  console.log("Configurações do sistema inseridas/atualizadas:", settings);

  // 2. Serviços Iniciais
  const servicesData = [
    { name: "Corte de Cabelo Masculino", price: 45.0, duration: 30 },
    { name: "Barba Completa", price: 30.0, duration: 30 },
    { name: "Combo Corte + Barba", price: 70.0, duration: 60 },
    { name: "Sobrancelha na Navalha", price: 15.0, duration: 15 },
  ];

  console.log("Verificando serviços iniciais...");
  for (const service of servicesData) {
    // Verifica se já existe um serviço com este nome para evitar duplicados
    const existing = await prisma.service.findFirst({
      where: { name: service.name },
    });

    if (!existing) {
      const created = await prisma.service.create({
        data: service,
      });
      console.log(`Serviço cadastrado: ${created.name} (${created.duration} min - R$ ${created.price})`);
    } else {
      console.log(`Serviço já existente: ${existing.name}`);
    }
  }

  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
