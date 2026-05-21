import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Verifica se o banco esta configurado fazendo uma consulta direta ao Prisma.
  // Graças ao Proxy transparente, ele lerá a DATABASE_URL em runtime do .env se necessário.
  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });
    
    if (!settings || !settings.adminPassword) {
      redirect("/install");
    }
  } catch (error) {
    console.warn("[admin-page] Conexao com banco indisponivel ou tabelas nao criadas:", error);
    redirect("/install");
  }

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("admin_session")?.value === "true";

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}


