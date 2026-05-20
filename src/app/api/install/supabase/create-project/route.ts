import { NextResponse } from "next/server";
import { createSupabaseProject } from "@/lib/installer/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accessToken, organizationSlug, name, dbPass, region } = body;

    if (!accessToken || !organizationSlug || !name || !dbPass) {
      return NextResponse.json({ error: "accessToken, organizationSlug, name e dbPass sao obrigatorios." }, { status: 400 });
    }

    if (dbPass.length < 12) {
      return NextResponse.json({ error: "Senha do banco deve ter pelo menos 12 caracteres." }, { status: 400 });
    }

    const result = await createSupabaseProject({
      accessToken: accessToken.trim(),
      organizationSlug: organizationSlug.trim(),
      name: name.trim(),
      dbPass,
      region: region || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      projectRef: result.projectRef,
      supabaseUrl: result.supabaseUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
