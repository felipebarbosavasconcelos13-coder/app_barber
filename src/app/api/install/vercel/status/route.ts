import { NextResponse } from "next/server";
import { getVercelDeploymentStatus } from "@/lib/installer/vercel";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawData = await req.json().catch(() => null);
    if (!rawData) {
      return NextResponse.json({ success: false, error: "Corpo da requisicao invalido" }, { status: 400 });
    }

    const { token, deploymentId, teamId } = rawData;

    if (!token || !token.trim()) {
      return NextResponse.json({ success: false, error: "Token da Vercel e obrigatorio." }, { status: 400 });
    }

    if (!deploymentId || !deploymentId.trim()) {
      return NextResponse.json({ success: false, error: "ID do deployment e obrigatorio." }, { status: 400 });
    }

    const result = await getVercelDeploymentStatus(token.trim(), deploymentId.trim(), teamId?.trim());

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      readyState: result.readyState,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
