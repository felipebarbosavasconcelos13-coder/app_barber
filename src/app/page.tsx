import prisma, { isDatabaseConfigured } from "@/lib/prisma";
import BookingFlow from "@/components/BookingFlow";
import { Scissors, MapPin, Clock, Phone, Award } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0; // Garante que a página sempre busque dados frescos do banco

export default async function HomePage() {
  // 1. Checa se o banco de dados já está configurado no ambiente
  const configured = isDatabaseConfigured();
  if (!configured) {
    redirect("/install");
  }

  // 2. Tenta conectar com o banco de dados Supabase.
  // Se o banco estiver fora do ar ou inativo, exibe uma tela de erro luxuosa e amigável,
  // em vez de redirecionar incorretamente para o instalador.
  try {
    await prisma.systemSettings.findFirst({ where: { id: "default" } });
  } catch (error) {
    console.error("[homepage] Erro na conexão resiliente com o banco remoto:", error);
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
          }}>Serviço em Manutenção</h2>
          
          <p style={{
            color: "#a1a1aa",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            marginBottom: "24px"
          }}>
            Nosso banco de dados está passando por uma manutenção rápida ou está inativo temporariamente. 
            <strong style={{ display: "block", marginTop: "10px", color: "#c5a880" }}>
              O aplicativo já está instalado e configurado no servidor. Seus dados estão preservados e nenhuma reinstalação é necessária.
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
            <strong style={{ color: "#c5a880", display: "block", marginBottom: "4px" }}>Nota para o Administrador:</strong>
            Se o seu banco do Supabase foi pausado por inatividade, acesse o painel da <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: "#c5a880", textDecoration: "underline" }}>Supabase</a> e clique em <strong>"Restore project"</strong>. O aplicativo voltará a funcionar imediatamente!
          </div>

          <a 
            href="/"
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

  // Busca as configurações gerais do banco de dados
  let settings = {
    barberShopName: "Barbearia Premium",
    logoUrl: "",
    address: "Av. Paulista, 1000 - São Paulo, SP",
    phone: "(11) 99999-9999",
    openingTime: "09:00",
    closingTime: "19:00",
    googleMapsEmbedUrl: "",
    googleReviewsWidget: "",
  };

  try {
    const rawSettings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
    });
    if (rawSettings) {
      settings = {
        barberShopName: rawSettings.barberShopName || "Barbearia Premium",
        logoUrl: rawSettings.logoUrl || "",
        address: rawSettings.address || "Av. Paulista, 1000 - São Paulo, SP",
        phone: rawSettings.phone || "(11) 99999-9999",
        openingTime: rawSettings.openingTime || "09:00",
        closingTime: rawSettings.closingTime || "19:00",
        googleMapsEmbedUrl: rawSettings.googleMapsEmbedUrl || "",
        googleReviewsWidget: rawSettings.googleReviewsWidget || "",
      };
    }
  } catch (error) {
    console.error("Erro ao buscar configurações na home page:", error);
  }

  // Busca depoimentos curados salvos no banco de dados
  let testimonials: Array<{
    id: string;
    authorName: string;
    rating: number;
    content: string;
    avatarUrl?: string | null;
    source: string;
  }> = [];

  try {
    testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Erro ao buscar depoimentos na home page:", error);
  }

  // Busca barbeiros e serviços cadastrados no banco
  let barbers: Array<{
    id: string;
    name: string;
    email: string;
    openingTime: string;
    closingTime: string;
    lunchStart?: string;
    lunchEnd?: string;
    workDays?: string;
  }> = [];

  let services: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
  }> = [];

  try {
    const rawBarbers = await prisma.barber.findMany({
      orderBy: { createdAt: "desc" },
    });

    const rawServices = await prisma.service.findMany({
      include: {
        barbers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    barbers = rawBarbers.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      openingTime: b.openingTime,
      closingTime: b.closingTime,
      lunchStart: b.lunchStart || "12:00",
      lunchEnd: b.lunchEnd || "13:00",
      workDays: b.workDays || "1,2,3,4,5,6",
    }));

    services = rawServices.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration,
      barbers: s.barbers.map((b) => ({ id: b.id })),
    }));
  } catch (error) {
    console.error("Erro ao buscar dados na home page:", error);
  }

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-content container animate-fade-in">
          <div className="hero-logo-wrapper flex-center" style={{ marginBottom: "20px" }}>
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.barberShopName} 
                style={{ maxHeight: "80px", maxWidth: "240px", objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(197, 168, 128, 0.3))" }} 
              />
            ) : (
              <Scissors className="gold-text gold-glow" size={48} />
            )}
          </div>
          <div className="hero-badge flex-center">
            <Award size={14} style={{ marginRight: "6px", color: "var(--accent-gold)" }} />
            <span>Experiência Tradicional & Moderna</span>
          </div>
          <h1 className="title-serif gold-glow">{settings.barberShopName}</h1>
          <p className="hero-subtitle">
            Agende seu horário com os melhores barbeiros da cidade em segundos.
            Conexão em tempo real e sincronização automática.
          </p>
          <div className="hero-info-grid">
            <div className="hero-info-item flex-center">
              <MapPin size={16} className="gold-text" />
              <span>{settings.address}</span>
            </div>
            <div className="hero-info-item flex-center">
              <Clock size={16} className="gold-text" />
              <span>Seg a Sáb - {settings.openingTime} às {settings.closingTime}</span>
            </div>
            <div className="hero-info-item flex-center">
              <Phone size={16} className="gold-text" />
              <span>{settings.phone}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Form Section */}
      <section className="booking-section container">
        <div className="section-title text-center animate-fade-in">
          <h2 className="title-serif gold-glow">Agendamento Online</h2>
          <p>Selecione suas preferências e reserve o seu horário</p>
        </div>
        
        <div className="booking-wrapper animate-fade-in">
          <BookingFlow initialBarbers={barbers} initialServices={services} />
        </div>
      </section>

      {/* Depoimentos & Avaliações Google Section */}
      <section className="testimonials-section container animate-fade-in" style={{ marginTop: "80px", marginBottom: "40px" }}>
        <div className="section-title text-center">
          <span className="badge badge-gold" style={{ marginBottom: "10px", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", padding: "6px 12px" }}>
            Reputação & Avaliações
          </span>
          <h2 className="title-serif gold-glow" style={{ fontSize: "2.2rem" }}>O Que Nossos Clientes Dizem</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "600px", margin: "8px auto 0 auto" }}>
            A opinião dos nossos clientes é o reflexo da nossa dedicação e excelência em cada detalhe.
          </p>
        </div>

        {settings.googleReviewsWidget ? (
          <div className="google-widget-wrapper glass-card animate-fade-in" style={{ padding: "24px", borderRadius: "14px", marginTop: "30px", overflow: "hidden" }}>
            <div dangerouslySetInnerHTML={{ __html: settings.googleReviewsWidget }} />
          </div>
        ) : (
          <div className="testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginTop: "30px" }}>
            {(testimonials.length > 0 ? testimonials : [
              {
                id: "1",
                authorName: "Felipe Vasconcelos",
                rating: 5,
                content: "Melhor barbearia da região! O atendimento do profissional é impecável, além do espaço super climatizado e café de cortesia premium. Recomendo de olhos fechados!",
                avatarUrl: "",
                source: "Google"
              },
              {
                id: "2",
                authorName: "Bruno Martins",
                rating: 5,
                content: "Ambiente espetacular, música boa, cerveja gelada e profissionais de ponta. O corte de cabelo e a barba ficaram exatamente como pedi. Com certeza serei cliente fixo.",
                avatarUrl: "",
                source: "Google"
              },
              {
                id: "3",
                authorName: "Rodrigo Costa",
                rating: 5,
                content: "Praticidade total com o agendamento online. Cheguei e fui atendido exatamente no meu horário. O serviço é rápido e extremamente profissional. Nota 10!",
                avatarUrl: "",
                source: "Google"
              }
            ]).map((t) => (
              <div key={t.id} className="testimonial-card glass-card animate-fade-in" style={{
                padding: "28px",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                transition: "all 0.3s ease",
                border: "1px solid rgba(255,255,255,0.03)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)"
              }}>
                <div>
                  <div className="testimonial-stars" style={{ display: "flex", gap: "2px", color: "var(--accent-gold)", fontSize: "1.1rem", marginBottom: "16px" }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i}>{i < t.rating ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <p className="testimonial-content" style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", fontStyle: "italic" }}>
                    "{t.content}"
                  </p>
                </div>

                <div className="testimonial-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt={t.authorName} style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(197, 168, 128, 0.2)" }} />
                    ) : (
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "rgba(197, 168, 128, 0.1)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.9rem" }}>
                        {t.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span style={{ display: "block", color: "#fff", fontWeight: 500, fontSize: "0.95rem" }}>{t.authorName}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Cliente Verificado</span>
                    </div>
                  </div>

                  <div className="google-badge-badge" style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(66, 133, 244, 0.08)", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(66, 133, 244, 0.15)" }}>
                    <svg viewBox="0 0 24 24" style={{ width: "12px", height: "12px" }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.66-.35-1.36-.35-2.09z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span style={{ fontSize: "0.75rem", color: "#4285f4", fontWeight: 500 }}>{t.source || "Google"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Localização & Mapa Section */}
      <section className="location-section container animate-fade-in" style={{ marginTop: "60px", marginBottom: "80px" }}>
        <div className="section-title text-center">
          <span className="badge badge-gold" style={{ marginBottom: "10px", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em", padding: "6px 12px" }}>
            Onde Estamos
          </span>
          <h2 className="title-serif gold-glow" style={{ fontSize: "2.2rem" }}>Nossa Localização</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "600px", margin: "8px auto 0 auto" }}>
            Venha nos visitar e desfrutar da melhor experiência. Confira nossa localização no mapa interativo abaixo.
          </p>
        </div>

        <div className="location-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "30px", marginTop: "30px" }}>
          {/* Informações de Contato / Visita */}
          <div className="location-info-card glass-card" style={{ padding: "30px", borderRadius: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid rgba(255,255,255,0.03)" }}>
            <div>
              <h3 className="title-serif gold-text" style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "15px" }}>{settings.barberShopName}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "20px", lineHeight: "1.6" }}>
                Estamos localizados em uma área de fácil acesso com estacionamento no local. Venha tomar uma cerveja ou café conosco enquanto cuidamos do seu estilo!
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <MapPin size={20} className="gold-text" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block", color: "#fff", fontSize: "0.95rem" }}>Endereço</strong>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "2px", display: "block" }}>{settings.address}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <Clock size={20} className="gold-text" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block", color: "#fff", fontSize: "0.95rem" }}>Horário de Expediente</strong>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "2px", display: "block" }}>Segunda a Sábado: {settings.openingTime} às {settings.closingTime}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <Phone size={20} className="gold-text" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block", color: "#fff", fontSize: "0.95rem" }}>Telefone / Contato</strong>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "2px", display: "block" }}>{settings.phone}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "30px" }}>
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(settings.address)}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-gold text-center" 
                style={{ width: "100%", textDecoration: "none", display: "block", fontWeight: 600 }}
              >
                Abrir no Google Maps
              </a>
            </div>
          </div>

          {/* Iframe do Google Maps Embed */}
          <div className="location-map-card glass-card" style={{ borderRadius: "14px", overflow: "hidden", minHeight: "350px", border: "1px solid rgba(255,255,255,0.03)", position: "relative" }}>
            <iframe 
              src={settings.googleMapsEmbedUrl || `https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              width="100%" 
              height="100%" 
              style={{ border: 0, minHeight: "350px", display: "block" }} 
              allowFullScreen={true}
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .location-map-card iframe {
            filter: grayscale(0.8) invert(0.9) contrast(1.1) brightness(0.9) !important;
          }
          @media (max-width: 768px) {
            .location-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}} />
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content container">
          <div className="footer-logo">
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.barberShopName} 
                style={{ maxHeight: "30px", maxWidth: "120px", objectFit: "contain", marginRight: "10px" }} 
              />
            ) : (
              <Scissors className="gold-text" size={20} style={{ marginRight: "10px" }} />
            )}
            <h3 className="title-serif gold-text">{settings.barberShopName}</h3>
          </div>
          <p style={{ margin: "10px 0" }}>{settings.address} | Telefone: {settings.phone}</p>
          <p>&copy; {new Date().getFullYear()} {settings.barberShopName}. Todos os direitos reservados.</p>
          <div className="footer-links">
            <Link href="/admin" className="admin-link">
              Painel do Barbeiro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
