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
  Lock,
  Edit
} from "lucide-react";

interface Barber {
  id: string;
  name: string;
  email: string;
  openingTime: string;
  closingTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  workDays?: string;
}

interface BarberBlock {
  id: string;
  barberId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  barber?: { name: string };
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  barbers?: Barber[];
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
  const [activeTab, setActiveTab] = useState<"bookings" | "barbers" | "services" | "settings" | "esquadro">("bookings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // States de Dados
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barberBlocks, setBarberBlocks] = useState<BarberBlock[]>([]);
  const [settings, setSettings] = useState({
    gtmId: "",
    openingTime: "09:00",
    closingTime: "19:00",
    barberShopName: "Barbearia Premium",
    logoUrl: "",
    address: "",
    phone: "",
  });

  // States de Formulários
  const [newBarber, setNewBarber] = useState({ 
    name: "", 
    email: "", 
    openingTime: "09:00", 
    closingTime: "19:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    workDays: "1,2,3,4,5,6"
  });
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  
  // newService agora inclui barberIds para o relacionamento N-N
  const [newService, setNewService] = useState({ 
    name: "", 
    price: "", 
    duration: "30",
    barberIds: [] as string[]
  });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // States do Esquadro do Dia / Bloqueios
  const [selectedTimelineBarberId, setSelectedTimelineBarberId] = useState<string>("");
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>("");
  const [newBlock, setNewBlock] = useState({
    startTime: "14:00",
    endTime: "15:00",
    reason: "",
  });

  const [changePassword, setChangePassword] = useState({ current: "", new: "", confirm: "" });
  const [actionLoading, setActionLoading] = useState(false);

  // Pega a data local de hoje no formato YYYY-MM-DD
  const getTodayLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Gera slots de 30 em 30 min com base no expediente do barbeiro selecionado
  const getTimelineSlots = () => {
    const activeBarber = barbers.find(b => b.id === selectedTimelineBarberId);
    const start = activeBarber?.openingTime || "09:00";
    const end = activeBarber?.closingTime || "19:00";
    
    const slots = [];
    let current = start;
    
    while (current <= end) {
      slots.push(current);
      
      const [hStr, mStr] = current.split(":");
      let h = parseInt(hStr);
      let m = parseInt(mStr) + 30;
      if (m >= 60) {
        h += 1;
        m -= 60;
      }
      const newHStr = String(h).padStart(2, "0");
      const newMStr = String(m).padStart(2, "0");
      current = `${newHStr}:${newMStr}`;
      
      if (current > "23:30" || current === start) break;
    }
    return slots;
  };

