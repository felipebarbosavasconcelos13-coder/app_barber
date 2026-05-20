import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Verifica se o banco esta configurado chamando a API de check
  // que já lida com .env em disco vs process.env
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const checkRes = await fetch(`${protocol}://${host}/api/install/check`, {
      cache: "no-store",
    });
    const checkData = await checkRes.json();
    if (!checkData?.initialized) {
      redirect("/install");
    }
  } catch {
    redirect("/install");
  }

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("admin_session")?.value === "true";

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}

