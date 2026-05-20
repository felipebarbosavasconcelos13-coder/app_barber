import { NextResponse } from "next/server";
import { validateVercelToken, getProject, findProjectByDomain, listVercelProjects } from "@/lib/installer/vercel";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, domain } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token obrigatorio." }, { status: 400 });
    }

    const validation = await validateVercelToken(token);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    // Tenta detectar projeto: VERCEL_PROJECT_ID > dominio > lista
    const envProjectId = process.env.VERCEL_PROJECT_ID || "";

    let project: { id: string; name: string; teamId?: string; url?: string } | null = null;

    if (envProjectId) {
      const proj = await getProject(token, envProjectId);
      if (proj.ok && proj.project) {
        project = {
          id: proj.project.id,
          name: proj.project.name,
          url: `${proj.project.name}.vercel.app`,
        };
      }
    }

    if (!project && domain) {
      const found = await findProjectByDomain(token, domain);
      if (found) {
        project = {
          id: found.id,
          name: found.name,
          url: `${found.name}.vercel.app`,
        };
      }
    }

    if (!project) {
      const projects = await listVercelProjects(token);
      return NextResponse.json({
        success: true,
        project: null,
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
      });
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao conectar com a Vercel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
