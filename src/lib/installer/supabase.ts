const SUPABASE_API_BASE = "https://api.supabase.com";

async function supabaseFetch(
  pathname: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<{ ok: true; status: number; data: any } | { ok: false; status: number; error: string; data: any }> {
  const res = await fetch(`${SUPABASE_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    const msg = data?.message || data?.error || text || `Supabase API error (${res.status})`;
    return { ok: false, status: res.status, error: String(msg), data };
  }

  return { ok: true, status: res.status, data };
}

export type SupabaseProject = {
  ref: string;
  name: string;
  status?: string;
  region?: string;
  dbHost?: string;
};

export type SupabaseOrg = {
  slug: string;
  name: string;
  id?: string;
};

// ── Projects ──

export async function listSupabaseProjects(accessToken: string): Promise<SupabaseProject[]> {
  const res = await supabaseFetch("/v1/projects", accessToken);
  if (!res.ok) return [];
  return (Array.isArray(res.data) ? res.data : []).map((p: any) => ({
    ref: p.ref || p.id,
    name: p.name || p.ref,
    status: p.status,
    region: p.region,
    dbHost: p.database?.host || p.db_host,
  }));
}

// ── Organizations ──

export async function listSupabaseOrganizations(accessToken: string): Promise<SupabaseOrg[]> {
  const res = await supabaseFetch("/v1/organizations", accessToken);
  if (!res.ok) return [];
  const items = Array.isArray(res.data) ? res.data : [];
  return items
    .filter((o: any) => o.slug && o.name)
    .map((o: any) => ({ slug: o.slug, name: o.name, id: o.id }));
}

export async function listOrgProjects(accessToken: string, orgSlug: string): Promise<SupabaseProject[]> {
  const res = await supabaseFetch(`/v1/organizations/${encodeURIComponent(orgSlug)}/projects`, accessToken);
  if (!res.ok) return [];
  const items = Array.isArray(res.data?.projects) ? res.data.projects : Array.isArray(res.data) ? res.data : [];
  return items
    .filter((p: any) => p.ref && p.name)
    .map((p: any) => ({
      ref: p.ref,
      name: p.name,
      status: p.status,
      region: p.region,
    }));
}

// ── Create Project ──

export async function createSupabaseProject(params: {
  accessToken: string;
  organizationSlug: string;
  name: string;
  dbPass: string;
  region?: string;
}): Promise<{ ok: true; projectRef: string; supabaseUrl: string } | { ok: false; error: string }> {
  const body: any = {
    name: params.name,
    organization_slug: params.organizationSlug,
    db_pass: params.dbPass,
  };

  if (params.region) {
    body.region_selection = { type: "smartGroup", code: params.region };
  }

  const res = await supabaseFetch("/v1/projects", params.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) return { ok: false, error: res.error };

  const ref = res.data?.ref;
  if (!ref || typeof ref !== "string") return { ok: false, error: "Unexpected response creating project." };

  return { ok: true, projectRef: ref.trim(), supabaseUrl: `https://${ref.trim()}.supabase.co` };
}

// ── Validate ──

export async function validateSupabaseToken(accessToken: string) {
  const res = await supabaseFetch("/v1/organizations", accessToken);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

// ── Project Info ──

export async function getSupabaseProject(accessToken: string, projectRef: string) {
  const res = await supabaseFetch(`/v1/projects/${encodeURIComponent(projectRef)}`, accessToken);
  if (!res.ok) return { ok: false, error: res.error };

  const data = res.data;
  return {
    ok: true,
    project: {
      ref: projectRef,
      name: data?.name,
      status: data?.status || data?.project_status,
      region: data?.region,
      dbHost: data?.database?.host || data?.db_host || data?.dbHost,
    },
  };
}

// ── Resolve DB URL ──

export async function resolveSupabaseDbUrl(accessToken: string, projectRef: string, dbPass?: string) {
  const projectRes = await supabaseFetch(`/v1/projects/${encodeURIComponent(projectRef)}`, accessToken);
  if (!projectRes.ok) return { ok: false, error: `Failed to get project info: ${projectRes.error}` };

  const host = projectRes.data?.database?.host || projectRes.data?.db_host || projectRes.data?.dbHost;
  const region = projectRes.data?.region;
  if (!host || typeof host !== "string" || !host.trim()) {
    return { ok: false, error: "Could not resolve database host from project info." };
  }

  const dbUrls: Array<{ label: string; url: string; host: string }> = [];

  // Se dbPass for fornecido, usamos o usuário mestre 'postgres' e pulamos a criação de role temporária
  if (dbPass && dbPass.trim()) {
    const password = dbPass.trim();
    const safePassword = encodeURIComponent(password);
    const directUrl = `postgresql://${encodeURIComponent("postgres")}:${safePassword}@${host.trim()}:5432/postgres?sslmode=require`;
    
    if (typeof region === "string" && region.trim()) {
      const poolerHost = `aws-0-${region.trim()}.pooler.supabase.com`;
      dbUrls.push({
        label: "pooler",
        url: `postgresql://${encodeURIComponent(`postgres.${projectRef}`)}:${safePassword}@${poolerHost}:6543/postgres?sslmode=require`,
        host: poolerHost,
      });
    }
    
    dbUrls.push({ label: "direct", url: directUrl, host: host.trim() });
    
    return { ok: true, dbUrl: dbUrls[0].url, dbUrls, role: "postgres", host: dbUrls[0].host };
  }

  // Comportamento original de fallback via cli/login-role
  const loginRes = await supabaseFetch(
    `/v1/projects/${encodeURIComponent(projectRef)}/cli/login-role`,
    accessToken,
    { method: "POST", body: JSON.stringify({ read_only: false }) }
  );

  if (!loginRes.ok) {
    return { ok: false, error: `Failed to create login role: ${loginRes.error}. Try port 6543 or enable IPv4.` };
  }

  const role = loginRes.data?.role;
  const password = loginRes.data?.password;
  if (!role || !password) return { ok: false, error: "Could not resolve CLI login role credentials." };

  const safeRole = encodeURIComponent(String(role));
  const safePassword = encodeURIComponent(String(password));
  const directUrl = `postgresql://${safeRole}:${safePassword}@${host.trim()}:5432/postgres?sslmode=require`;
  dbUrls.push({ label: "direct", url: directUrl, host: host.trim() });

  if (typeof region === "string" && region.trim()) {
    const poolerHost = `aws-0-${region.trim()}.pooler.supabase.com`;
    dbUrls.unshift({
      label: "pooler",
      url: `postgresql://${encodeURIComponent(`${role}.${projectRef}`)}:${safePassword}@${poolerHost}:6543/postgres?sslmode=require`,
      host: poolerHost,
    });
  }

  return { ok: true, dbUrl: dbUrls[0].url, dbUrls, role, host: dbUrls[0].host };
}

export function extractProjectRefFromUrl(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const match = host.match(/^(.+)\.supabase\.(co|com)$/);
    if (match) return match[1];
  } catch {}
  return null;
}