  // Carregar dados na inicialização
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Carrega em paralelo agendamentos, barbeiros, serviços, bloqueios e configurações
      const [bookingsRes, barbersRes, servicesRes, settingsRes, blocksRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/barbers"),
        fetch("/api/admin/services"),
        fetch("/api/admin/settings"),
        fetch("/api/admin/barber-blocks"),
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
      const blocksData = await blocksRes.json();

      setBookings(bookingsData.error ? [] : bookingsData);
      
      const loadedBarbers = barbersData.error ? [] : barbersData;
      setBarbers(loadedBarbers);
      setServices(servicesData.error ? [] : servicesData);
      setBarberBlocks(blocksData.error ? [] : blocksData);
      setSettings(settingsData.error ? { gtmId: "", openingTime: "09:00", closingTime: "19:00" } : settingsData);
      
      // Inicializa estados da timeline
      if (loadedBarbers.length > 0) {
        setSelectedTimelineBarberId(loadedBarbers[0].id);
      }
      setSelectedTimelineDate(getTodayLocalDateString());
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

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento? Esta ação é irreversível.")) return;
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/bookings?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao cancelar agendamento.");

      setBookings(bookings.filter((b) => b.id !== id));
      setSuccess("Agendamento cancelado com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Funções de Gerenciamento de Barbeiros
  const handleAddBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const isEditing = editingBarberId !== null;
      const url = "/api/admin/barbers";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing ? { ...newBarber, id: editingBarberId } : newBarber;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Erro ao ${isEditing ? "editar" : "adicionar"} barbeiro.`);

      if (isEditing) {
        setBarbers(barbers.map((b) => (b.id === editingBarberId ? data.barber : b)));
        setSuccess("Barbeiro atualizado com sucesso!");
      } else {
        setBarbers([data.barber, ...barbers]);
        setSuccess("Barbeiro cadastrado com sucesso!");
      }

      setNewBarber({
        name: "",
        email: "",
        openingTime: "09:00",
        closingTime: "19:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
        workDays: "1,2,3,4,5,6",
      });
      setEditingBarberId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditBarberClick = (barber: Barber) => {
    setNewBarber({
      name: barber.name,
      email: barber.email,
      openingTime: barber.openingTime || "09:00",
      closingTime: barber.closingTime || "19:00",
      lunchStart: barber.lunchStart || "12:00",
      lunchEnd: barber.lunchEnd || "13:00",
      workDays: barber.workDays || "1,2,3,4,5,6",
    });
    setEditingBarberId(barber.id);
    setError("");
    setSuccess("");
  };

  const handleCancelEditBarber = () => {
    setNewBarber({
      name: "",
      email: "",
      openingTime: "09:00",
      closingTime: "19:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
      workDays: "1,2,3,4,5,6",
    });
    setEditingBarberId(null);
    setError("");
    setSuccess("");
  };

  const handleDeleteBarber = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este barbeiro? Esta ação é irreversível e removerá todos os agendamentos dele.")) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/barbers?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover barbeiro.");

      setBarbers(barbers.filter((b) => b.id !== id));
      setSuccess("Barbeiro removido com sucesso.");
      
      // Atualiza lista de agendamentos localmente caso tenham sido deletados em cascata
      const bookingsRes = await fetch("/api/admin/bookings");
      const bookingsData = await bookingsRes.json();
      setBookings(bookingsData.error ? [] : bookingsData);
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
      const isEditing = editingServiceId !== null;
      const url = "/api/admin/services";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing ? { ...newService, id: editingServiceId } : newService;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Erro ao ${isEditing ? "editar" : "adicionar"} serviço.`);

      if (isEditing) {
        setServices(services.map((s) => (s.id === editingServiceId ? data.service : s)));
        setSuccess("Serviço atualizado com sucesso!");
      } else {
        setServices([data.service, ...services]);
        setSuccess("Serviço cadastrado com sucesso!");
      }

      setNewService({ name: "", price: "", duration: "30", barberIds: [] });
      setEditingServiceId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditServiceClick = (service: Service) => {
    setNewService({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      barberIds: service.barbers ? service.barbers.map(b => b.id) : []
    });
    setEditingServiceId(service.id);
    setError("");
    setSuccess("");
  };

  const handleCancelEditService = () => {
    setNewService({ name: "", price: "", duration: "30", barberIds: [] });
    setEditingServiceId(null);
    setError("");
    setSuccess("");
  };

  const toggleServiceBarber = (barberId: string) => {
    const ids = [...newService.barberIds];
    if (ids.includes(barberId)) {
      setNewService({ ...newService, barberIds: ids.filter(id => id !== barberId) });
    } else {
      setNewService({ ...newService, barberIds: [...ids, barberId] });
    }
  };

  // Funções de Gerenciamento de Bloqueios
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimelineBarberId) {
      setError("Selecione um barbeiro para adicionar o bloqueio.");
      return;
    }
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/barber-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: selectedTimelineBarberId,
          date: selectedTimelineDate,
          startTime: newBlock.startTime,
          endTime: newBlock.endTime,
          reason: newBlock.reason,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao adicionar bloqueio.");

