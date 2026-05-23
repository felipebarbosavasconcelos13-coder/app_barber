import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";
import prisma, { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1. Checa se o banco de dados já está configurado no ambiente
  const configured = isDatabaseConfigured();
  if (!configured) {
    redirect("/install");
  }

  // 2. Tenta conectar com o banco de dados Supabase.
  // Se o banco estiver fora do ar ou inativo, exibe uma tela de erro luxuosa e amigável,
  // em vez de redirecionar incorretamente para o instalador.
  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });
    
    if (!settings || !settings.adminPassword) {
      redirect("/install");
    }
  } catch (error) {
    console.error("[admin-page] Erro na conexão resiliente com o banco remoto:", error);
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#060608",
        color: "#f4f4f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Outfit', sans-serif",
        textAlign: "center"
      }}>
        <div style={{
          background: "rgba(18, 18, 22, 0.7)",
          backdropFilter: "blur(16px) saturate(120%)",
          WebkitBackdropFilter: "blur(16px) saturate(120%)",
          border: "1px solid rgba(197, 168, 128, 0.15)",
          borderRadius: "16px",
          padding: "40px 30px",
          maxWidth: "520px",
          width: "100%",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.7)"
        }} className="glass-card">
          <div style={{
            width: "70px",
            height: "70px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px"
          }}>
            <span style={{ fontSize: "2rem" }}>⚠️</span>
          </div>
          
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.8rem",
            color: "#ffffff",
            marginBottom: "12px",
            textShadow: "0 0 20px rgba(197, 168, 128, 0.2)"
          }}>Banco de Dados Indisponível</h2>
          
          <p style={{
            color: "#a1a1aa",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            marginBottom: "24px"
          }}>
            O banco de dados do seu painel administrativo está temporariamente inativo ou pausado na Supabase.
            <strong style={{ display: "block", marginTop: "10px", color: "#c5a880" }}>
              Seus agendamentos e cadastros estão 100% seguros. Nenhuma ação de reinstalação é necessária.
            </strong>
          </p>
          
          <div style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "15px",
            borderRadius: "10px",
            fontSize: "0.8rem",
            color: "#71717a",
            textAlign: "left",
            marginBottom: "24px",
            lineHeight: "1.5"
          }}>
            <strong style={{ color: "#c5a880", display: "block", marginBottom: "4px" }}>Nota para o Barbeiro / Admin:</strong>
            Para colocar o painel administrativo de volta ao ar instantaneamente, acesse a sua conta no painel da <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "#c5a880", textDecoration: "underline" }}>Supabase</a>, selecione o seu projeto e clique no botão de reativação <strong>"Restore project"</strong>.
          </div>

          <a 
            href="/admin"
            style={{
              background: "linear-gradient(135deg, #d4af37 0%, #c5a880 100%)",
              color: "#000",
              fontWeight: 600,
              border: "none",
              padding: "14px 28px",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "0.95rem",
              width: "100%",
              boxShadow: "0 4px 15px rgba(197, 168, 128, 0.3)",
              display: "block",
              textDecoration: "none"
            }}
          >
            Tentar Novamente
          </a>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("admin_session")?.value === "true";

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}


