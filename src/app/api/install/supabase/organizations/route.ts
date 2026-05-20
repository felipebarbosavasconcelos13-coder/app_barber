import { NextResponse } from "next/server";
import { listSupabaseOrganizations, listOrgProjects } from "@/lib/installer/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accessToken, orgSlug } = body;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json({ error: "Token obrigatorio." }, { status: 400 });
    }

    if (orgSlug) {
      const projects = await listOrgProjects(accessToken, orgSlug);
      return NextResponse.json({ projects });
    }

    const orgs = await listSupabaseOrganizations(accessToken);
    return NextResponse.json({ organizations: orgs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