      setBarberBlocks([data.block, ...barberBlocks]);
      setNewBlock({ startTime: "14:00", endTime: "15:00", reason: "" });
      setSuccess("Horário bloqueado com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este bloqueio de horário?")) return;
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/barber-blocks?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover bloqueio.");

      setBarberBlocks(barberBlocks.filter((b) => b.id !== id));
      setSuccess("Bloqueio removido com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este serviço? Esta ação removerá todos os agendamentos dele.")) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/services?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover serviço.");

      setServices(services.filter((s) => s.id !== id));
      setSuccess("Serviço removido com sucesso.");

      // Atualiza lista de agendamentos localmente caso tenham sido deletados em cascata
      const bookingsRes = await fetch("/api/admin/bookings");
      const bookingsData = await bookingsRes.json();
      setBookings(bookingsData.error ? [] : bookingsData);
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
          barberShopName: settings.barberShopName,
          logoUrl: settings.logoUrl,
          address: settings.address,
          phone: settings.phone,
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

  const daysOfWeek = [
    { value: 0, label: "D" },
    { value: 1, label: "S" },
    { value: 2, label: "T" },
    { value: 3, label: "Q" },
    { value: 4, label: "Q" },
    { value: 5, label: "S" },
    { value: 6, label: "S" }
  ];

  const getWorkDaysNames = (daysStr?: string) => {
    if (!daysStr) return "Seg a Sáb";
    const days = daysStr.split(",").filter(Boolean).map(Number);
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days.map(d => dayNames[d]).join(", ");
  };

  const toggleDay = (dayVal: number) => {
    const days = newBarber.workDays ? newBarber.workDays.split(",").filter(Boolean).map(Number) : [];
    let newDays;
    if (days.includes(dayVal)) {
      newDays = days.filter(d => d !== dayVal);
    } else {
      newDays = [...days, dayVal].sort((a, b) => a - b);
    }
    setNewBarber({ ...newBarber, workDays: newDays.join(",") });
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
              onClick={() => { setActiveTab("esquadro"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "esquadro" ? "active" : ""}`}
            >
              <Clock size={18} />
              <span>Esquadro do Dia</span>
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
                            <th style={{ textAlign: "center" }}>Ações</th>
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
                              <td style={{ textAlign: "center" }}>
                                <button
                                  onClick={() => handleDeleteBooking(booking.id)}
                                  className="btn-delete"
                                  title="Cancelar Agendamento"
                                >
                                  <Trash2 size={16} />
                                </button>
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
                        <p>Cada barbeiro define seus próprios horários e dias de atendimento.</p>
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
                              <div className="barber-card-info" style={{ flex: 1 }}>
                                <h4 className="gold-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>{barber.name}</h4>
                                <p style={{ margin: "2px 0 8px 0" }}>{barber.email}</p>
                                <div className="barber-meta-details" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <div className="status-indicator success" style={{ fontSize: "0.8rem" }}>
                                    <Clock size={14} style={{ color: "var(--accent-gold)" }} /> 
                                    <span><strong>Expediente:</strong> {barber.openingTime} às {barber.closingTime}</span>
                                  </div>
                                  {barber.lunchStart && barber.lunchEnd && (
                                    <div className="status-indicator success" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                      <Clock size={14} style={{ opacity: 0.7 }} /> 
                                      <span><strong>Almoço:</strong> {barber.lunchStart} às {barber.lunchEnd}</span>
                                    </div>
                                  )}
                                  <div className="status-indicator success" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                    <Calendar size={14} style={{ opacity: 0.7 }} /> 
                                    <span><strong>Dias de trabalho:</strong> {getWorkDaysNames(barber.workDays)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="barber-card-actions" style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
                                <button
                                  onClick={() => handleEditBarberClick(barber)}
                                  className="btn-edit-action"
                                  title="Editar Barbeiro"
                                  style={{
                                    background: "rgba(197, 168, 128, 0.05)",
                                    border: "1px solid rgba(197, 168, 128, 0.15)",
                                    color: "var(--accent-gold)",
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "all 0.2s ease"
                                  }}
                                >
                                  <Edit size={16} />
                                </button>
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

                    {/* Cadastrar/Editar Barbeiro */}
                    <div className="pane-form">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">
                          {editingBarberId ? "Editar Barbeiro" : "Cadastrar Novo Barbeiro"}
                        </h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                          {editingBarberId 
                            ? "Atualize as informações do profissional selecionado." 
                            : "Adicione um profissional e defina seus horários de atendimento e folgas."
                          }
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
                            <label className="form-label">E-mail</label>
                            <input
                              type="email"
                              className="form-input"
                              placeholder="Ex: joaosilva@email.com"
                              value={newBarber.email}
                              onChange={(e) => setNewBarber({ ...newBarber, email: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group-row">
                            <div className="form-group">
                              <label className="form-label">Horário de Entrada</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBarber.openingTime}
                                onChange={(e) => setNewBarber({ ...newBarber, openingTime: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Horário de Saída</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBarber.closingTime}
                                onChange={(e) => setNewBarber({ ...newBarber, closingTime: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group-row" style={{ marginTop: "8px" }}>
                            <div className="form-group">
                              <label className="form-label">Início do Almoço</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBarber.lunchStart}
                                onChange={(e) => setNewBarber({ ...newBarber, lunchStart: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Fim do Almoço</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBarber.lunchEnd}
                                onChange={(e) => setNewBarber({ ...newBarber, lunchEnd: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginTop: "12px", marginBottom: "16px" }}>
                            <label className="form-label" style={{ display: "block", marginBottom: "6px" }}>
                              Dias de Trabalho
                            </label>
                            <div className="days-selector" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {daysOfWeek.map((day) => {
                                const isActive = newBarber.workDays 
                                  ? newBarber.workDays.split(",").filter(Boolean).map(Number).includes(day.value) 
                                  : false;
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleDay(day.value)}
                                    className={`day-btn ${isActive ? "active" : ""}`}
                                    style={{
                                      width: "34px",
                                      height: "34px",
                                      borderRadius: "50%",
                                      border: isActive ? "1px solid var(--accent-gold)" : "1px solid rgba(255,255,255,0.1)",
                                      background: isActive ? "linear-gradient(135deg, rgba(197, 168, 128, 0.25) 0%, rgba(197, 168, 128, 0.05) 100%)" : "rgba(255,255,255,0.02)",
                                      color: isActive ? "var(--accent-gold)" : "var(--text-secondary)",
                                      cursor: "pointer",
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      transition: "all 0.2s ease"
                                    }}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                            <small style={{ display: "block", marginTop: "6px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                              Selecione os dias da semana em que este profissional atende.
                            </small>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                            <button type="submit" className="btn-gold" style={{ width: "100%" }} disabled={actionLoading}>
                              {actionLoading ? "Processando..." : (editingBarberId ? "Salvar Alterações" : "Cadastrar Barbeiro")}
                            </button>
                            {editingBarberId && (
                              <button
                                type="button"
                                onClick={handleCancelEditBarber}
                                className="btn-secondary"
                                style={{
                                  width: "100%",
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  color: "var(--text-secondary)",
                                  padding: "12px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                  fontSize: "0.95rem",
                                  transition: "all 0.2s ease"
                                }}
                              >
                                Cancelar Edição
                              </button>
                            )}
                          </div>
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
                            <div key={service.id} className="glass-card service-card animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "12px", padding: "20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div className="service-card-info" style={{ flex: 1 }}>
                                  <div className="service-title-row">
                                    <Tag size={16} style={{ color: "var(--accent-gold)", marginRight: "8px" }} />
                                    <h4 className="gold-text" style={{ fontSize: "1.1rem", fontWeight: 600 }}>{service.name}</h4>
                                  </div>
                                  <div className="service-meta" style={{ marginTop: "4px" }}>
                                    <span className="meta-item"><Clock size={14} /> {service.duration} min</span>
                                    <span className="meta-item"><DollarSign size={14} /> R$ {Number(service.price).toFixed(2)}</span>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    onClick={() => handleEditServiceClick(service)}
                                    className="btn-edit-action"
                                    title="Editar Serviço"
                                    style={{
                                      background: "rgba(197, 168, 128, 0.05)",
                                      border: "1px solid rgba(197, 168, 128, 0.15)",
                                      color: "var(--accent-gold)",
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "8px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      transition: "all 0.2s ease"
                                    }}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteService(service.id)}
                                    className="btn-delete"
                                    title="Excluir Serviço"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Lista de barbeiros que fazem este serviço */}
                              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "8px" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                                  <strong>Oferecido por:</strong>
                                </span>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                  {service.barbers && service.barbers.length > 0 ? (
                                    service.barbers.map((b) => (
                                      <span key={b.id} className="barber-badge" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                                        {b.name}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ fontSize: "0.7rem", color: "var(--status-error)", fontStyle: "italic" }}>
                                      Nenhum profissional vinculado
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Cadastrar/Editar Serviço */}
                    <div className="pane-form">
                      <div className="glass-card form-card">
                        <h3 className="title-serif gold-glow">
                          {editingServiceId ? "Editar Serviço" : "Adicionar Serviço"}
                        </h3>
                        <p style={{ marginBottom: "20px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                          {editingServiceId 
                            ? "Atualize as informações e os profissionais deste serviço." 
                            : "Cadastre os serviços oferecidos, tempos padrão, preços e barbeiros credenciados."
                          }
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

                          <div className="form-group" style={{ marginTop: "12px", marginBottom: "16px" }}>
                            <label className="form-label" style={{ display: "block", marginBottom: "8px" }}>
                              Profissionais que oferecem este serviço
                            </label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                              {barbers.length === 0 ? (
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                  Nenhum barbeiro cadastrado no sistema.
                                </p>
                              ) : (
                                barbers.map((barber) => {
                                  const isChecked = newService.barberIds.includes(barber.id);
                                  return (
                                    <label key={barber.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem", color: isChecked ? "var(--accent-gold)" : "var(--text-secondary)" }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleServiceBarber(barber.id)}
                                        style={{
                                          accentColor: "var(--accent-gold)",
                                          width: "16px",
                                          height: "16px",
                                          cursor: "pointer"
                                        }}
                                      />
                                      <span>{barber.name}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
                            <button type="submit" className="btn-gold" style={{ width: "100%" }} disabled={actionLoading}>
                              {actionLoading ? "Processando..." : (editingServiceId ? "Salvar Alterações" : "Adicionar Serviço")}
                            </button>
                            {editingServiceId && (
                              <button
                                type="button"
                                onClick={handleCancelEditService}
                                className="btn-secondary"
                                style={{
                                  width: "100%",
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  color: "var(--text-secondary)",
                                  padding: "12px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                  fontSize: "0.95rem",
                                  transition: "all 0.2s ease"
                                }}
                              >
                                Cancelar Edição
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA ESQUADRO DO DIA (NOVA) */}
              {activeTab === "esquadro" && (
                <div className="tab-pane">
                  <div className="pane-header">
                    <h3 className="title-serif">Esquadro do Dia</h3>
                    <p>Timeline visual completa dos horários, bloqueios e agendamentos de cada profissional.</p>
                  </div>

                  <div className="pane-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
                    
                    {/* TIMELINE PRINCIPAL (COLUNA ESQUERDA) */}
                    <div className="glass-card" style={{ padding: "24px", borderRadius: "14px" }}>
                      
                      {/* Controles do topo da timeline */}
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <label className="form-label" style={{ display: "block", marginBottom: "6px" }}>Selecionar Barbeiro</label>
                          <select
                            className="form-input"
                            value={selectedTimelineBarberId}
                            onChange={(e) => setSelectedTimelineBarberId(e.target.value)}
                            style={{ width: "100%" }}
                          >
                            {barbers.length === 0 ? (
                              <option value="">Nenhum barbeiro cadastrado</option>
                            ) : (
                              barbers.map((barber) => (
                                <option key={barber.id} value={barber.id}>
                                  {barber.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: "150px" }}>
                          <label className="form-label" style={{ display: "block", marginBottom: "6px" }}>Selecionar Data</label>
                          <input
                            type="date"
                            className="form-input"
                            value={selectedTimelineDate}
                            onChange={(e) => setSelectedTimelineDate(e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>

                      {/* Lista de Slots de Horários */}
                      <div className="timeline-wrapper" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {barbers.length === 0 ? (
                          <div className="empty-state">
                            <Users size={48} className="empty-icon" />
                            <h4>Nenhum profissional cadastrado</h4>
                            <p>Cadastre barbeiros na aba Barbeiros para gerenciar suas agendas.</p>
                          </div>
                        ) : (
                          (() => {
                            const slots = getTimelineSlots();
                            const activeBarber = barbers.find(b => b.id === selectedTimelineBarberId);
                            
                            if (slots.length === 0) {
                              return (
                                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                                  Nenhum slot disponível no expediente deste profissional.
                                </div>
                              );
                            }

                            return slots.map((timeSlot) => {
                              // 1. Verificar Almoço
                              const isLunch = activeBarber?.lunchStart && activeBarber?.lunchEnd &&
                                (timeSlot >= activeBarber.lunchStart && timeSlot < activeBarber.lunchEnd);
                              
                              // 2. Verificar Bloqueio
                              const block = barberBlocks.find(b => 
                                b.barberId === selectedTimelineBarberId && 
                                b.date === selectedTimelineDate && 
                                timeSlot >= b.startTime && 
                                timeSlot < b.endTime
                              );
                              
                              // 3. Verificar Agendamento (cobertura)
                              let activeBooking: Booking | undefined;
                              let isBookingStart = false;
                              let bookingStartHour = "";

                              const coveringBooking = bookings.find(b => {
                                if (b.barber?.email !== activeBarber?.email) return false;
                                const d = new Date(b.dateTime);
                                
                                const year = d.getFullYear();
                                const month = String(d.getMonth() + 1).padStart(2, "0");
                                const day = String(d.getDate()).padStart(2, "0");
                                const dateStr = `${year}-${month}-${day}`;
                                if (dateStr !== selectedTimelineDate) return false;

                                const bookingMin = d.getHours() * 60 + d.getMinutes();
                                const duration = b.service?.duration || 30;
                                
                                const [slotH, slotM] = timeSlot.split(":").map(Number);
                                const slotMin = slotH * 60 + slotM;
                                
                                const isCovered = slotMin >= bookingMin && slotMin < (bookingMin + duration);
                                if (isCovered) {
                                  const startHour = String(d.getHours()).padStart(2, "0");
                                  const startMin = String(d.getMinutes()).padStart(2, "0");
                                  bookingStartHour = `${startHour}:${startMin}`;
                                  
                                  if (timeSlot === bookingStartHour) {
                                    isBookingStart = true;
                                  }
                                }
                                return isCovered;
                              });

                              if (coveringBooking) {
                                activeBooking = coveringBooking;
                              }

                              if (isLunch) {
                                return (
                                  <div key={timeSlot} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px dashed rgba(255, 255, 255, 0.08)" }}>
                                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-muted)", width: "60px" }}>{timeSlot}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                      <Clock size={14} style={{ opacity: 0.5 }} />
                                      <span>Horário de Almoço do Profissional</span>
                                    </div>
                                  </div>
                                );
                              }

                              if (block) {
                                return (
                                  <div key={timeSlot} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.03)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                                    <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--status-error)", width: "60px" }}>{timeSlot}</span>
                                    <div style={{ display: "flex", flex: 1, justifyContent: "space-between", alignItems: "center" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <Lock size={14} style={{ color: "var(--status-error)" }} />
                                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                          <strong>Bloqueado:</strong> {block.reason || "Ausência/Consulta"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBlock(block.id)}
                                        className="btn-delete"
                                        title="Remover Bloqueio"
                                        style={{ padding: "4px 8px", width: "auto", height: "auto" }}
                                      >
                                        Desbloquear
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              if (activeBooking) {
                                if (isBookingStart) {
                                  return (
                                    <div key={timeSlot} style={{ display: "flex", gap: "16px", alignItems: "flex-start", padding: "16px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(197, 168, 128, 0.1) 0%, rgba(197, 168, 128, 0.02) 100%)", border: "1px solid rgba(197, 168, 128, 0.25)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                                      <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-gold)", width: "60px", marginTop: "2px" }}>{timeSlot}</span>
                                      <div style={{ display: "flex", flex: 1, gap: "12px", justifyContent: "space-between", flexWrap: "wrap" }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#ffffff" }}>{activeBooking.clientName}</span>
                                            <span className="barber-badge" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{activeBooking.service?.name}</span>
                                          </div>
                                          <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                            <span><strong>Duração:</strong> {activeBooking.service?.duration} min</span>
                                            <span><strong>Preço:</strong> R$ {activeBooking.service?.price?.toFixed(2)}</span>
                                            <span style={{ color: "var(--text-secondary)" }}><strong>Tel:</strong> {activeBooking.clientPhone}</span>
                                          </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          {activeBooking.clientPhone && (
                                            <a
                                              href={`https://wa.me/${activeBooking.clientPhone.replace(/\D/g, "")}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="btn-gold"
                                              style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                fontSize: "0.75rem",
                                                textDecoration: "none",
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                              }}
                                            >
                                              WhatsApp
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteBooking(activeBooking!.id)}
                                            className="btn-delete"
                                            title="Cancelar Reserva"
                                            style={{ width: "30px", height: "30px" }}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div key={timeSlot} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "10px 16px", borderRadius: "10px", background: "rgba(197, 168, 128, 0.02)", borderLeft: "3px solid var(--accent-gold)", opacity: 0.8 }}>
                                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-secondary)", width: "60px" }}>{timeSlot}</span>
                                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                        ↳ <strong>Ocupado:</strong> Continuação do agendamento de <strong>{activeBooking.clientName}</strong> ({activeBooking.service?.name}) iniciado às {bookingStartHour}
                                      </span>
                                    </div>
                                  );
                                }
                              }

                              return (
                                <div key={timeSlot} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", transition: "all 0.2s ease" }}>
                                  <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)", width: "60px" }}>{timeSlot}</span>
                                  <div style={{ display: "flex", flex: 1, justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Horário disponível</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewBlock({ ...newBlock, startTime: timeSlot, endTime: (() => {
                                          const [h, m] = timeSlot.split(":").map(Number);
                                          let nm = m + 30;
                                          let nh = h;
                                          if (nm >= 60) {
                                            nh += 1;
                                            nm -= 60;
                                          }
                                          return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
                                        })() });
                                      }}
                                      className="btn-gold"
                                      style={{ padding: "4px 10px", fontSize: "0.75rem", background: "transparent", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)" }}
                                    >
                                      + Bloquear
                                    </button>
                                  </div>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>

                    {/* BLOQUEIOS & FORMULÁRIO RÁPIDO (COLUNA DIREITA) */}
                    <div className="pane-form">
                      
                      {/* Formulário de bloqueio rápido */}
                      <div className="glass-card form-card" style={{ marginBottom: "20px" }}>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Bloquear Horário</h4>
                        <p style={{ marginBottom: "16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Defina uma ausência programada (ex: consulta médica) para desativar os slots correspondentes.
                        </p>

                        <form onSubmit={handleAddBlock}>
                          <div className="form-group-row">
                            <div className="form-group">
                              <label className="form-label">Início</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBlock.startTime}
                                onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Fim</label>
                              <input
                                type="time"
                                className="form-input"
                                value={newBlock.endTime}
                                onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginTop: "10px" }}>
                            <label className="form-label">Motivo (Opcional)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: Consulta médica, Almoço estendido"
                              value={newBlock.reason}
                              onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                            />
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "12px" }} disabled={actionLoading}>
                            {actionLoading ? "Bloqueando..." : "Confirmar Bloqueio"}
                          </button>
                        </form>
                      </div>

                      {/* Lista de bloqueios futuros do barbeiro ativo */}
                      <div className="glass-card form-card">
                        <h4 className="title-serif" style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "12px" }}>Ausências Cadastradas</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                          {barberBlocks.filter(b => b.barberId === selectedTimelineBarberId).length === 0 ? (
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "10px" }}>
                              Nenhum bloqueio cadastrado para este barbeiro.
                            </p>
                          ) : (
                            barberBlocks
                              .filter(b => b.barberId === selectedTimelineBarberId)
                              .map((block) => (
                                <div key={block.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                  <div>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block" }}>
                                      {block.date.split("-").reverse().join("/")}
                                    </span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                      {block.startTime} às {block.endTime}
                                    </span>
                                    {block.reason && (
                                      <span style={{ display: "block", fontSize: "0.7rem", color: "var(--accent-gold)", marginTop: "2px" }}>
                                        {block.reason}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="btn-delete"
                                    title="Remover Bloqueio"
                                    style={{ width: "28px", height: "28px" }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* ABA CONFIGURAÇÕES */}
              {activeTab === "settings" && (
                <div className="tab-pane">
                  <div className="pane-header">
                    <h3 className="title-serif">Configurações Gerais</h3>
                    <p>Gerencie a identidade visual, horários, rastreamento e segurança da barbearia.</p>
                  </div>

                  <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px", marginTop: "8px" }}>
                    {/* Card 1: Identidade Visual & Contato */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Identidade & Contato</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Nome institucional, logotipo e dados de contato público exibidos ao cliente.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          <div className="form-group">
                            <label className="form-label">Nome da Barbearia</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: Barbearia Premium"
                              value={settings.barberShopName || ""}
                              onChange={(e) => setSettings({ ...settings, barberShopName: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">URL da Logo (Logotipo)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: https://dominio.com/logo.png"
                              value={settings.logoUrl || ""}
                              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginTop: "4px" }}>
                              URL para imagem PNG/JPEG ou SVG transparente da sua logo.
                            </small>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Endereço Físico</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Rua, Número, Bairro - Cidade/UF"
                              value={settings.address || ""}
                              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Telefone de Contato</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: (11) 99999-9999"
                              value={settings.phone || ""}
                              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                              required
                            />
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "15px" }} disabled={actionLoading}>
                            {actionLoading ? "Salvando..." : "Salvar Identidade"}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Card 2: Horário Geral de Funcionamento */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Horário Geral</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Defina a janela de funcionamento geral (abertura e fechamento) da barbearia.
                        </p>

                        <form onSubmit={handleSaveSettings}>
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
                            {actionLoading ? "Salvando..." : "Salvar Horários"}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Card 3: Google Tag Manager */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Google Tag Manager (GTM)</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Configure o ID do GTM para monitorar as conversões e métricas na página do cliente.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          <div className="form-group">
                            <label className="form-label">Google Tag Manager ID</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: GTM-XXXXXX"
                              value={settings.gtmId}
                              onChange={(e) => setSettings({ ...settings, gtmId: e.target.value })}
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginTop: "6px" }}>
                              Insira apenas o ID. O script correspondente será injetado automaticamente.
                            </small>
                          </div>

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "15px" }} disabled={actionLoading}>
                            {actionLoading ? "Salvando..." : "Salvar Rastreamento"}
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Card 4: Segurança (Senha Mestra) */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Segurança Administrativa</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
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

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "15px" }} disabled={actionLoading}>
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
