import { NextResponse } from "next/server";
import { listVercelProjects, validateVercelToken } from "@/lib/installer/vercel";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, teamId } = body;

    if (!token || typeof token !== "string" || token.length < 5) {
      return NextResponse.json({ error: "Token da Vercel e obrigatorio." }, { status: 400 });
    }

    const validation = await validateVercelToken(token);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const projects = await listVercelProjects(token, teamId);

    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar projetos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
