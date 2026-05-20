"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Scissors,
  Settings,
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Tag,
  Loader2,
  Lock
} from "lucide-react";

interface Barber {
  id: string;
  name: string;
  email: string;
  isGoogleConnected: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  dateTime: string;
  barber: { name: string; email: string };
  service: { name: string; price: number; duration: number };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bookings" | "barbers" | "services" | "settings">("bookings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // States de Dados
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState({
    gtmId: "",
    openingTime: "09:00",
    closingTime: "19:00",
  });

  // States de Formulários
  const [newBarber, setNewBarber] = useState({ name: "", email: "" });
  const [newService, setNewService] = useState({ name: "", price: "", duration: "30" });
  const [changePassword, setChangePassword] = useState({ current: "", new: "", confirm: "" });
  const [actionLoading, setActionLoading] = useState(false);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Carrega em paralelo agendamentos, barbeiros, serviços e configurações
      const [bookingsRes, barbersRes, servicesRes, settingsRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/barbers"),
        fetch("/api/admin/services"),
        fetch("/api/admin/settings"),
      ]);

      if (bookingsRes.status === 401) {
        // Redireciona se a sessão expirou
        router.refresh();
        return;
      }

      const bookingsData = await bookingsRes.json();
      const barbersData = await barbersRes.json();
      const servicesData = await servicesRes.json();
      const settingsData = await settingsRes.json();

      setBookings(bookingsData.error ? [] : bookingsData);
      setBarbers(barbersData.error ? [] : barbersData);
      setServices(servicesData.error ? [] : servicesData);
      setSettings(settingsData.error ? { gtmId: "", openingTime: "09:00", closingTime: "19:00" } : settingsData);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar os dados administrativos.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Funções de Gerenciamento de Barbeiros
  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/barbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBarber),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao adicionar barbeiro.");

      setBarbers([data.barber, ...barbers]);
      setNewBarber({ name: "", email: "" });
      setSuccess("Barbeiro cadastrado com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBarber = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este barbeiro? Esta ação é irreversível.")) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/barbers?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover barbeiro.");

      setBarbers(barbers.filter((b) => b.id !== id));
      setSuccess("Barbeiro removido com sucesso.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Funções de Gerenciamento de Serviços
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao adicionar serviço.");

      setServices([data.service, ...services]);
      setNewService({ name: "", price: "", duration: "30" });
      setSuccess("Serviço cadastrado com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este serviço?")) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/services?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover serviço.");

      setServices(services.filter((s) => s.id !== id));
      setSuccess("Serviço removido com sucesso.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Funções de Configurações Gerais
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gtmId: settings.gtmId,
          openingTime: settings.openingTime,
          closingTime: settings.closingTime,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao salvar configurações.");

      setSuccess("Configurações gerais atualizadas com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (changePassword.new !== changePassword.confirm) {
      setError("A nova senha e a confirmação não conferem.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: changePassword.new,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao alterar a senha.");

      setChangePassword({ current: "", new: "", confirm: "" });
      setSuccess("Senha administrativa alterada com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Formatação de data
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header glass-card">
        <div className="header-logo">
          <Scissors className="logo-icon gold-glow" size={24} style={{ color: "var(--accent-gold)" }} />
          <h2 className="title-serif gold-glow">Barbearia Premium</h2>
          <span className="badge badge-gold">Administrador</span>
        </div>
        <button onClick={handleLogout} className="btn-logout flex-center">
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </header>

      {/* Main Layout */}
      <div className="dashboard-body">
        {/* Sidebar */}
        <aside className="dashboard-sidebar glass-card animate-fade-in">
          <nav className="sidebar-nav">
            <button
              onClick={() => { setActiveTab("bookings"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "bookings" ? "active" : ""}`}
            >
              <Calendar size={18} />
              <span>Agendamentos</span>
            </button>
            <button
              onClick={() => { setActiveTab("barbers"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "barbers" ? "active" : ""}`}
            >
              <Users size={18} />
              <span>Barbeiros</span>
            </button>
            <button
              onClick={() => { setActiveTab("services"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "services" ? "active" : ""}`}
            >
              <Scissors size={18} />
              <span>Serviços</span>
            </button>
            <button
              onClick={() => { setActiveTab("settings"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            >
              <Settings size={18} />
              <span>Configurações</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="dashboard-content animate-fade-in">
          {error && <div className="toast toast-error animate-slide-in">{error}</div>}
          {success && <div className="toast toast-success animate-slide-in">{success}</div>}

          {loading ? (
            <div className="loading-state flex-center flex-direction-column">
              <Loader2 size={40} className="spinner gold-glow" style={{ color: "var(--accent-gold)" }} />
              <p style={{ marginTop: "15px", color: "var(--text-secondary)" }}>Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* ABA AGENDAMENTOS */}
              {activeTab === "bookings" && (
                <div className="tab-pane">
                  <div className="pane-header">
                    <h3 className="title-serif">Histórico de Agendamentos</h3>
                    <p>Total de {bookings.length} reservas registradas no sistema local.</p>
                  </div>

                  <div className="glass-card table-wrapper">
                    {bookings.length === 0 ? (
                      <div className="empty-state">
                        <Calendar size={48} className="empty-icon" />
                        <h4>Nenhum agendamento encontrado</h4>
                        <p>Os agendamentos dos clientes aparecerão listados aqui.</p>
                      </div>
                    ) : (
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th>Data/Hora</th>
                            <th>Cliente</th>
                            <th>Contato</th>
                            <th>Barbeiro</th>
                            <th>Serviço</th>
                            <th>Preço</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.map((booking) => (
                            <tr key={booking.id} className="animate-fade-in">
                              <td className="font-weight-600">{formatDateTime(booking.dateTime)}</td>
                              <td>
                                <div className="client-info">
                                  <span className="client-name">{booking.clientName}</span>
                                </div>
                              </td>
                              <td>
                                <div className="client-contact">
                                  <span>{booking.clientEmail}</span>
                                  <span className="contact-phone">{booking.clientPhone}</span>
                                </div>
                              </td>
                              <td>
                                <span className="barber-badge">{booking.barber?.name || "Excluído"}</span>
                              </td>
                              <td>{booking.service?.name || "Desconhecido"}</td>
                              <td className="gold-text font-weight-600">
                                R$ {(booking.service?.price || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* ABA BARBEIROS */}
              {activeTab === "barbers" && (
                <div className="tab-pane">
                  <div className="pane-grid">
                    {/* Lista de Barbeiros */}
                    <div className="pane-list">
                      <div className="pane-header">
                        <h3 className="title-serif">Profissionais Cadastrados</h3>
                        <p>Agendas sincronizadas com o Google Calendar individual.</p>
                      </div>

                      <div className="barbers-list">
                        {barbers.length === 0 ? (
                          <div className="glass-card empty-state" style={{ padding: "40px" }}>
                            <Users size={36} className="empty-icon" />
                            <h4>Nenhum barbeiro cadastrado</h4>
                            <p>Cadastre um profissional no formulário ao lado para começar.</p>
                          </div>
                        ) : (
                          barbers.map((barber) => (
                            <div key={barber.id} className="glass-card barber-card animate-fade-in">
                              <div className="barber-card-info">
                                <h4>{barber.name}</h4>
                                <p>{barber.email}</p>
                                <div className="sync-status">
                                  {barber.isGoogleConnected ? (
                                    <span className="status-indicator success">
                                      <CheckCircle size={14} /> Agenda Google Sincronizada
                                    </span>
                                  ) : (
                                    <span className="status-indicator error">
                                      <XCircle size={14} /> Google Desconectado
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="barber-card-actions">
                                {!barber.isGoogleConnected ? (
                                  <a
                                    href={`/api/auth/google?barberId=${barber.id}`}
                                    className="btn-gold btn-sm"
                                    style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                                  >
                                    Conectar Agenda Google
                                  </a>
                                ) : (
                                  <span className="badge badge-success">Integrado</span>
                                )}
                                <button
                                  onClick={() => handleDeleteBarber(barber.id)}
                                  className="btn-delete"
                                  title="Remover Barbeiro"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Cadastrar Barbeiro */}
                    <div className="pane-form">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">Cadastrar Novo Barbeiro</h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                          Adicione um profissional. Posteriormente, ele deverá conectar sua própria conta do Google.
                        </p>

                        <form onSubmit={handleAddBarber}>
                          <div className="form-group">
                            <label className="form-label">Nome Completo</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: João Silva"
                              value={newBarber.name}
                              onChange={(e) => setNewBarber({ ...newBarber, name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">E-mail do Google (Gmail)</label>
                            <input
                              type="email"
                              className="form-input"
                              placeholder="Ex: joaosilva@gmail.com"
                              value={newBarber.email}
                              onChange={(e) => setNewBarber({ ...newBarber, email: e.target.value })}
                              required
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                              Deve ser o e-mail associado à agenda do Google que ele usará.
                            </small>
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "10px" }} disabled={actionLoading}>
                            {actionLoading ? "Processando..." : "Cadastrar Barbeiro"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA SERVIÇOS */}
              {activeTab === "services" && (
                <div className="tab-pane">
                  <div className="pane-grid">
                    {/* Lista de Serviços */}
                    <div className="pane-list">
                      <div className="pane-header">
                        <h3 className="title-serif">Catálogo de Serviços</h3>
                        <p>Serviços disponíveis para seleção dos clientes na tela de agendamentos.</p>
                      </div>

                      <div className="services-grid">
                        {services.length === 0 ? (
                          <div className="glass-card empty-state" style={{ padding: "40px" }}>
                            <Scissors size={36} className="empty-icon" />
                            <h4>Nenhum serviço disponível</h4>
                            <p>Crie um serviço no formulário ao lado.</p>
                          </div>
                        ) : (
                          services.map((service) => (
                            <div key={service.id} className="glass-card service-card animate-fade-in">
                              <div className="service-card-info">
                                <div className="service-title-row">
                                  <Tag size={16} style={{ color: "var(--accent-gold)", marginRight: "8px" }} />
                                  <h4>{service.name}</h4>
                                </div>
                                <div className="service-meta">
                                  <span className="meta-item"><Clock size={14} /> {service.duration} min</span>
                                  <span className="meta-item"><DollarSign size={14} /> R$ {service.price.toFixed(2)}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteService(service.id)}
                                className="btn-delete"
                                title="Excluir Serviço"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Cadastrar Serviço */}
                    <div className="pane-form">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">Adicionar Serviço</h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                          Cadastre os serviços oferecidos e seus respectivos tempos padrão e preços.
                        </p>

                        <form onSubmit={handleAddService}>
                          <div className="form-group">
                            <label className="form-label">Nome do Serviço</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: Corte Degradê ou Barba Completa"
                              value={newService.name}
                              onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Preço (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input"
                              placeholder="Ex: 50.00"
                              value={newService.price}
                              onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Duração (Minutos)</label>
                            <select
                              className="form-input"
                              value={newService.duration}
                              onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                            >
                              <option value="15">15 minutos</option>
                              <option value="30">30 minutos</option>
                              <option value="45">45 minutos</option>
                              <option value="60">60 minutos (1h)</option>
                              <option value="75">75 minutos</option>
                              <option value="90">90 minutos (1h30)</option>
                              <option value="120">120 minutos (2h)</option>
                            </select>
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "10px" }} disabled={actionLoading}>
                            {actionLoading ? "Cadastrando..." : "Adicionar Serviço"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA CONFIGURAÇÕES */}
              {activeTab === "settings" && (
                <div className="tab-pane">
                  <div className="pane-grid">
                    {/* Parâmetros do Sistema */}
                    <div className="pane-list">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">Configurações de Funcionamento</h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                          Configure o código de rastreamento do GTM e as janelas de funcionamento da barbearia.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          <div className="form-group">
                            <label className="form-label">Google Tag Manager ID (GTM)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: GTM-XXXXXX"
                              value={settings.gtmId}
                              onChange={(e) => setSettings({ ...settings, gtmId: e.target.value })}
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                              Insira apenas o ID. O script correspondente será injetado e otimizado automaticamente do lado do cliente.
                            </small>
                          </div>

                          <div className="form-group-row">
                            <div className="form-group">
                              <label className="form-label">Horário de Abertura</label>
                              <input
                                type="time"
                                className="form-input"
                                value={settings.openingTime}
                                onChange={(e) => setSettings({ ...settings, openingTime: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Horário de Fechamento</label>
                              <input
                                type="time"
                                className="form-input"
                                value={settings.closingTime}
                                onChange={(e) => setSettings({ ...settings, closingTime: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "15px" }} disabled={actionLoading}>
                            {actionLoading ? "Salvando..." : "Salvar Configurações"}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Alterar Senha Admin */}
                    <div className="pane-form">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">Alterar Senha do Painel</h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                          Modifique a senha mestra de acesso a este painel administrativo por segurança.
                        </p>

                        <form onSubmit={handleChangePasswordSubmit}>
                          <div className="form-group">
                            <label className="form-label">Nova Senha</label>
                            <input
                              type="password"
                              className="form-input"
                              placeholder="Digite a nova senha"
                              value={changePassword.new}
                              onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Confirmar Nova Senha</label>
                            <input
                              type="password"
                              className="form-input"
                              placeholder="Confirme a nova senha"
                              value={changePassword.confirm}
                              onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })}
                              required
                            />
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "10px" }} disabled={actionLoading}>
                            {actionLoading ? "Atualizando..." : "Alterar Senha"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          background: #060608;
          color: var(--text-primary);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          border-radius: 14px;
        }

        .header-logo {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-logo h2 {
          font-size: 1.4rem;
        }

        .logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-logout {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--status-error);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.9rem;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.15);
          transform: translateY(-1px);
        }

        .dashboard-body {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          flex: 1;
        }

        .dashboard-sidebar {
          padding: 20px 12px;
          border-radius: 14px;
          height: fit-content;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 14px 18px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 500;
          width: 100%;
          text-align: left;
          transition: all 0.25s ease;
        }

        .nav-item:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.03);
          padding-left: 22px;
        }

        .nav-item.active {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.15) 0%, rgba(197, 168, 128, 0.03) 100%);
          border-left: 3px solid var(--accent-gold);
          padding-left: 22px;
        }

        .dashboard-content {
          min-height: 500px;
          display: flex;
          flex-direction: column;
        }

        .loading-state {
          flex: 1;
          height: 100%;
          min-height: 400px;
        }

        .tab-pane {
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: fadeIn 0.4s ease;
        }

        .pane-header {
          margin-bottom: 8px;
        }

        .pane-header h3 {
          font-size: 1.7rem;
          margin-bottom: 4px;
        }

        .pane-header p {
          font-size: 0.95rem;
          color: var(--text-muted);
        }

        .pane-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 24px;
          align-items: start;
        }

        .pane-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pane-form {
          position: sticky;
          top: 24px;
        }

        .form-card {
          padding: 28px;
          border-radius: 14px;
        }

        .form-card h3 {
          font-size: 1.3rem;
          margin-bottom: 8px;
        }

        .form-group-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* Lista de Barbeiros */
        .barbers-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .barber-card {
          padding: 20px 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .barber-card-info h4 {
          font-size: 1.1rem;
          margin-bottom: 4px;
        }

        .barber-card-info p {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .sync-status {
          display: flex;
          align-items: center;
        }

        .status-indicator {
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .status-indicator.success {
          color: var(--status-success);
        }

        .status-indicator.error {
          color: var(--status-error);
        }

        .barber-card-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .btn-delete {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.1);
          color: var(--text-muted);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .btn-delete:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: var(--status-error);
          transform: scale(1.05);
        }

        /* Lista de Serviços */
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .service-card {
          padding: 18px 20px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .service-title-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .service-title-row h4 {
          font-size: 1.05rem;
        }

        .service-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Tabela Premium */
        .table-wrapper {
          border-radius: 14px;
          overflow: hidden;
          padding: 12px;
        }

        .premium-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.95rem;
        }

        .premium-table th {
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .premium-table td {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-light);
          color: var(--text-secondary);
        }

        .premium-table tr:last-child td {
          border-bottom: none;
        }

        .premium-table tbody tr {
          transition: background-color 0.2s ease;
        }

        .premium-table tbody tr:hover {
          background-color: rgba(255, 255, 255, 0.01);
        }

        .font-weight-600 {
          font-weight: 600;
        }

        .gold-text {
          color: var(--accent-gold);
        }

        .client-name {
          color: #ffffff;
          font-weight: 500;
          display: block;
        }

        .client-contact {
          display: flex;
          flex-direction: column;
          font-size: 0.8rem;
        }

        .contact-phone {
          color: var(--text-muted);
          margin-top: 2px;
        }

        .barber-badge {
          background: rgba(197, 168, 128, 0.08);
          border: 1px solid rgba(197, 168, 128, 0.15);
          color: var(--accent-gold);
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
        }

        /* Toasts de Ação */
        .toast {
          position: fixed;
          top: 24px;
          right: 24px;
          padding: 16px 24px;
          border-radius: 10px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          font-weight: 500;
          font-size: 0.9rem;
          max-width: 400px;
        }

        .toast-success {
          background: #0f1c15;
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: var(--status-success);
        }

        .toast-error {
          background: #1e1313;
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--status-error);
        }

        /* Empty States */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: var(--text-secondary);
        }

        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state h4 {
          font-size: 1.15rem;
          margin-bottom: 6px;
          color: #ffffff;
        }

        .empty-state p {
          font-size: 0.9rem;
          color: var(--text-muted);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsividade */
        @media (max-width: 1024px) {
          .dashboard-body {
            grid-template-columns: 1fr;
          }
          .pane-grid {
            grid-template-columns: 1fr;
          }
          .pane-form {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .dashboard-container {
            padding: 12px;
          }
          .dashboard-header {
            padding: 12px 18px;
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
          .premium-table {
            font-size: 0.85rem;
          }
          .premium-table th, .premium-table td {
            padding: 10px 8px;
          }
        }
      `}</style>
    </div>
  );
}
