"use client";

import { useState, useEffect } from "react";
import {
  User,
  Scissors,
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Phone,
  Mail,
  UserCheck,
  DollarSign,
  Loader2
} from "lucide-react";

interface InitialBarber {
  id: string;
  name: string;
  email: string;
  openingTime: string;
  closingTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  workDays?: string;
}

function formatWorkDays(workDays?: string) {
  if (!workDays) return "Segunda a Sábado";
  const days = workDays.split(",").map(Number);
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  
  if (days.length === 7) return "Todos os dias";
  if (days.length === 6 && !days.includes(0)) return "Segunda a Sábado";
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Segunda a Sexta";
  
  return days.map(d => dayNames[d]).join(", ");
}

interface InitialService {
  id: string;
  name: string;
  price: number;
  duration: number;
  barbers?: Array<{ id: string }>;
}

interface BookingFlowProps {
  initialBarbers: InitialBarber[];
  initialServices: InitialService[];
}

export default function BookingFlow({ initialBarbers, initialServices }: BookingFlowProps) {
  const [step, setStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<InitialBarber | null>(null);
  const [selectedService, setSelectedService] = useState<InitialService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(""); // Formato "YYYY-MM-DD"
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; dateTime: string } | null>(null);
  
  // Lista de datas próximas para o cliente escolher (próximos 14 dias)
  const [availableDates, setAvailableDates] = useState<{ dateStr: string; label: string; weekday: string }[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string; dateTime: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Dados do cliente
  const [clientData, setClientData] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Gera os próximos 14 dias disponíveis para agendamento baseado no barbeiro selecionado
  useEffect(() => {
    const dates = [];
    const today = new Date();
    
    // Filtra dias com base nas configurações do barbeiro. Padrão: Segunda a Sábado (1,2,3,4,5,6)
    const allowedDays = selectedBarber?.workDays
      ? selectedBarber.workDays.split(",").map(Number)
      : [1, 2, 3, 4, 5, 6];
    
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      
      // Ignora dias não trabalhados pelo barbeiro selecionado
      if (!allowedDays.includes(d.getDay())) continue;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
      const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

      dates.push({ dateStr, label, weekday });
    }

    setAvailableDates(dates);
    
    // Se a data selecionada anteriormente não estiver na lista de novas datas disponíveis,
    // ou se não houver data selecionada, seleciona a primeira data disponível.
    if (dates.length > 0) {
      const isStillAvailable = dates.some(d => d.dateStr === selectedDate);
      if (!isStillAvailable) {
        setSelectedDate(dates[0].dateStr);
      }
    } else {
      setSelectedDate("");
    }
  }, [selectedBarber]);

  // Busca horários livres quando altera data, barbeiro ou serviço
  useEffect(() => {
    if (selectedBarber && selectedService && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedBarber, selectedService, selectedDate]);

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError("");
    try {
      const res = await fetch(
        `/api/booking/available-slots?barberId=${selectedBarber!.id}&serviceId=${selectedService!.id}&date=${selectedDate}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar horários.");
      setAvailableSlots(data);
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao buscar horários disponíveis.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && !selectedBarber) return;
    if (step === 2 && !selectedService) return;
    if (step === 3 && !selectedSlot) return;
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setStep(step - 1);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientData.name,
          clientEmail: clientData.email,
          clientPhone: clientData.phone,
          dateTime: selectedSlot!.dateTime,
          barberId: selectedBarber!.id,
          serviceId: selectedService!.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao criar agendamento.");

      setBookingResult(data.booking);
      
      // DISPARO DO EVENTO DE BOOKINGS PARA O GOOGLE TAG MANAGER (GTM)
      if (typeof window !== "undefined") {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "bookings",
          transactionId: data.booking.id,
          value: selectedService!.price,
          currency: "BRL",
          barber: selectedBarber!.name,
          service: selectedService!.name,
          clientName: clientData.name
        });
      }

      setStep(5); // vai para a tela de sucesso
    } catch (err: any) {
      setError(err.message || "Falha ao enviar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSelectedDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className={`flow-container ${selectedBarber && step < 5 ? "booking-focused" : ""}`}>
      {/* Etapa Guiada */}
      {step < 5 && (
        <div className="steps-indicator glass-card">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>
            <span>1</span>
            <p>Barbeiro</p>
          </div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>
            <span>2</span>
            <p>Serviço</p>
          </div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 3 ? "active" : ""}`}>
            <span>3</span>
            <p>Horário</p>
          </div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 4 ? "active" : ""}`}>
            <span>4</span>
            <p>Identificação</p>
          </div>
        </div>
      )}

      {error && <div className="toast-error animate-slide-in" style={{ padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>{error}</div>}

      <div className="flow-body">
        {/* PASSO 1: Escolha do Barbeiro */}
        {step === 1 && (
          <div className="step-content animate-fade-in">
            <div className="step-title">
              <h2 className="title-serif gold-glow">Escolha o seu Barbeiro</h2>
              <p>Selecione um de nossos barbeiros profissionais para o seu atendimento.</p>
            </div>

            <div className="barbers-grid">
              {initialBarbers.length === 0 ? (
                <div className="glass-card empty-state flex-1">
                  <User size={36} className="empty-icon" />
                  <h4>Nenhum barbeiro disponível no momento</h4>
                  <p>Por favor, volte mais tarde ou contate a barbearia.</p>
                </div>
              ) : (
                initialBarbers.map((barber) => (
                  <div
                    key={barber.id}
                    onClick={() => setSelectedBarber(barber)}
                    className={`glass-card barber-select-card ${selectedBarber?.id === barber.id ? "selected" : ""}`}
                  >
                    <div className="avatar-placeholder flex-center">
                      <span className="title-serif">{barber.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3>{barber.name}</h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px", textAlign: "center", lineHeight: "1.4" }}>
                      <span style={{ display: "block" }}>⏰ Expediente: {barber.openingTime} às {barber.closingTime}</span>
                      {barber.lunchStart && barber.lunchEnd && (
                        <span style={{ display: "block" }}>🍽️ Almoço: {barber.lunchStart} às {barber.lunchEnd}</span>
                      )}
                      <span style={{ display: "block", fontSize: "0.75rem", marginTop: "2px", fontStyle: "italic", color: "var(--accent-gold)" }}>
                        🗓️ {formatWorkDays(barber.workDays)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedBarber && (
              <div className="navigation-actions flex-center">
                <button onClick={handleNextStep} className="btn-gold">
                  <span>Próximo Passo</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2: Escolha do Serviço */}
        {step === 2 && (
          <div className="step-content animate-fade-in">
            <div className="step-title">
              <h2 className="title-serif gold-glow">Escolha o Serviço</h2>
              <p>Selecione o corte, barba ou combo ideal para o seu estilo.</p>
            </div>

            <div className="services-list-container">
              {(() => {
                const filteredServices = initialServices.filter((service) => {
                  if (!selectedBarber) return true;
                  // Se o serviço não tem nenhum barbeiro explicitamente listado, mostramos para todos para manter retrocompatibilidade
                  if (!service.barbers || service.barbers.length === 0) return true;
                  return service.barbers.some((b) => b.id === selectedBarber.id);
                });

                if (filteredServices.length === 0) {
                  return (
                    <div className="glass-card empty-state flex-direction-column flex-center" style={{ padding: "40px" }}>
                      <Scissors size={48} className="empty-icon" style={{ color: "var(--accent-gold)", opacity: 0.8 }} />
                      <h4 style={{ marginTop: "16px", color: "#ffffff", fontSize: "1.2rem" }}>Nenhum serviço deste profissional</h4>
                      <p style={{ color: "var(--text-muted)", maxWidth: "360px", marginTop: "8px" }}>
                        O barbeiro <strong>{selectedBarber?.name}</strong> não oferece serviços cadastrados no momento. Por favor, escolha outro profissional.
                      </p>
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="btn-outline"
                        style={{ marginTop: "20px", display: "inline-flex", gap: "8px", alignItems: "center" }}
                      >
                        <ChevronLeft size={16} /> Alterar Barbeiro
                      </button>
                    </div>
                  );
                }

                return filteredServices.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`glass-card service-select-card ${selectedService?.id === service.id ? "selected" : ""}`}
                  >
                    <div className="service-details">
                      <h3>{service.name}</h3>
                      <div className="service-duration flex-center">
                        <Clock size={14} style={{ marginRight: "6px", color: "var(--text-muted)" }} />
                        <span>{service.duration} minutes</span>
                      </div>
                    </div>
                    <div className="service-price">
                      <span className="price-tag">R$ {service.price.toFixed(2)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="navigation-actions flex-center" style={{ gap: "20px", marginTop: "30px" }}>
              <button onClick={handlePrevStep} className="btn-outline">
                <ChevronLeft size={18} />
                <span>Voltar</span>
              </button>
              {selectedService && (
                <button onClick={handleNextStep} className="btn-gold">
                  <span>Próximo Passo</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* PASSO 3: Data e Horário */}
        {step === 3 && (
          <div className="step-content animate-fade-in">
            <div className="step-title">
              <h2 className="title-serif gold-glow">Escolha Data e Horário</h2>
              <p>Selecione um dia e horário livre na agenda do barbeiro {selectedBarber?.name}.</p>
            </div>

            {/* Carrossel/Seletor de Dias */}
            <div className="days-selector-wrapper">
              <div className="days-list">
                {availableDates.map((d) => (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`glass-card day-btn ${selectedDate === d.dateStr ? "selected" : ""}`}
                  >
                    <span className="day-weekday">{d.weekday}</span>
                    <span className="day-label">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Horários */}
            <div className="slots-container glass-card">
              {loadingSlots ? (
                <div className="loading-slots flex-center">
                  <Loader2 size={32} className="spinner" style={{ color: "var(--accent-gold)" }} />
                  <span style={{ marginLeft: "12px", color: "var(--text-secondary)" }}>Consultando agenda...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="empty-state" style={{ padding: "40px" }}>
                  <Clock size={36} className="empty-icon" />
                  <h4>Nenhum horário livre neste dia</h4>
                  <p>Escolha outra data ou mude o barbeiro para verificar opções.</p>
                </div>
              ) : (
                <div className="slots-grid">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.dateTime}
                      onClick={() => setSelectedSlot({ start: slot.start, dateTime: slot.dateTime })}
                      className={`glass-card slot-btn ${selectedSlot?.dateTime === slot.dateTime ? "selected" : ""}`}
                    >
                      <Clock size={14} className="slot-clock-icon" />
                      <span>{slot.start}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="navigation-actions flex-center" style={{ gap: "20px", marginTop: "30px" }}>
              <button onClick={handlePrevStep} className="btn-outline">
                <ChevronLeft size={18} />
                <span>Voltar</span>
              </button>
              {selectedSlot && (
                <button onClick={handleNextStep} className="btn-gold">
                  <span>Próximo Passo</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* PASSO 4: Identificação do Cliente */}
        {step === 4 && (
          <div className="step-content animate-fade-in">
            <div className="step-title">
              <h2 className="title-serif gold-glow">Confirmação de Agendamento</h2>
              <p>Insira seus dados para finalizar e sincronizar com seu e-mail.</p>
            </div>

            <div className="booking-summary-card glass-card">
              <h3 className="title-serif gold-glow" style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Resumo da Reserva</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Barbeiro:</span>
                  <span className="summary-value flex-center" style={{ gap: "6px" }}><User size={14} /> {selectedBarber?.name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Serviço:</span>
                  <span className="summary-value flex-center" style={{ gap: "6px" }}><Scissors size={14} /> {selectedService?.name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Valor:</span>
                  <span className="summary-value gold-text flex-center" style={{ gap: "4px" }}><DollarSign size={14} /> R$ {selectedService?.price.toFixed(2)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Data e Hora:</span>
                  <span className="summary-value flex-center" style={{ gap: "6px" }}><CalendarIcon size={14} /> {selectedSlot ? formatSelectedDateTime(selectedSlot.dateTime) : ""}</span>
                </div>
              </div>
            </div>

            <div className="glass-card form-card" style={{ maxWidth: "540px", margin: "0 auto" }}>
              <form onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label className="form-label"><User size={14} style={{ marginRight: "6px" }} /> Nome Completo</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Seu nome completo"
                    value={clientData.name}
                    onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label"><Mail size={14} style={{ marginRight: "6px" }} /> E-mail</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Ex: seuemail@provedor.com"
                    value={clientData.email}
                    onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                    required
                    disabled={submitting}
                  />
                  <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    Usado para identificacao do seu agendamento.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label"><Phone size={14} style={{ marginRight: "6px" }} /> Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Ex: (11) 99999-9999"
                    value={clientData.phone}
                    onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="navigation-actions flex-center" style={{ gap: "20px", marginTop: "24px" }}>
                  <button type="button" onClick={handlePrevStep} className="btn-outline" disabled={submitting}>
                    <ChevronLeft size={18} />
                    <span>Voltar</span>
                  </button>
                  <button type="submit" className="btn-gold" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="spinner" /> Processando...
                      </>
                    ) : (
                      <>
                        <UserCheck size={18} />
                        <span>Confirmar Agendamento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PASSO 5: Tela de Sucesso */}
        {step === 5 && bookingResult && (
          <div className="step-content animate-fade-in success-pane flex-center flex-direction-column">
            <div className="success-icon-wrapper flex-center">
              <CheckCircle size={48} className="gold-glow" style={{ color: "var(--accent-gold)" }} />
            </div>
            <h1 className="title-serif gold-glow" style={{ fontSize: "2.4rem", margin: "20px 0 10px" }}>Agendamento Confirmado!</h1>
            <p style={{ maxWidth: "480px", textAlign: "center", marginBottom: "30px" }}>
              Olá <strong>{clientData.name}</strong>, seu horário foi agendado com sucesso e sincronizado na agenda de <strong>{selectedBarber?.name}</strong>.
            </p>

            <div className="glass-card success-details-card animate-fade-in" style={{ width: "100%", maxWidth: "500px", padding: "28px" }}>
              <div className="success-details-row">
                <span>Código da Reserva:</span>
                <strong style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{bookingResult.id}</strong>
              </div>
              <div className="success-details-row">
                <span>Profissional:</span>
                <strong>{selectedBarber?.name}</strong>
              </div>
              <div className="success-details-row">
                <span>Serviço:</span>
                <strong>{selectedService?.name} (R$ {selectedService?.price.toFixed(2)})</strong>
              </div>
              <div className="success-details-row">
                <span>Horário Selecionado:</span>
                <strong className="gold-text">{formatSelectedDateTime(selectedSlot!.dateTime)}</strong>
              </div>
            </div>

            <div className="google-notification-box glass-card animate-fade-in" style={{ marginTop: "24px", maxWidth: "500px", padding: "18px", display: "flex", gap: "14px", alignItems: "center" }}>
              <Mail size={32} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Seu agendamento foi registrado com sucesso. Guarde o codigo da reserva para referencia.
              </div>
            </div>

            <button
              onClick={() => {
                setStep(1);
                setSelectedBarber(null);
                setSelectedService(null);
                setSelectedSlot(null);
                setClientData({ name: "", email: "", phone: "" });
                setBookingResult(null);
              }}
              className="btn-gold"
              style={{ marginTop: "40px" }}
            >
              <span>Fazer Novo Agendamento</span>
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .flow-container {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }

        .steps-indicator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 30px;
          border-radius: 14px;
          margin-bottom: 35px;
        }

        .step-dot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          position: relative;
        }

        .step-dot span {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.9rem;
          background: rgba(0,0,0,0.2);
          transition: all 0.3s ease;
        }

        .step-dot p {
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }

        .step-dot.active span {
          border-color: var(--accent-gold);
          color: #000000;
          background: linear-gradient(135deg, #d4af37 0%, var(--accent-gold) 100%);
          box-shadow: 0 0 12px rgba(197, 168, 128, 0.3);
        }

        .step-dot.active p {
          color: var(--accent-gold);
          font-weight: 600;
        }

        .step-line {
          height: 1px;
          background: var(--border-color);
          flex: 1;
          margin: 0 15px;
          transform: translateY(-10px);
        }

        .flow-body {
          min-height: 400px;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .step-title {
          text-align: center;
        }

        .step-title h2 {
          font-size: 2rem;
          margin-bottom: 8px;
        }

        .step-title p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        /* Grid de Barbeiros */
        .barbers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
          justify-content: center;
        }

        .barber-select-card {
          padding: 30px 24px;
          border-radius: 16px;
          text-align: center;
          cursor: pointer;
        }

        .barber-select-card:hover {
          transform: translateY(-4px);
        }

        .barber-select-card.selected {
          border-color: var(--accent-gold);
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.08) 0%, rgba(197, 168, 128, 0.02) 100%);
          box-shadow: 0 10px 30px rgba(197, 168, 128, 0.08);
        }

        .avatar-placeholder {
          width: 70px;
          height: 70px;
          background: rgba(197, 168, 128, 0.08);
          border: 1px solid rgba(197, 168, 128, 0.2);
          border-radius: 50%;
          margin: 0 auto 16px;
          color: var(--accent-gold);
          font-size: 1.6rem;
        }

        .barber-select-card.selected .avatar-placeholder {
          border-color: var(--accent-gold);
          background: rgba(197, 168, 128, 0.15);
        }

        /* Lista de Serviços */
        .services-list-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
        }

        .service-select-card {
          padding: 22px 28px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
        }

        .service-select-card:hover {
          transform: translateY(-2px);
        }

        .service-select-card.selected {
          border-color: var(--accent-gold);
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.06) 0%, rgba(197, 168, 128, 0.01) 100%);
        }

        .service-select-card.selected h3 {
          color: var(--accent-gold);
        }

        .service-details h3 {
          font-size: 1.15rem;
          margin-bottom: 6px;
          transition: color 0.2s ease;
        }

        .service-duration {
          color: var(--text-muted);
          font-size: 0.85rem;
          justify-content: flex-start;
        }

        .price-tag {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--accent-gold);
        }

        /* Seletor de Dias e Horários */
        .days-selector-wrapper {
          overflow-x: auto;
          padding-bottom: 10px;
          margin: 0 -10px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .days-selector-wrapper::-webkit-scrollbar {
          display: none; /* Safari e Chrome */
        }

        .days-list {
          display: flex;
          gap: 12px;
          padding: 0 10px;
        }

        .days-selector-wrapper {
          overflow-x: auto;
          padding-bottom: 10px;
          margin: 0 -10px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-snap-type: x mandatory;
        }

        .days-selector-wrapper::-webkit-scrollbar {
          display: none;
        }

        .day-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 20px;
          min-width: 90px;
          border-radius: 12px;
          cursor: pointer;
          border-color: var(--border-color);
          scroll-snap-align: start;
          user-select: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .day-btn:hover {
          border-color: rgba(197, 168, 128, 0.3);
        }

        .day-btn:active {
          transform: scale(0.96);
        }

        .day-btn.selected {
          border-color: var(--accent-gold);
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.12) 0%, rgba(197, 168, 128, 0.02) 100%);
        }

        .day-weekday {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .day-btn.selected .day-weekday {
          color: var(--accent-gold);
        }

        .day-label {
          font-size: 1.05rem;
          font-weight: 600;
          color: #ffffff;
        }

        .slots-container {
          padding: 30px;
          border-radius: 16px;
          margin-top: 10px;
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-slots {
          flex-direction: row;
        }

        .slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 14px;
          width: 100%;
        }

        .slot-btn {
          padding: 14px;
          border-radius: 10px;
          cursor: pointer;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
          user-select: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .slot-btn:active {
          transform: scale(0.95);
        }

        .slot-btn span {
          color: #ffffff;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .slot-clock-icon {
          color: var(--accent-gold);
        }

        .slot-btn:hover {
          border-color: var(--accent-gold);
          background: rgba(197, 168, 128, 0.04);
        }

        .slot-btn.selected {
          border-color: var(--accent-gold);
          color: #ffffff;
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.2) 0%, rgba(197, 168, 128, 0.05) 100%);
        }

        .slot-btn.selected .slot-clock-icon {
          color: #ffffff;
        }

        /* Resumo */
        .booking-summary-card {
          padding: 24px;
          border-radius: 14px;
          max-width: 540px;
          margin: 0 auto;
          width: 100%;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .summary-value {
          font-size: 0.95rem;
          font-weight: 500;
          color: #ffffff;
          justify-content: flex-start;
        }

        .summary-value.gold-text {
          color: var(--accent-gold);
          font-weight: 600;
        }

        /* Sucesso */
        .success-pane {
          padding: 40px 20px;
          text-align: center;
        }

        .success-icon-wrapper {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: rgba(197, 168, 128, 0.1);
          border: 1px solid rgba(197, 168, 128, 0.2);
          box-shadow: 0 0 30px rgba(197, 168, 128, 0.15);
        }

        .success-details-card {
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .success-details-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.95rem;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 12px;
        }

        .success-details-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .success-details-row span {
          color: var(--text-secondary);
        }

        .success-details-row strong {
          color: #ffffff;
        }

        .google-notification-box {
          border-radius: 12px;
        }

        .gold-text {
          color: var(--accent-gold);
        }

        .navigation-actions {
          width: 100%;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsividade */
        @media (max-width: 600px) {
          .steps-indicator {
            padding: 12px 14px;
            gap: 4px;
          }
          .step-dot span {
            width: 28px;
            height: 28px;
            font-size: 0.8rem;
          }
          .step-dot p {
            font-size: 0.65rem;
          }
          .step-line {
            margin: 0 4px;
            transform: translateY(-9px);
          }
          .summary-grid {
            grid-template-columns: 1fr;
          }
          .success-details-row {
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
          }
          .day-btn {
            min-width: 78px;
            padding: 12px 14px;
          }
          .slots-grid {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
            gap: 10px;
          }
          .slot-btn {
            padding: 16px 12px;
            min-height: 48px; /* Fitts' Law e touch target confortável */
          }
        }
      `}</style>
    </div>
  );
}
