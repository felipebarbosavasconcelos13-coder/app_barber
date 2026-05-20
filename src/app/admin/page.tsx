import { cookies } from "next/headers";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("admin_session")?.value === "true";

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}
