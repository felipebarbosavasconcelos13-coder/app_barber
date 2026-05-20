import { NextResponse } from "next/server";
import { listSupabaseProjects } from "@/lib/installer/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accessToken } = body;

    if (!accessToken || typeof accessToken !== "string" || accessToken.length < 5) {
      return NextResponse.json({ error: "Token do Supabase e obrigatorio." }, { status: 400 });
    }

    const projects = await listSupabaseProjects(accessToken);

    return NextResponse.json({
      projects: projects.map((p) => ({
        ref: p.ref,
        name: p.name,
        status: p.status,
        region: p.region,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar projetos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
