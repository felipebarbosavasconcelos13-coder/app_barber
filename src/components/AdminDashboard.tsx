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
  Edit,
  MessageSquare,
  Send,
  Award
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
  const [activeTab, setActiveTab] = useState<"bookings" | "barbers" | "services" | "settings" | "esquadro" | "clients" | "automations">("bookings");
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
    evolutionUrl: "",
    evolutionApiKey: "",
    evolutionInstance: "",
    googleMapsEmbedUrl: "",
    googleReviewsWidget: "",
    googlePlacesApiKey: "",
    googlePlaceId: "",
    googleRating: 0,
    googleReviewsCount: 0,
    colorAccentGold: "#c5a880",
    colorBgPrimary: "#0a0a0c",
    colorBgSecondary: "#121216",
    colorBgTertiary: "#1b1b22",
  });

  // Novos States de Depoimentos Curados (Google / Local)
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [newTestimonial, setNewTestimonial] = useState({
    authorName: "",
    rating: "5",
    content: "",
    avatarUrl: "",
    source: "Google"
  });
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [testimonialLoading, setTestimonialLoading] = useState(false);
  const [importingGoogleWidget, setImportingGoogleWidget] = useState(false);
  const [syncingGooglePlaces, setSyncingGooglePlaces] = useState(false);
  const [testingGooglePlaces, setTestingGooglePlaces] = useState(false);
  const [googlePlacesTestResult, setGooglePlacesTestResult] = useState<any | null>(null);

  // Novos States de Gestão de Clientes (CRM)
  const [clients, setClients] = useState<any[]>([]);
  const [searchClient, setSearchClient] = useState("");
  const [clientsSortKey, setClientsSortKey] = useState<"totalSpent" | "daysSinceLast">("totalSpent");

  // Novos States de Automações de WhatsApp
  const [automations, setAutomations] = useState({
    whatsappConfirmationEnabled: true,
    whatsappConfirmationTemplate: "",
    whatsappReminderEnabled: true,
    whatsappReminderTemplate: "",
    whatsappReengagementEnabled: false,
    whatsappReengagementDays: 30,
    whatsappReengagementTemplate: "",
  });
  const [pendingReengagement, setPendingReengagement] = useState<any[]>([]);
  const [sendingReengagement, setSendingReengagement] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  // States para testes e status do WhatsApp (Evolution API)
  const [testingConnection, setTestingConnection] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<"CONECTADO" | "DESCONECTADO" | "ERRO_CONEXAO" | "DESCONHECIDO" | null>(null);
  const [whatsappDetails, setWhatsappDetails] = useState<string | null>(null);

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
      // Carrega em paralelo agendamentos, barbeiros, serviços, bloqueios, configurações, clientes e automações
      const [bookingsRes, barbersRes, servicesRes, settingsRes, blocksRes, clientsRes, automationsRes, pendingRes, testimonialsRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/barbers"),
        fetch("/api/admin/services"),
        fetch("/api/admin/settings"),
        fetch("/api/admin/barber-blocks"),
        fetch("/api/admin/clients"),
        fetch("/api/admin/automations"),
        fetch("/api/admin/automations/reengagement-pending"),
        fetch("/api/admin/testimonials"),
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
      const clientsData = await clientsRes.json();
      const automationsData = await automationsRes.json();
      const pendingData = await pendingRes.json();

      setBookings(bookingsData.error ? [] : bookingsData);
      
      const loadedBarbers = barbersData.error ? [] : barbersData;
      setBarbers(loadedBarbers);
      setServices(servicesData.error ? [] : servicesData);
      setBarberBlocks(blocksData.error ? [] : blocksData);
      setClients(clientsData.error ? [] : clientsData);
      setPendingReengagement(pendingData.error ? [] : pendingData);
      const testimonialsData = await testimonialsRes.json();
      setTestimonials(testimonialsData.error ? [] : testimonialsData);

      const defaultAutomations = {
        whatsappConfirmationEnabled: true,
        whatsappConfirmationTemplate: "",
        whatsappReminderEnabled: true,
        whatsappReminderTemplate: "",
        whatsappReengagementEnabled: false,
        whatsappReengagementDays: 30,
        whatsappReengagementTemplate: "",
      };
      setAutomations(automationsData.error ? defaultAutomations : { ...defaultAutomations, ...automationsData });

      const defaultSettings = {
        gtmId: "",
        openingTime: "09:00",
        closingTime: "19:00",
        barberShopName: "Barbearia Premium",
        logoUrl: "",
        address: "",
        phone: "",
        evolutionUrl: "",
        evolutionApiKey: "",
        evolutionInstance: "",
        googleMapsEmbedUrl: "",
        googleReviewsWidget: "",
        googlePlacesApiKey: "",
        googlePlaceId: "",
        googleRating: 0,
        googleReviewsCount: 0,
        colorAccentGold: "#c5a880",
        colorBgPrimary: "#0a0a0c",
        colorBgSecondary: "#121216",
        colorBgTertiary: "#1b1b22",
      };
      const resolvedSettings = settingsData.error ? defaultSettings : { ...defaultSettings, ...settingsData };
      setSettings(resolvedSettings);
      
      // Executa verificação silenciosa se as credenciais básicas do WhatsApp existirem
      if (resolvedSettings.evolutionUrl && resolvedSettings.evolutionInstance) {
        checkInitialWhatsAppStatus(resolvedSettings.evolutionUrl, resolvedSettings.evolutionApiKey, resolvedSettings.evolutionInstance);
      }
      
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
          evolutionUrl: settings.evolutionUrl,
          evolutionApiKey: settings.evolutionApiKey,
          evolutionInstance: settings.evolutionInstance,
          googleMapsEmbedUrl: settings.googleMapsEmbedUrl,
          googleReviewsWidget: settings.googleReviewsWidget,
          googlePlacesApiKey: settings.googlePlacesApiKey,
          googlePlaceId: settings.googlePlaceId,
          googleRating: settings.googleRating,
          googleReviewsCount: settings.googleReviewsCount,
          colorAccentGold: settings.colorAccentGold,
          colorBgPrimary: settings.colorBgPrimary,
          colorBgSecondary: settings.colorBgSecondary,
          colorBgTertiary: settings.colorBgTertiary,
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

  const checkInitialWhatsAppStatus = async (url?: string, key?: string, inst?: string) => {
    const checkUrl = url || settings.evolutionUrl;
    const checkKey = key || settings.evolutionApiKey;
    const checkInst = inst || settings.evolutionInstance;

    if (!checkUrl || !checkInst) return;

    try {
      const res = await fetch("/api/admin/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: checkUrl, apiKey: checkKey, instance: checkInst }),
      });
      const data = await res.json();
      if (data.status) {
        setWhatsappStatus(data.status);
        setWhatsappDetails(data.details);
      }
    } catch (e) {
      console.error("Erro na verificação inicial de status do WhatsApp:", e);
      setWhatsappStatus("ERRO_CONEXAO");
      setWhatsappDetails("Não foi possível conectar à Evolution API.");
    }
  };

  const handleTestWhatsAppConnection = async () => {
    setTestingConnection(true);
    setWhatsappStatus(null);
    setWhatsappDetails(null);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: settings.evolutionUrl,
          apiKey: settings.evolutionApiKey,
          instance: settings.evolutionInstance,
        }),
      });
      const data = await res.json();

      setWhatsappStatus(data.status);
      setWhatsappDetails(data.details);

      if (data.success) {
        setSuccess("Conexão com o WhatsApp testada e estabelecida com sucesso!");
      } else {
        setError(data.details || "Falha na verificação de conexão com o WhatsApp.");
      }
    } catch (err: any) {
      setWhatsappStatus("ERRO_CONEXAO");
      setWhatsappDetails(`Falha na requisição: ${err.message || err}`);
      setError("Erro interno de rede ao se conectar com o validador.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAutomations = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(automations),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao salvar automações.");

      setSuccess("Automações atualizadas com sucesso!");
      
      // Recarrega a fila de reengajamento pendente caso o limite de dias tenha mudado
      const pendingRes = await fetch("/api/admin/automations/reengagement-pending");
      const pendingData = await pendingRes.json();
      setPendingReengagement(pendingData.error ? [] : pendingData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerReengagement = async () => {
    if (pendingReengagement.length === 0) return;
    if (!confirm(`Deseja enviar lembretes para ${pendingReengagement.length} cliente(s) ausente(s)?`)) return;

    setError("");
    setSuccess("");
    setSendingReengagement(true);

    try {
      const targets = pendingReengagement.map(p => ({
        bookingId: p.bookingId,
        clientPhone: p.clientPhone,
        clientName: p.clientName,
        lastService: p.lastService,
        daysSinceLast: p.daysSinceLast
      }));

      const res = await fetch("/api/admin/automations/trigger-reengagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao disparar mensagens.");

      setSuccess(`Lembretes de reengajamento enviados com sucesso! Disparos: ${data.sentCount}.`);
      
      // Recarrega dados de clientes e pendências
      const [pendingRes, clientsRes] = await Promise.all([
        fetch("/api/admin/automations/reengagement-pending"),
        fetch("/api/admin/clients")
      ]);
      const pendingData = await pendingRes.json();
      const clientsData = await clientsRes.json();
      
      setPendingReengagement(pendingData.error ? [] : pendingData);
      setClients(clientsData.error ? [] : clientsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingReengagement(false);
    }
  };

  const handleTriggerReminders = async () => {
    setError("");
    setSuccess("");
    setSendingReminders(true);

    try {
      const res = await fetch("/api/admin/automations/trigger-reminders", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao processar lembretes.");

      if (data.sentCount > 0) {
        setSuccess(`Processamento concluído! Lembretes disparados com sucesso: ${data.sentCount}.`);
      } else {
        setSuccess("Processamento concluído! Nenhum agendamento pendente de lembrete no intervalo de 1h.");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar lembretes.");
    } finally {
      setSendingReminders(false);
    }
  };

  // Funções de CRUD de Depoimentos Curados
  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setTestimonialLoading(true);

    try {
      const isEditing = editingTestimonialId !== null;
      const url = "/api/admin/testimonials";
      const method = isEditing ? "PUT" : "POST";
      const payload = isEditing ? { ...newTestimonial, id: editingTestimonialId } : newTestimonial;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Erro ao ${isEditing ? "editar" : "salvar"} depoimento.`);

      if (isEditing) {
        setTestimonials(testimonials.map((t) => (t.id === editingTestimonialId ? data.testimonial : t)));
        setSuccess("Depoimento atualizado com sucesso!");
      } else {
        setTestimonials([data.testimonial, ...testimonials]);
        setSuccess("Depoimento cadastrado com sucesso!");
      }

      setNewTestimonial({
        authorName: "",
        rating: "5",
        content: "",
        avatarUrl: "",
        source: "Google"
      });
      setEditingTestimonialId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestimonialLoading(false);
    }
  };

  const handleEditTestimonialClick = (t: any) => {
    setNewTestimonial({
      authorName: t.authorName,
      rating: String(t.rating),
      content: t.content,
      avatarUrl: t.avatarUrl || "",
      source: t.source || "Google"
    });
    setEditingTestimonialId(t.id);
    setError("");
    setSuccess("");
  };

  const handleCancelEditTestimonial = () => {
    setNewTestimonial({
      authorName: "",
      rating: "5",
      content: "",
      avatarUrl: "",
      source: "Google"
    });
    setEditingTestimonialId(null);
    setError("");
    setSuccess("");
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este depoimento?")) return;
    setError("");
    setSuccess("");
    setTestimonialLoading(true);

    try {
      const res = await fetch(`/api/admin/testimonials?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao remover depoimento.");

      setTestimonials(testimonials.filter((t) => t.id !== id));
      setSuccess("Depoimento removido com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestimonialLoading(false);
    }
  };

  const handleImportGoogleWidget = async () => {
    setError("");
    setSuccess("");
    setImportingGoogleWidget(true);

    try {
      const res = await fetch("/api/admin/google-reviews/import-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: settings.googleReviewsWidget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar avaliações do widget.");

      setSettings({
        ...settings,
        googleRating: data.rating || settings.googleRating,
        googleReviewsCount: data.reviewsCount || settings.googleReviewsCount,
      });

      const testimonialsRes = await fetch("/api/admin/testimonials");
      const testimonialsData = await testimonialsRes.json();
      setTestimonials(testimonialsData.error ? [] : testimonialsData);
      setSuccess(`Avaliações importadas sem API do Google. Total processado: ${data.importedCount}.`);
    } catch (err: any) {
      setError(err.message || "Falha ao importar avaliações do widget.");
    } finally {
      setImportingGoogleWidget(false);
    }
  };

  const handleSyncGooglePlaces = async () => {
    setError("");
    setSuccess("");
    setSyncingGooglePlaces(true);

    try {
      const saveRes = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleMapsEmbedUrl: settings.googleMapsEmbedUrl,
          googlePlacesApiKey: settings.googlePlacesApiKey,
          googlePlaceId: settings.googlePlaceId,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Erro ao salvar dados do Google Places.");

      const res = await fetch("/api/admin/google-reviews/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao sincronizar avaliações via Google Places.");

      setSettings({
        ...settings,
        googlePlaceId: data.placeId || settings.googlePlaceId,
        googleRating: data.rating || 0,
        googleReviewsCount: data.reviewsCount || 0,
      });

      const testimonialsRes = await fetch("/api/admin/testimonials");
      const testimonialsData = await testimonialsRes.json();
      setTestimonials(testimonialsData.error ? [] : testimonialsData);
      setSuccess(`Avaliações sincronizadas via API Key. Total processado: ${data.importedCount}. Observação: a Google Places API retorna no máximo 5 avaliações por estabelecimento; para exibir mais, use a importação por widget público.`);
    } catch (err: any) {
      setError(err.message || "Falha ao sincronizar avaliações via Google Places.");
    } finally {
      setSyncingGooglePlaces(false);
    }
  };

  const handleTestGooglePlaces = async () => {
    setError("");
    setSuccess("");
    setGooglePlacesTestResult(null);
    setTestingGooglePlaces(true);

    try {
      const res = await fetch("/api/admin/google-reviews/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleMapsEmbedUrl: settings.googleMapsEmbedUrl,
          googlePlacesApiKey: settings.googlePlacesApiKey,
          googlePlaceId: settings.googlePlaceId,
          barberShopName: settings.barberShopName,
          address: settings.address,
        }),
      });
      const data = await res.json();
      setGooglePlacesTestResult(data);
      if (!res.ok) throw new Error(data.error || "Falha ao testar Google Places API.");

      setSuccess("Teste da Google Places API concluído com sucesso.");
    } catch (err: any) {
      setError(err.message || "Falha ao testar Google Places API.");
    } finally {
      setTestingGooglePlaces(false);
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
              onClick={() => { setActiveTab("clients"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "clients" ? "active" : ""}`}
            >
              <Users size={18} />
              <span>Clientes</span>
            </button>
            <button
              onClick={() => { setActiveTab("automations"); setError(""); setSuccess(""); }}
              className={`nav-item ${activeTab === "automations" ? "active" : ""}`}
            >
              <MessageSquare size={18} />
              <span>Automações</span>
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
                              <td className="font-weight-600" data-label="Data/Hora">{formatDateTime(booking.dateTime)}</td>
                              <td data-label="Cliente">
                                <div className="client-info">
                                  <span className="client-name">{booking.clientName}</span>
                                </div>
                              </td>
                              <td data-label="Contato">
                                <div className="client-contact">
                                  <span>{booking.clientEmail}</span>
                                  <span className="contact-phone">{booking.clientPhone}</span>
                                </div>
                              </td>
                              <td data-label="Barbeiro">
                                <span className="barber-badge">{booking.barber?.name || "Excluído"}</span>
                              </td>
                              <td data-label="Serviço">{booking.service?.name || "Desconhecido"}</td>
                              <td className="gold-text font-weight-600" data-label="Preço">
                                R$ {(booking.service?.price || 0).toFixed(2)}
                              </td>
                              <td style={{ textAlign: "center" }} data-label="Ações">
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

                    {/* Card 1.1: Paleta de Cores da Marca */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Paleta da Marca</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Personalize as cores globais do site e do painel sem editar código.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          {[
                            ["colorAccentGold", "Cor de Destaque"],
                            ["colorBgPrimary", "Fundo Principal"],
                            ["colorBgSecondary", "Fundo Secundário"],
                            ["colorBgTertiary", "Fundo Terciário"],
                          ].map(([key, label]) => (
                            <div className="form-group-row" key={key} style={{ alignItems: "center", marginBottom: "12px" }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{label}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={(settings as any)[key]}
                                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                                  placeholder="#c5a880"
                                  pattern="^#[0-9A-Fa-f]{6}$"
                                />
                              </div>
                              <input
                                type="color"
                                aria-label={label}
                                value={(settings as any)[key]}
                                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                                style={{ width: "54px", height: "44px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "transparent", cursor: "pointer" }}
                              />
                            </div>
                          ))}

                          <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "15px" }} disabled={actionLoading}>
                            {actionLoading ? "Salvando..." : "Salvar Paleta"}
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

                    {/* Card 5: Integração WhatsApp (Evolution API) */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>Integração WhatsApp</h4>
                          
                          {/* LED de Status Pulsante */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className={`led-indicator ${
                              whatsappStatus === "CONECTADO" ? "led-green" : 
                              whatsappStatus === "DESCONECTADO" || whatsappStatus === "ERRO_CONEXAO" ? "led-red" : 
                              "led-gray"
                            }`} />
                            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                              {whatsappStatus === "CONECTADO" ? "Online" : 
                               whatsappStatus === "DESCONECTADO" ? "Desconectado" : 
                               whatsappStatus === "ERRO_CONEXAO" ? "Erro" : "Sem Configuração"}
                            </span>
                          </div>
                        </div>
                        
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Conecte o sistema à Evolution API para disparar notificações automáticas de agendamento via WhatsApp.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          <div className="form-group">
                            <label className="form-label">URL da Evolution API</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: https://api.seuservidor.com"
                              value={settings.evolutionUrl || ""}
                              onChange={(e) => setSettings({ ...settings, evolutionUrl: e.target.value })}
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginTop: "4px" }}>
                              URL de instalação da Evolution (sem barra / no final).
                            </small>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Chave de API (apikey)</label>
                            <input
                              type="password"
                              className="form-input"
                              placeholder="Digite a chave da API"
                              value={settings.evolutionApiKey || ""}
                              onChange={(e) => setSettings({ ...settings, evolutionApiKey: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Nome da Instância</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: Barberia_Premium"
                              value={settings.evolutionInstance || ""}
                              onChange={(e) => setSettings({ ...settings, evolutionInstance: e.target.value })}
                            />
                          </div>

                          {/* Mensagem de Diagnóstico Detalhada */}
                          {whatsappDetails && (
                            <div style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              fontSize: "0.75rem",
                              lineHeight: "1.3",
                              marginBottom: "15px",
                              background: whatsappStatus === "CONECTADO" ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
                              border: `1px solid ${whatsappStatus === "CONECTADO" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
                              color: whatsappStatus === "CONECTADO" ? "#10b981" : "#ef4444",
                            }}>
                              <strong>Diagnóstico:</strong> {whatsappDetails}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                            <button 
                              type="button" 
                              onClick={handleTestWhatsAppConnection}
                              className="btn-gold" 
                              style={{ 
                                flex: 1, 
                                background: "transparent", 
                                border: "1px solid var(--accent-gold)", 
                                color: "var(--accent-gold)" 
                              }} 
                              disabled={testingConnection || actionLoading}
                            >
                              {testingConnection ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                  <Loader2 size={14} className="spinner" /> Testando...
                                </span>
                              ) : "Testar Conexão"}
                            </button>

                            <button 
                              type="submit" 
                              className="btn-gold" 
                              style={{ flex: 1.2 }} 
                              disabled={actionLoading || testingConnection}
                            >
                              {actionLoading ? "Salvando..." : "Salvar Integração"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Card 6: Google Meu Negócio & Localização */}
                    <div className="glass-card form-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>Google & Localização</h4>
                        <p style={{ marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Integre Google Maps e avaliações por widget sem API ou, opcionalmente, por Google Places API Key.
                        </p>

                        <form onSubmit={handleSaveSettings}>
                          <div className="form-group-row">
                            <div className="form-group">
                              <label className="form-label">Nota Google</label>
                              <input
                                type="number"
                                className="form-input"
                                min="0"
                                max="5"
                                step="0.1"
                                value={settings.googleRating || 0}
                                onChange={(e) => setSettings({ ...settings, googleRating: Number(e.target.value) })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Qtd. Avaliações</label>
                              <input
                                type="number"
                                className="form-input"
                                min="0"
                                step="1"
                                value={settings.googleReviewsCount || 0}
                                onChange={(e) => setSettings({ ...settings, googleReviewsCount: Number(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">URL do Google Maps Embed ou Link do Maps</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ex: https://www.google.com/maps/embed?pb=..."
                              value={settings.googleMapsEmbedUrl || ""}
                              onChange={(e) => setSettings({ ...settings, googleMapsEmbedUrl: e.target.value })}
                            />
                            <div style={{ marginTop: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              <strong style={{ color: "var(--accent-gold)", display: "block", marginBottom: "4px" }}>Sem chave de API:</strong>
                              O iframe do Google Maps mostra o mapa/ficha visualmente, mas não libera os textos das avaliações para cards customizados. Para importar avaliações sem API, use abaixo o HTML/URL de um widget público, como no exemplo WordPress `wp-gr rpi wpac`.
                            </div>
                          </div>

                          <div className="form-group" style={{ marginTop: "12px" }}>
                            <label className="form-label">HTML ou URL do Widget de Avaliações Sem Chave</label>
                            <textarea
                              className="form-input"
                              rows={4}
                              style={{ height: "auto", fontFamily: "monospace", fontSize: "0.8rem" }}
                              placeholder="Cole aqui o HTML do widget (ex: wp-gr rpi wpac) ou uma URL pública que contenha esse widget."
                              value={settings.googleReviewsWidget || ""}
                              onChange={(e) => setSettings({ ...settings, googleReviewsWidget: e.target.value })}
                            />
                            <small style={{ color: "var(--text-muted)", fontSize: "0.72rem", display: "block", marginTop: "4px" }}>
                              O importador lê widgets públicos já renderizados e salva as avaliações encontradas no banco. Não usa chave de API do Google.
                            </small>
                          </div>

                          <div style={{ marginTop: "10px", background: "rgba(66, 133, 244, 0.06)", border: "1px solid rgba(66, 133, 244, 0.16)", padding: "10px", borderRadius: "8px", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                            <strong style={{ color: "#8ab4f8", display: "block", marginBottom: "4px" }}>Limite oficial do Google Places:</strong>
                            A API Key do Google retorna somente até 5 avaliações com texto. Para mostrar mais avaliações na landing, importe por um widget público renderizado ou cadastre avaliações reais manualmente abaixo.
                          </div>

                          <div className="form-group-row" style={{ marginTop: "12px" }}>
                            <div className="form-group">
                              <label className="form-label">Google Places API Key (Opcional)</label>
                              <input
                                type="password"
                                className="form-input"
                                placeholder="AIza..."
                                value={settings.googlePlacesApiKey || ""}
                                onChange={(e) => setSettings({ ...settings, googlePlacesApiKey: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Place ID (Opcional)</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Deixe vazio para resolver por nome/endereço"
                                value={settings.googlePlaceId || ""}
                                onChange={(e) => setSettings({ ...settings, googlePlaceId: e.target.value })}
                              />
                            </div>
                          </div>

                          {googlePlacesTestResult && (
                            <div style={{
                              marginTop: "12px",
                              padding: "12px",
                              borderRadius: "10px",
                              background: googlePlacesTestResult.success ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                              border: `1px solid ${googlePlacesTestResult.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                              color: googlePlacesTestResult.success ? "var(--status-success)" : "var(--status-error)",
                              fontSize: "0.78rem",
                              lineHeight: 1.45,
                            }}>
                              <strong>{googlePlacesTestResult.success ? "API funcionando" : "Falha no teste"}</strong>
                              <div style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                                {googlePlacesTestResult.success
                                  ? `${googlePlacesTestResult.name || "Estabelecimento encontrado"} | Nota ${googlePlacesTestResult.rating || 0} | ${googlePlacesTestResult.reviewsCount || 0} avaliações | ${googlePlacesTestResult.reviewsWithText || 0} textos retornados`
                                  : googlePlacesTestResult.error}
                              </div>
                              {googlePlacesTestResult.placeId && (
                                <div style={{ color: "var(--text-muted)", marginTop: "4px", fontFamily: "monospace", wordBreak: "break-all" }}>
                                  Place ID: {googlePlacesTestResult.placeId}
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: "10px", marginTop: "15px", flexWrap: "wrap" }}>
                            <button type="submit" className="btn-gold" style={{ flex: 1, minWidth: "140px" }} disabled={actionLoading || importingGoogleWidget || syncingGooglePlaces || testingGooglePlaces}>
                              {actionLoading ? "Salvando..." : "Salvar Google"}
                            </button>
                            <button type="button" className="btn-gold" style={{ flex: 1.2, minWidth: "170px", background: "transparent", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)" }} onClick={handleImportGoogleWidget} disabled={importingGoogleWidget || actionLoading || syncingGooglePlaces || testingGooglePlaces}>
                              {importingGoogleWidget ? "Importando..." : "Importar Avaliações"}
                            </button>
                            <button type="button" className="btn-gold" style={{ flex: 1.2, minWidth: "145px", background: "rgba(66, 133, 244, 0.04)", border: "1px solid rgba(66, 133, 244, 0.2)", color: "#8ab4f8" }} onClick={handleTestGooglePlaces} disabled={testingGooglePlaces || syncingGooglePlaces || actionLoading || importingGoogleWidget}>
                              {testingGooglePlaces ? "Testando..." : "Testar API Key"}
                            </button>
                            <button type="button" className="btn-gold" style={{ flex: 1.2, minWidth: "130px", background: "rgba(66, 133, 244, 0.08)", border: "1px solid rgba(66, 133, 244, 0.25)", color: "#8ab4f8" }} onClick={handleSyncGooglePlaces} disabled={syncingGooglePlaces || actionLoading || importingGoogleWidget || testingGooglePlaces}>
                              {syncingGooglePlaces ? "Sincronizando..." : "Usar API Key"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                  </div>

                  {/* Seção: Avaliações exibidas na Landing Page */}
                  <div className="glass-card" style={{ marginTop: "24px", padding: "28px", borderRadius: "14px" }}>
                    <div style={{ marginBottom: "20px" }}>
                      <h3 className="title-serif gold-text" style={{ fontSize: "1.4rem", fontWeight: 600 }}>Avaliações Exibidas na Landing Page</h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        Avaliações importadas de widget público sem chave de API do Google, ou registros já existentes no banco interno.
                      </p>
                    </div>

                    {testimonials.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px", border: "1px dashed rgba(255, 255, 255, 0.08)", borderRadius: "10px", color: "var(--text-muted)" }}>
                        <Award size={36} className="empty-icon" style={{ marginBottom: "12px", opacity: 0.5 }} />
                        <h4 style={{ color: "#fff", marginBottom: "6px" }}>Nenhuma avaliação interna cadastrada</h4>
                        <p style={{ fontSize: "0.85rem" }}>Cole o HTML ou URL de um widget público no card Google & Localização e clique em importar.</p>
                      </div>
                    ) : (
                      <div className="table-wrapper" style={{ padding: 0, border: "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Autor</th>
                              <th>Nota</th>
                              <th>Avaliação</th>
                              <th>Origem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {testimonials.map((t) => (
                              <tr key={t.id} className="animate-fade-in">
                                <td data-label="Autor">
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {t.avatarUrl ? (
                                      <img src={t.avatarUrl} alt={t.authorName} style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(197, 168, 128, 0.2)" }} />
                                    ) : (
                                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(197, 168, 128, 0.1)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.85rem" }}>
                                        {t.authorName.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="client-name">{t.authorName}</span>
                                  </div>
                                </td>
                                <td data-label="Nota">
                                  <span className="gold-text" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                                    {t.rating} ★
                                  </span>
                                </td>
                                <td data-label="Avaliação" style={{ maxWidth: "520px", whiteSpace: "normal", lineHeight: 1.5 }}>
                                  {t.content}
                                </td>
                                <td data-label="Origem">
                                  <span className="badge" style={{ background: "rgba(66, 133, 244, 0.1)", border: "1px solid rgba(66, 133, 244, 0.2)", color: "#4285f4", fontSize: "0.75rem", padding: "4px 8px", borderRadius: "6px" }}>
                                    {t.source || "Google Maps"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ABA CLIENTES (CRM) */}
              {activeTab === "clients" && (
                <div className="tab-pane animate-fade-in">
                  <div className="pane-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <h3 className="title-serif">Gestão de Clientes (CRM)</h3>
                      <p>Visualize o ranking de clientes que mais investem e monitore a retenção e dias desde o último retorno.</p>
                    </div>
                    
                    {/* Controles de Busca e Ordenação */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Buscar por nome ou celular..."
                        className="form-input"
                        style={{ width: "260px", marginBottom: 0 }}
                        value={searchClient}
                        onChange={(e) => setSearchClient(e.target.value)}
                      />
                      
                      <div className="flex-center" style={{ gap: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "4px" }}>
                        <button
                          type="button"
                          onClick={() => setClientsSortKey("totalSpent")}
                          className={`btn-gold ${clientsSortKey === "totalSpent" ? "" : "inactive-btn"}`}
                          style={{ padding: "6px 12px", fontSize: "0.8rem", background: clientsSortKey === "totalSpent" ? "var(--accent-gold)" : "transparent", border: "none", color: clientsSortKey === "totalSpent" ? "#000" : "var(--text-secondary)", borderRadius: "6px" }}
                        >
                          <Award size={14} style={{ marginRight: "4px", display: "inline-block", verticalAlign: "middle" }} />
                          VIP / Gasto
                        </button>
                        <button
                          type="button"
                          onClick={() => setClientsSortKey("daysSinceLast")}
                          className={`btn-gold ${clientsSortKey === "daysSinceLast" ? "" : "inactive-btn"}`}
                          style={{ padding: "6px 12px", fontSize: "0.8rem", background: clientsSortKey === "daysSinceLast" ? "var(--accent-gold)" : "transparent", border: "none", color: clientsSortKey === "daysSinceLast" ? "#000" : "var(--text-secondary)", borderRadius: "6px" }}
                        >
                          Ausência
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card table-wrapper">
                    {(() => {
                      const filtered = clients
                        .filter(c => 
                          c.clientName.toLowerCase().includes(searchClient.toLowerCase()) || 
                          c.clientPhone.includes(searchClient)
                        )
                        .sort((a, b) => {
                          if (clientsSortKey === "totalSpent") {
                            return b.totalSpent - a.totalSpent;
                          } else {
                            return (b.daysSinceLast ?? -1) - (a.daysSinceLast ?? -1);
                          }
                        });

                      if (filtered.length === 0) {
                        return (
                          <div className="empty-state">
                            <Users size={48} className="empty-icon" />
                            <h4>Nenhum cliente localizado</h4>
                            <p>Tente ajustar sua busca ou aguarde novos agendamentos.</p>
                          </div>
                        );
                      }

                      return (
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>WhatsApp / Celular</th>
                              <th style={{ textAlign: "center" }}>Agendamentos</th>
                              <th style={{ textAlign: "right" }}>Total Gasto</th>
                              <th style={{ textAlign: "center" }}>Último Serviço</th>
                              <th style={{ textAlign: "center" }}>Tempo sem Voltar</th>
                              <th style={{ textAlign: "center" }}>Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((client, idx) => {
                              const isAbsentLong = client.daysSinceLast && client.daysSinceLast >= (automations.whatsappReengagementDays || 30);
                              return (
                                <tr key={client.clientPhone}>
                                  <td data-label="Cliente">
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                      {clientsSortKey === "totalSpent" && idx < 3 && (
                                        <span title="Cliente VIP" style={{ color: "var(--accent-gold)", fontSize: "1.1rem" }}>
                                          👑
                                        </span>
                                      )}
                                      <div>
                                        <span className="client-name">{client.clientName}</span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Fidelidade Barber</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td data-label="WhatsApp / Celular">
                                    <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{client.clientPhone}</span>
                                  </td>
                                  <td style={{ textAlign: "center" }} data-label="Agendamentos">
                                    <span className="badge" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                                      {client.totalBookings}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--accent-gold)" }} data-label="Total Gasto">
                                    R$ {client.totalSpent.toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: "center", fontSize: "0.85rem" }} data-label="Último Serviço">
                                    {client.lastVisitDate ? (
                                      <div>
                                        <span style={{ display: "block" }}>{client.lastVisitDate.split("-").reverse().join("/")}</span>
                                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)" }}>{client.lastServiceName}</span>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)" }}>Nenhum</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "center" }} data-label="Tempo sem Voltar">
                                    {client.daysSinceLast !== null ? (
                                      <span className={`badge ${isAbsentLong ? "badge-error-bg" : "badge-success-bg"}`} style={{
                                        background: isAbsentLong ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                        border: `1px solid ${isAbsentLong ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
                                        color: isAbsentLong ? "var(--status-error)" : "var(--status-success)",
                                        padding: "4px 10px",
                                        borderRadius: "20px"
                                      }}>
                                        {client.daysSinceLast === 0 ? "Hoje" : 
                                         client.daysSinceLast === 1 ? "1 dia" : 
                                         `${client.daysSinceLast} dias`}
                                      </span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sem registro</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "center" }} data-label="Ação">
                                    <a
                                      href={`https://wa.me/${client.clientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                        `Olá, ${client.clientName}! Tudo bem? Sentimos sua falta aqui na ${settings.barberShopName || "Barbearia"}! Faz algum tempo desde o seu último serviço (${client.lastServiceName || "corte"}). Que tal agendar um novo horário conosco? Link para agendamento: ${typeof window !== "undefined" ? window.location.origin : ""}`
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-gold"
                                      style={{ padding: "6px 12px", fontSize: "0.75rem", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                                    >
                                      <MessageSquare size={12} />
                                      WhatsApp
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ABA AUTOMAÇÕES (WHATSAPP CRM) */}
              {activeTab === "automations" && (
                <div className="tab-pane animate-fade-in">
                  <div className="pane-header">
                    <h3 className="title-serif">Automações de Notificação (CRM)</h3>
                    <p>Configure disparos automáticos e lembretes de retenção via Evolution API do WhatsApp.</p>
                  </div>

                  <div className="pane-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px", alignItems: "start" }}>
                    
                    {/* Configuração dos Templates (Lado Esquerdo) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <form onSubmit={handleSaveAutomations} className="glass-card form-card">
                        
                        {/* 1. Confirmação de Agendamento */}
                        <div style={{ paddingBottom: "24px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div>
                              <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>1. Confirmação de Agendamento</h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Dispara uma notificação instantânea no WhatsApp do cliente assim que ele agenda.
                              </p>
                            </div>
                            <label className="switch-container" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={automations.whatsappConfirmationEnabled}
                                onChange={(e) => setAutomations({ ...automations, whatsappConfirmationEnabled: e.target.checked })}
                                style={{ display: "none" }}
                              />
                              <span style={{
                                width: "42px",
                                height: "22px",
                                background: automations.whatsappConfirmationEnabled ? "var(--accent-gold)" : "rgba(255,255,255,0.1)",
                                borderRadius: "15px",
                                position: "relative",
                                display: "block",
                                transition: "all 0.3s ease"
                              }}>
                                <span style={{
                                  width: "16px",
                                  height: "16px",
                                  background: automations.whatsappConfirmationEnabled ? "#000" : "#fff",
                                  borderRadius: "50%",
                                  position: "absolute",
                                  top: "3px",
                                  left: automations.whatsappConfirmationEnabled ? "23px" : "3px",
                                  transition: "all 0.3s ease"
                                }} />
                              </span>
                            </label>
                          </div>

                          <div className="form-group" style={{ marginTop: "15px" }}>
                            <label className="form-label">Mensagem Personalizada</label>
                            <textarea
                              className="form-input"
                              rows={5}
                              style={{ height: "auto", fontFamily: "sans-serif", fontSize: "0.9rem", resize: "vertical" }}
                              placeholder="Olá, {{cliente}}! Seu agendamento foi confirmado para o dia {{data}} às {{hora}} com o barbeiro {{barbeiro}}."
                              value={automations.whatsappConfirmationTemplate || ""}
                              onChange={(e) => setAutomations({ ...automations, whatsappConfirmationTemplate: e.target.value })}
                            />
                            <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                              <strong>Variáveis:</strong>
                              <span><code>{"{{cliente}}"}</code></span>
                              <span><code>{"{{data}}"}</code></span>
                              <span><code>{"{{hora}}"}</code></span>
                              <span><code>{"{{barbeiro}}"}</code></span>
                              <span><code>{"{{servico}}"}</code></span>
                              <span><code>{"{{preco}}"}</code></span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Lembrete de Horário (1h Antes) */}
                        <div style={{ paddingBottom: "24px", paddingTop: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div>
                              <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>2. Lembrete de Horário (1h Antes)</h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Dispara uma notificação automática de lembrete no WhatsApp do cliente 1 hora antes do agendamento.
                              </p>
                            </div>
                            <label className="switch-container" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={automations.whatsappReminderEnabled}
                                onChange={(e) => setAutomations({ ...automations, whatsappReminderEnabled: e.target.checked })}
                                style={{ display: "none" }}
                              />
                              <span style={{
                                width: "42px",
                                height: "22px",
                                background: automations.whatsappReminderEnabled ? "var(--accent-gold)" : "rgba(255,255,255,0.1)",
                                borderRadius: "15px",
                                position: "relative",
                                display: "block",
                                transition: "all 0.3s ease"
                              }}>
                                <span style={{
                                  width: "16px",
                                  height: "16px",
                                  background: automations.whatsappReminderEnabled ? "#000" : "#fff",
                                  borderRadius: "50%",
                                  position: "absolute",
                                  top: "3px",
                                  left: automations.whatsappReminderEnabled ? "23px" : "3px",
                                  transition: "all 0.3s ease"
                                }} />
                              </span>
                            </label>
                          </div>

                          <div className="form-group" style={{ marginTop: "15px" }}>
                            <label className="form-label">Mensagem Personalizada</label>
                            <textarea
                              className="form-input"
                              rows={5}
                              style={{ height: "auto", fontFamily: "sans-serif", fontSize: "0.9rem", resize: "vertical" }}
                              placeholder="Olá, {{cliente}}! Passando para lembrar que seu horário de {{servico}} com o profissional {{barbeiro}} está agendado para hoje às {{hora}}."
                              value={automations.whatsappReminderTemplate || ""}
                              onChange={(e) => setAutomations({ ...automations, whatsappReminderTemplate: e.target.value })}
                            />
                            <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                              <strong>Variáveis:</strong>
                              <span><code>{"{{cliente}}"}</code></span>
                              <span><code>{"{{data}}"}</code></span>
                              <span><code>{"{{hora}}"}</code></span>
                              <span><code>{"{{barbeiro}}"}</code></span>
                              <span><code>{"{{servico}}"}</code></span>
                              <span><code>{"{{preco}}"}</code></span>
                              <span><code>{"{{barbearia}}"}</code></span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Reengajamento (Ausência de Clientes) */}
                        <div style={{ paddingTop: "20px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div>
                              <h4 className="title-serif gold-text" style={{ fontSize: "1.2rem", fontWeight: 600 }}>3. Reengajamento (Ausência de Clientes)</h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Envia um cupom ou lembrete para clientes sumidos há mais de N dias e sem novas reservas.
                              </p>
                            </div>
                            <label className="switch-container" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={automations.whatsappReengagementEnabled}
                                onChange={(e) => setAutomations({ ...automations, whatsappReengagementEnabled: e.target.checked })}
                                style={{ display: "none" }}
                              />
                              <span style={{
                                width: "42px",
                                height: "22px",
                                background: automations.whatsappReengagementEnabled ? "var(--accent-gold)" : "rgba(255,255,255,0.1)",
                                borderRadius: "15px",
                                position: "relative",
                                display: "block",
                                transition: "all 0.3s ease"
                              }}>
                                <span style={{
                                  width: "16px",
                                  height: "16px",
                                  background: automations.whatsappReengagementEnabled ? "#000" : "#fff",
                                  borderRadius: "50%",
                                  position: "absolute",
                                  top: "3px",
                                  left: automations.whatsappReengagementEnabled ? "23px" : "3px",
                                  transition: "all 0.3s ease"
                                }} />
                              </span>
                            </label>
                          </div>

                          <div className="form-group-row" style={{ marginTop: "15px" }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Período de Ausência (Dias)</label>
                              <input
                                type="number"
                                className="form-input"
                                min={5}
                                max={180}
                                value={automations.whatsappReengagementDays}
                                onChange={(e) => setAutomations({ ...automations, whatsappReengagementDays: parseInt(e.target.value) || 30 })}
                                required
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)", paddingLeft: "10px", paddingTop: "18px" }}>
                              Dispara quando o cliente ficar sem voltar por mais do que este prazo.
                            </div>
                          </div>

                          <div className="form-group" style={{ marginTop: "15px" }}>
                            <label className="form-label">Mensagem de Reengajamento</label>
                            <textarea
                              className="form-input"
                              rows={5}
                              style={{ height: "auto", fontFamily: "sans-serif", fontSize: "0.9rem", resize: "vertical" }}
                              placeholder="Olá, {{cliente}}! Já faz {{dias}} dias desde o seu último corte ({{ultimo_servico}}). Que tal marcar um horário para dar aquele tapa no visual?"
                              value={automations.whatsappReengagementTemplate || ""}
                              onChange={(e) => setAutomations({ ...automations, whatsappReengagementTemplate: e.target.value })}
                            />
                            <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                              <strong>Variáveis:</strong>
                              <span><code>{"{{cliente}}"}</code></span>
                              <span><code>{"{{ultimo_servico}}"}</code></span>
                              <span><code>{"{{dias}}"}</code></span>
                            </div>
                          </div>
                        </div>

                        <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: "24px" }} disabled={actionLoading}>
                          {actionLoading ? "Salvando Automações..." : "Salvar Configurações de Automação"}
                        </button>
                      </form>
                    </div>

                    {/* Fila de Reengajamento Pendente (Lado Direito) */}
                    <div className="pane-form" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      
                      {/* Lembretes de Hoje (Manuais) */}
                      <div className="glass-card form-card" style={{ padding: "24px", borderRadius: "14px" }}>
                        <div style={{ marginBottom: "16px" }}>
                          <h4 className="title-serif" style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--accent-gold)" }}>Lembretes de Hoje</h4>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Dispare manualmente as notificações para os clientes com horários agendados para hoje nas próximas horas.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTriggerReminders}
                          className="btn-gold flex-center"
                          style={{ width: "100%", gap: "8px", justifyContent: "center" }}
                          disabled={sendingReminders}
                        >
                          {sendingReminders ? (
                            <>
                              <Loader2 size={16} className="spinner" /> Processando disparos...
                            </>
                          ) : (
                            <>
                              <Clock size={16} /> Disparar Lembretes (1h Antes)
                            </>
                          )}
                        </button>
                      </div>

                      {/* Fila de Reengajamento */}
                      <div className="glass-card form-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                          <div>
                            <h4 className="title-serif" style={{ fontSize: "1.2rem", fontWeight: 600 }}>Fila de Reengajamento</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                              Clientes ausentes há mais de {automations.whatsappReengagementDays || 30} dias qualificados para follow-up.
                            </p>
                          </div>
                          <span className="badge badge-gold">{pendingReengagement.length}</span>
                        </div>

                        {/* Botão de Disparo em Lote */}
                        {pendingReengagement.length > 0 && (
                          <button
                            type="button"
                            onClick={handleTriggerReengagement}
                            className="btn-gold flex-center"
                            style={{ width: "100%", marginBottom: "20px", gap: "8px" }}
                            disabled={sendingReengagement}
                          >
                            {sendingReengagement ? (
                              <>
                                <Loader2 size={16} className="spinner" /> Disparando mensagens...
                              </>
                            ) : (
                              <>
                                <Send size={16} /> Disparar em Lote para Todos ({pendingReengagement.length})
                              </>
                            )}
                          </button>
                        )}

                        {/* Lista dos Clientes da Fila */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                          {pendingReengagement.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)" }}>
                              <CheckCircle size={32} style={{ color: "var(--status-success)", opacity: 0.7, marginBottom: "10px" }} />
                              <p style={{ fontSize: "0.85rem", fontWeight: 500 }}>Fila de reengajamento limpa!</p>
                              <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>Nenhum cliente ausente pendente de lembrete no momento.</p>
                            </div>
                          ) : (
                            pendingReengagement.map((item) => (
                              <div
                                key={item.bookingId}
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: "10px",
                                  background: "rgba(255, 255, 255, 0.01)",
                                  border: "1px solid rgba(255, 255, 255, 0.04)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#fff", display: "block" }}>{item.clientName}</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                                    Último: {item.lastService} (há {item.daysSinceLast} dias)
                                  </span>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>{item.clientPhone}</span>
                                </div>
                                <span style={{
                                  fontSize: "0.75rem",
                                  padding: "4px 8px",
                                  borderRadius: "12px",
                                  background: "rgba(239, 68, 68, 0.08)",
                                  color: "var(--status-error)",
                                  border: "1px solid rgba(239, 68, 68, 0.15)",
                                  fontWeight: 500
                                }}>
                                  +{item.daysSinceLast}d
                                </span>
                              </div>
                            ))
                          )}
                        </div>
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

        /* Estilos do LED do WhatsApp */
        .led-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .led-green {
          background-color: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: led-pulse 2s infinite;
        }
        .led-red {
          background-color: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }
        .led-gray {
          background-color: #6b7280;
        }
        @keyframes led-pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </div>
  );
}
