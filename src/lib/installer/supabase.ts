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

export async function validateSupabaseToken(accessToken: string) {
  const res = await supabaseFetch("/v1/projects", accessToken);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export async function getSupabaseProject(accessToken: string, projectRef: string) {
  const res = await supabaseFetch(
    `/v1/projects/${encodeURIComponent(projectRef)}`,
    accessToken
  );
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

export async function resolveSupabaseDbUrl(accessToken: string, projectRef: string) {
  // 1. Get project info to find db host
  const projectRes = await supabaseFetch(
    `/v1/projects/${encodeURIComponent(projectRef)}`,
    accessToken
  );

  if (!projectRes.ok) {
    return { ok: false, error: `Failed to get project info: ${projectRes.error}` };
  }

  const host =
    projectRes.data?.database?.host ||
    projectRes.data?.db_host ||
    projectRes.data?.dbHost;

  if (!host || typeof host !== "string" || !host.trim()) {
    return { ok: false, error: "Could not resolve database host from project info." };
  }

  // 2. Create a temporary CLI login role to get credentials
  const loginRes = await supabaseFetch(
    `/v1/projects/${encodeURIComponent(projectRef)}/cli/login-role`,
    accessToken,
    { method: "POST", body: JSON.stringify({ read_only: false }) }
  );

  if (!loginRes.ok) {
    return {
      ok: false,
      error: `Failed to create login role: ${loginRes.error}. Try using Connection Pooling (port 6543) or enable IPv4 add-on.`,
    };
  }

  const role = loginRes.data?.role;
  const password = loginRes.data?.password;

  if (!role || !password || typeof role !== "string" || typeof password !== "string") {
    return { ok: false, error: "Could not resolve CLI login role credentials." };
  }

  // Use transaction pooler (port 6543) for better compatibility
  const dbUrl = `postgresql://${role}:${password}@${host.trim()}:6543/postgres?pgbouncer=true`;

  return {
    ok: true,
    dbUrl,
    role,
    host: host.trim(),
  };
}

export function extractProjectRefFromUrl(supabaseUrl: string): string | null {
  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname;
    // Format: xxxxxxxxxxxxxxxxxxxx.supabase.co
    const match = host.match(/^(.+)\.supabase\.(co|com)$/);
    if (match) return match[1];
  } catch {}
  return null;
}
