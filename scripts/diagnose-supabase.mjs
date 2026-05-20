#!/usr/bin/env node
/**
 * Diagnóstico Supabase — verifica via Management API (v1)
 *   • Status do projeto
 *   • Health do banco
 *   • Configuração do Connection Pooler
 *   • Teste de conexão TCP nas portas 5432 e 6543
 *
 * USO:
 *   node scripts/diagnose-supabase.mjs <SUPABASE_ACCESS_TOKEN> <PROJECT_REF>
 *
 * Exemplo:
 *   node scripts/diagnose-supabase.mjs sbp_abc123... tmdtpbscgegtmkldttmq
 */

import { createConnection } from "net";

const API = "https://api.supabase.com";

// ── helpers ──

async function apiFetch(path, token) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

function tcpProbe(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout: timeoutMs }, () => {
      sock.destroy();
      resolve({ reachable: true });
    });
    sock.on("error", (err) => { sock.destroy(); resolve({ reachable: false, error: err.message }); });
    sock.on("timeout", () => { sock.destroy(); resolve({ reachable: false, error: "timeout" }); });
  });
}

function line() { console.log("─".repeat(60)); }

// ── main ──

const [,, token, projectRef] = process.argv;

if (!token || !projectRef) {
  console.error("Uso: node scripts/diagnose-supabase.mjs <SUPABASE_TOKEN> <PROJECT_REF>");
  process.exit(1);
}

console.log();
console.log("🔍 DIAGNÓSTICO SUPABASE");
line();
console.log(`   Projeto: ${projectRef}`);
console.log(`   Token:   ${token.slice(0, 8)}...${token.slice(-4)}`);
line();

// 1. Detalhes do projeto
console.log("\n📦 1. Detalhes do Projeto (GET /v1/projects/:ref)");
const projRes = await apiFetch(`/v1/projects/${projectRef}`, token);
if (!projRes.ok) {
  console.error(`   ❌ Erro ${projRes.status}: ${JSON.stringify(projRes.data)}`);
  process.exit(1);
}
const proj = projRes.data;
console.log(`   Nome:     ${proj.name}`);
console.log(`   Status:   ${proj.status}`);
console.log(`   Região:   ${proj.region}`);
console.log(`   DB Host:  ${proj.database?.host || proj.db_host || "(não informado)"}`);
console.log(`   DB Port:  ${proj.database?.port || "(não informado)"}`);
console.log(`   DB Version: ${proj.database?.version || "(não informado)"}`);

// 2. Health check
console.log("\n🩺 2. Health Check (GET /v1/projects/:ref/health)");
const healthRes = await apiFetch(`/v1/projects/${projectRef}/health`, token);
if (healthRes.ok) {
  const services = Array.isArray(healthRes.data) ? healthRes.data : [healthRes.data];
  for (const svc of services) {
    console.log(`   Serviço: ${svc.name || svc.service || "?"} → ${svc.status || svc.healthy || JSON.stringify(svc)}`);
  }
} else {
  console.log(`   ⚠️  Health endpoint retornou ${healthRes.status}: ${JSON.stringify(healthRes.data)}`);
}

// 3. Database config / pooler
console.log("\n🔗 3. Configuração do Banco e Pooler (GET /v1/projects/:ref/config/database)");
const dbConfigRes = await apiFetch(`/v1/projects/${projectRef}/config/database`, token);
if (dbConfigRes.ok) {
  const cfg = dbConfigRes.data;
  console.log(`   Pool Mode:         ${cfg.pool_mode || "(não informado)"}`);
  console.log(`   Default Pool Size: ${cfg.default_pool_size ?? "(não informado)"}`);
  console.log(`   Max Client Conn:   ${cfg.max_client_conn ?? "(não informado)"}`);
  console.log(`   Dados completos:   ${JSON.stringify(cfg, null, 2).split("\n").join("\n   ")}`);
} else {
  console.log(`   ⚠️  Config endpoint retornou ${dbConfigRes.status}: ${JSON.stringify(dbConfigRes.data)}`);
}

