const VERCEL_API_BASE = "https://api.vercel.com";

type VercelProject = {
  id: string;
  name: string;
  accountId?: string;
};

type VercelEnv = {
  id: string;
  key: string;
  value?: string;
  target?: string[];
};

function buildUrl(path: string, teamId?: string) {
  const url = new URL(`${VERCEL_API_BASE}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  return url.toString();
}

async function vercelFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
  teamId?: string
): Promise<T> {
  const res = await fetch(buildUrl(path, teamId), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Vercel API error (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      const errMsg = parsed?.error?.message;
      if (errMsg) message = `Vercel: ${errMsg}`;
    } catch {}
    throw new Error(message);
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function validateVercelToken(token: string) {
  try {
    const data = await vercelFetch<{ user?: { id?: string; name?: string; username?: string } }>(
      "/v2/user",
      token
    );
    const userId = data?.user?.id;
    if (!userId) return { ok: false, error: "Token invalido" };
    return { ok: true, userId, user: data.user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token invalido";
    return { ok: false, error: message };
  }
}

export async function listVercelProjects(token: string, teamId?: string) {
  const data = await vercelFetch<{ projects?: VercelProject[] }>(
    "/v9/projects",
    token,
    {},
    teamId
  );
  return data.projects ?? [];
}

export async function upsertProjectEnvs(
  token: string,
  projectId: string,
  envs: Array<{ key: string; value: string; targets: string[] }>,
  teamId?: string
) {
  const existing = await vercelFetch<{ envs?: VercelEnv[] }>(
    `/v10/projects/${projectId}/env`,
    token,
    {},
    teamId
  );

  const existingEnvs = existing.envs ?? [];

  for (const env of envs) {
    const matching = existingEnvs.filter((item) => item.key === env.key);

    for (const item of matching) {
      if (item.id) {
        await vercelFetch(
          `/v10/projects/${projectId}/env/${item.id}`,
          token,
          { method: "PATCH", body: JSON.stringify({ value: env.value }) },
          teamId
        );
      }
    }

    const existingTargets = new Set(matching.flatMap((m) => m.target ?? []));
    const targetsToCreate = env.targets.filter((t) => !existingTargets.has(t));

    if (matching.length === 0 || targetsToCreate.length > 0) {
      await vercelFetch(
        `/v10/projects/${projectId}/env`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            key: env.key,
            value: env.value,
            target: matching.length === 0 ? env.targets : targetsToCreate,
            type: "encrypted",
          }),
        },
        teamId
      );
    }
  }
}

export async function findProjectByDomain(token: string, domain: string) {
  const lower = domain.toLowerCase();
  try {
    const projects = await listVercelProjects(token);

    for (const p of projects) {
      const vercelDomain = `${p.name.toLowerCase()}.vercel.app`;
      if (lower === vercelDomain) return p;
    }

    return projects[0] ?? null;
  } catch {
    return null;
  }
}
