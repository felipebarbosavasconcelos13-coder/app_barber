import prisma from "@/lib/prisma";
import BookingFlow from "@/components/BookingFlow";
import { Scissors, MapPin, Clock, Phone, Award } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0; // Garante que a página sempre busque dados frescos do banco

export default async function HomePage() {
  // Verifica se o banco esta configurado. Se nao, redireciona para o instalador.
  try {
    await prisma.systemSettings.findFirst({ where: { id: "default" } });
  } catch {
    redirect("/install");
  }

  // Busca as configurações gerais do banco de dados
  let settings = {
    barberShopName: "Barbearia Premium",
    logoUrl: "",
    address: "Av. Paulista, 1000 - São Paulo, SP",
    phone: "(11) 99999-9999",
    openingTime: "09:00",
    closingTime: "19:00",
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
      };
    }
  } catch (error) {
    console.error("Erro ao buscar configurações na home page:", error);
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