// 4. Pooling config
console.log("\n🏊 4. Pooler Config (GET /v1/projects/:ref/config/database/pooler)");
const poolerCfgRes = await apiFetch(`/v1/projects/${projectRef}/config/database/pooler`, token);
if (poolerCfgRes.ok) {
  const pcfg = poolerCfgRes.data;
  console.log(`   Dados:   ${JSON.stringify(pcfg, null, 2).split("\n").join("\n   ")}`);
} else {
  console.log(`   ⚠️  Pooler config endpoint retornou ${poolerCfgRes.status}: ${JSON.stringify(poolerCfgRes.data)}`);
}

// 5. Postgrest config (valida se o PostgREST/API está operacional)
console.log("\n🌐 5. PostgREST Config (GET /v1/projects/:ref/config/postgrest)");
const pgrestRes = await apiFetch(`/v1/projects/${projectRef}/config/postgrest`, token);
if (pgrestRes.ok) {
  const pg = pgrestRes.data;
  console.log(`   DB Schema:   ${pg.db_schema || "(não informado)"}`);
  console.log(`   Max Rows:    ${pg.max_rows ?? "(não informado)"}`);
  console.log(`   DB Pool:     ${pg.db_pool ?? "(não informado)"}`);
} else {
  console.log(`   ⚠️  PostgREST endpoint retornou ${pgrestRes.status}: ${JSON.stringify(pgrestRes.data)}`);
}

// 6. Teste de conectividade TCP
const dbHost = proj.database?.host || proj.db_host || `db.${projectRef}.supabase.co`;
const region = proj.region || "sa-east-1";
const poolerHost = `aws-0-${region}.pooler.supabase.com`;

console.log("\n🌍 6. Teste de Conectividade TCP");
console.log(`   Host Direto:  ${dbHost}:5432`);
const directTcp = await tcpProbe(dbHost, 5432);
console.log(`   Resultado:    ${directTcp.reachable ? "✅ Acessível" : `❌ Inacessível (${directTcp.error})`}`);

console.log(`   Host Pooler:  ${poolerHost}:6543`);
const poolerTcp = await tcpProbe(poolerHost, 6543);
console.log(`   Resultado:    ${poolerTcp.reachable ? "✅ Acessível" : `❌ Inacessível (${poolerTcp.error})`}`);

// 7. Resumo
line();
console.log("\n📋 RESUMO DO DIAGNÓSTICO:");
line();
const isActive = proj.status === "ACTIVE_HEALTHY" || proj.status === "ACTIVE";
console.log(`   Projeto ativo?       ${isActive ? "✅ Sim" : `❌ Não (${proj.status})`}`);
console.log(`   Porta 5432 (direta)? ${directTcp.reachable ? "✅ Sim" : "❌ Não"}`);
console.log(`   Porta 6543 (pooler)? ${poolerTcp.reachable ? "✅ Sim" : "❌ Não"}`);

if (isActive && !poolerTcp.reachable) {
  console.log("\n   ⚠️  DIAGNÓSTICO: Projeto está ATIVO mas o pooler NÃO responde.");
  console.log("   Possíveis causas:");
  console.log("     1. O Connection Pooler está DESABILITADO no painel da Supabase.");
  console.log("     2. O projeto foi criado recentemente e o pooler ainda está propagando (~5-15 min).");
  console.log("     3. A rede local pode estar bloqueando a porta 6543.");
  console.log(`\n   🔗 Verifique: https://supabase.com/dashboard/project/${projectRef}/settings/database`);
}

if (isActive && poolerTcp.reachable) {
  console.log("\n   ✅ DIAGNÓSTICO: Projeto ativo e pooler acessível.");
  console.log("   O erro 'tenant/user not found' pode indicar:");
  console.log("     1. Senha do banco incorreta.");
  console.log("     2. Usuário de conexão errado no connection string.");
  console.log("     3. Propagação DNS do tenant ainda em andamento (aguardar 2-5 min).");
}

if (!isActive) {
  console.log(`\n   ❌ DIAGNÓSTICO: Projeto NÃO está ativo (status: ${proj.status}).`);
  console.log(`   🔗 Restaure em: https://supabase.com/dashboard/project/${projectRef}`);
}

console.log();
