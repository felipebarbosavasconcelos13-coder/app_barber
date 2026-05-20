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

  // Busca barbeiros e serviços cadastrados no banco
  let barbers: Array<{
    id: string;
    name: string;
    email: string;
    openingTime: string;
    closingTime: string;
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
      orderBy: { createdAt: "desc" },
    });

    barbers = rawBarbers.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      openingTime: b.openingTime,
      closingTime: b.closingTime,
    }));

    services = rawServices.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration,
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
          <div className="hero-badge flex-center">
            <Award size={14} style={{ marginRight: "6px", color: "var(--accent-gold)" }} />
            <span>Experiência Tradicional & Moderna</span>
          </div>
          <h1 className="title-serif gold-glow">Corte de Cabelo & Barba Premium</h1>
          <p className="hero-subtitle">
            Agende seu horário com os melhores barbeiros da cidade em segundos.
            Conexão em tempo real e sincronização automática.
          </p>
          <div className="hero-info-grid">
            <div className="hero-info-item flex-center">
              <MapPin size={16} className="gold-text" />
              <span>Av. Paulista, 1000 - São Paulo, SP</span>
            </div>
            <div className="hero-info-item flex-center">
              <Clock size={16} className="gold-text" />
              <span>Seg a Sáb - 09:00 às 19:00</span>
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
            <Scissors className="gold-text" size={20} />
            <h3 className="title-serif gold-text">Barbearia Premium</h3>
          </div>
          <p>&copy; {new Date().getFullYear()} Barbearia Premium. Todos os direitos reservados.</p>
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
