'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Settings, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Search, Cloud, Plus } from 'lucide-react';

const LS_TOKEN = 'barber_install_vercel';
const LS_SUPABASE = 'barber_install_supabase';
const LS_PROJECT = 'barber_install_project';

type Step = 1 | 2 | 3;
type RunStatus = 'idle' | 'running' | 'success' | 'error';
interface LogEntry { time: string; message: string; type: 'info' | 'success' | 'error'; }

export default function InstallWizardPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  // Vercel
  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjects, setVercelProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVercel, setLoadingVercel] = useState(false);
  const [vercelProjectId, setVercelProjectId] = useState('');
  const [vercelBootstrapDone, setVercelBootstrapDone] = useState(false);

  // Supabase
  const [supabaseToken, setSupabaseToken] = useState('');
  const [orgs, setOrgs] = useState<Array<{ slug: string; name: string }>>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [orgProjects, setOrgProjects] = useState<Array<{ ref: string; name: string; status?: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectRef, setSelectedProjectRef] = useState('');
  const [selectedSupabaseUrl, setSelectedSupabaseUrl] = useState('');
  const [supabaseTokenValidated, setSupabaseTokenValidated] = useState(false);
  const [existingProjectDbPass, setExistingProjectDbPass] = useState('');
  const [supabasePaused, setSupabasePaused] = useState(false);

  // Criar projeto
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDbPass, setNewProjectDbPass] = useState('');
  const [newProjectRegion, setNewProjectRegion] = useState('');

  // Admin
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gtmId, setGtmId] = useState('');

  // Exec
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [stepError, setStepError] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const isVercelEnv = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

  const addLog = (m: string, t: LogEntry['type'] = 'info') => {
    setLogs(p => [...p, { time: new Date().toLocaleTimeString('pt-BR'), message: m, type: t }]);
  };

  // Carrega dados salvos do localStorage
  useEffect(() => {
    try {
      const savedVercel = localStorage.getItem(LS_TOKEN);
      const savedSupabase = localStorage.getItem(LS_SUPABASE);
      const savedProject = localStorage.getItem(LS_PROJECT);
      if (savedVercel) setVercelToken(savedVercel);
      if (savedSupabase) { setSupabaseToken(savedSupabase); }
      if (savedProject) {
        try { const p = JSON.parse(savedProject); setVercelProjectId(p.id || ''); } catch {}
      }
    } catch {}
  }, []);

  // Auto-detecta projeto Vercel (bootstrap)
  useEffect(() => {
    if (!vercelToken.trim() || vercelBootstrapDone) return;
    const t = setTimeout(async () => {
      setVercelBootstrapDone(true);
      try {
        const r = await fetch('/api/install/vercel/bootstrap', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: vercelToken.trim(), domain: window.location.hostname }),
        });
        const d = await r.json();
        if (d.project) {
          setVercelProjectId(d.project.id);
          localStorage.setItem(LS_PROJECT, JSON.stringify({ id: d.project.id, name: d.project.name }));
        }
        if (d.projects) setVercelProjects(d.projects);
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [vercelToken]);

  // Auto-busca organizacoes quando token Supabase e colado
  useEffect(() => {
    if (!supabaseToken.trim() || supabaseTokenValidated || supabaseToken.length < 30) return;
    const t = setTimeout(() => searchSupabaseOrgs(), 800);
    return () => clearTimeout(t);
  }, [supabaseToken]);

  // Salva tokens no localStorage
  useEffect(() => {
    if (vercelToken.trim()) localStorage.setItem(LS_TOKEN, vercelToken.trim());
    if (supabaseToken.trim()) localStorage.setItem(LS_SUPABASE, supabaseToken.trim());
  }, [vercelToken, supabaseToken]);

  const searchSupabaseOrgs = async () => {
    setLoadingOrgs(true);
    setStepError('');
    try {
      const r = await fetch('/api/install/supabase/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: supabaseToken.trim() }) });
      const d = await r.json();
      if (r.ok && d.organizations) {
        setOrgs(d.organizations);
        setSupabaseTokenValidated(true);
        if (d.organizations.length === 1) {
          setSelectedOrg(d.organizations[0].slug);
          loadProjects(d.organizations[0].slug);
        } else if (d.organizations.length === 0) {
          await loadDirectProjects();
        }
        return true;
      } else setStepError(d.error || 'Token Supabase invalido');
    } catch { setStepError('Erro ao buscar organizacoes.'); } finally { setLoadingOrgs(false); }
    return false;
  };

  const loadDirectProjects = async () => {
    setSelectedOrg('');
    setOrgProjects([]);
    setLoadingProjects(true);
    try {
      const r = await fetch('/api/install/supabase/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: supabaseToken.trim() }) });
      const d = await r.json();
      if (r.ok && d.projects) setOrgProjects(d.projects);
    } catch {} finally { setLoadingProjects(false); }
  };

  const loadProjects = async (slug: string) => {
    setSelectedOrg(slug);
    setOrgProjects([]);
    setLoadingProjects(true);
    try {
      const r = await fetch('/api/install/supabase/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: supabaseToken.trim(), orgSlug: slug }) });
      const d = await r.json();
      if (r.ok && d.projects) setOrgProjects(d.projects);
    } catch {} finally { setLoadingProjects(false); }
  };

  const handleCreateProject = async () => {
    if (!selectedOrg) {
      setStepError('Para criar um projeto novo, selecione uma organizacao Supabase. Se sua conta nao retornar organizacoes, selecione um projeto existente.');
      return;
    }
    if (!newProjectName.trim() || !newProjectDbPass || newProjectDbPass.length < 12) {
      setStepError('Nome do projeto e senha do banco (min 12 caracteres) obrigatorios.');
      return;
    }
    setCreatingProject(true); setStepError('');
    try {
      const r = await fetch('/api/install/supabase/create-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: supabaseToken.trim(), organizationSlug: selectedOrg, name: newProjectName.trim(), dbPass: newProjectDbPass, region: newProjectRegion || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSelectedProjectRef(d.projectRef);
      setSelectedSupabaseUrl(d.supabaseUrl);
      setOrgProjects(p => [...p, { ref: d.projectRef, name: newProjectName, status: 'creating' }]);
    } catch (err: any) { setStepError(err.message); } finally { setCreatingProject(false); }
  };

  const selectProject = (ref: string) => { setSelectedProjectRef(ref); setSelectedSupabaseUrl(`https://${ref}.supabase.co`); };

  const validateStep2 = () => {
    const wantsCreate = newProjectName.trim().length > 0;
    if (wantsCreate && !selectedOrg) { setStepError('Para criar um projeto novo, selecione uma organizacao Supabase.'); return false; }
    if (!selectedProjectRef && !newProjectName.trim()) { setStepError('Selecione um projeto ou crie um novo.'); return false; }
    if (selectedProjectRef && !wantsCreate && !existingProjectDbPass.trim()) {
      setStepError('Senha do banco de dados do projeto existente e obrigatoria.');
      return false;
    }
    if (!adminPassword.trim() || adminPassword.length < 4) { setStepError('Senha: min 4 caracteres.'); return false; }
    if (adminPassword !== confirmPassword) { setStepError('Senhas nao conferem.'); return false; }
    setStepError(''); return true;
  };

  const goToStep2 = async () => {
    if (!supabaseToken.trim()) { setStepError('Token Supabase obrigatorio.'); return; }
    if (!supabaseTokenValidated) {
      const ok = await searchSupabaseOrgs();
      if (!ok) return;
    }
    setStepError(''); setStep(2);
  };

  const handleNext = () => { if (step === 2 && validateStep2()) { setStep(3); runInstall(); } };
  const handleBack = () => { if (step > 1) { setStepError(''); setStep((step - 1) as Step); } };

  const runInstall = async () => {
    setRunStatus('running'); setLogs([]); setErrorMsg(''); setSupabasePaused(false);
    addLog('Iniciando instalacao...');
    try {
      const dbPass = newProjectName.trim() ? newProjectDbPass : existingProjectDbPass;
      const r = await fetch('/api/install/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseToken: supabaseToken.trim(), supabaseUrl: selectedSupabaseUrl,
          dbPass: dbPass.trim() || undefined,
          vercelToken: vercelToken.trim() || undefined, vercelProjectId: vercelProjectId.trim() || undefined,
          nextPublicAppUrl: appUrl, adminPassword: adminPassword.trim(), gtmId: gtmId.trim() || '',
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        if (d.supabasePaused) {
          setSupabasePaused(true);
        }
        addLog(`Erro: ${d.error || 'Falha'}`, 'error');
        if (d.details) addLog(`Detalhes: ${d.details}`, 'error');
        if (d.steps) d.steps.forEach((s: any) => addLog(s.message, s.status === 'ok' ? 'success' : 'error'));
        setRunStatus('error'); setErrorMsg(d.details || d.error || 'Erro');
        return;
      }
      if (d.steps) d.steps.forEach((s: any) => addLog(s.message, s.status === 'ok' ? 'success' : 'error'));
      addLog('Instalacao concluida!', 'success');
      setRunStatus('success');
    } catch (err: any) { addLog(`Erro: ${err.message}`, 'error'); setRunStatus('error'); setErrorMsg(err.message); }
  };

  const steps = [{ num: 1, label: 'Tokens', icon: Cloud }, { num: 2, label: 'Setup', icon: Settings }, { num: 3, label: 'Executar', icon: CheckCircle2 }];

  return (
    <div className="install-wizard-container">
      <style>{`
        .install-wizard-container { min-height: 100vh; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; padding: 24px; font-family: var(--font-sans); }
        .install-wizard-card { width: 100%; max-width: 620px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px 28px; box-shadow: var(--shadow-premium); }
        .install-stepper { display: flex; align-items: center; justify-content: center; margin-bottom: 28px; }
        .install-step-item { display: flex; align-items: center; gap: 8px; }
        .install-step-circle { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; border: 2px solid var(--border-color); color: var(--text-muted); background: transparent; transition: all 0.3s; }
        .install-step-circle.active { border-color: var(--accent-gold); background: rgba(197,168,128,0.1); color: var(--accent-gold); }
        .install-step-circle.done { border-color: var(--status-success); background: rgba(16,185,129,0.1); color: var(--status-success); }
        .install-step-label { font-size: 0.73rem; color: var(--text-muted); display: none; } .install-step-label.active { color: var(--accent-gold); }
        .install-step-connector { width: 28px; height: 2px; background: var(--border-color); margin: 0 4px; transition: background 0.3s; } .install-step-connector.done { background: var(--status-success); }
        .install-step-title { font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .install-step-desc { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 22px; line-height: 1.5; }
        .install-form-group { margin-bottom: 16px; }
        .install-form-label { display: block; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 5px; }
        .install-form-input { width: 100%; padding: 11px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-family: var(--font-sans); font-size: 0.88rem; transition: all 0.25s; box-sizing: border-box; }
        .install-form-input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px var(--accent-gold-glow); }
        .install-form-select { width: 100%; padding: 11px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-family: var(--font-sans); font-size: 0.88rem; cursor: pointer; box-sizing: border-box; }
        .install-form-hint { font-size: 0.73rem; color: var(--text-muted); margin-top: 5px; line-height: 1.4; }
        .install-form-input-group { position: relative; } .install-form-input-group .install-form-input { padding-right: 42px; }
        .install-form-toggle-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; }
        .install-btn-row { display: flex; gap: 8px; align-items: center; }
        .install-btn-search { flex-shrink: 0; padding: 11px 14px; background: rgba(197,168,128,0.1); border: 1px solid rgba(197,168,128,0.2); border-radius: 10px; color: var(--accent-gold); cursor: pointer; display: flex; align-items: center; gap: 5px; font-family: var(--font-sans); font-size: 0.82rem; font-weight: 500; transition: all 0.2s; }
        .install-btn-search:hover { background: rgba(197,168,128,0.2); } .install-btn-search:disabled { opacity: 0.5; cursor: not-allowed; }
        .install-tag { display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 600; margin-top: 4px; }
        .install-tag.ok { background: rgba(16,185,129,0.1); color: var(--status-success); } .install-tag.err { background: rgba(239,68,68,0.1); color: var(--status-error); } .install-tag.warn { background: rgba(245,158,11,0.1); color: var(--status-warning); }
        .install-divider { border: 0; height: 1px; background: var(--border-color); margin: 18px 0; }
        .install-project-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 10px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; }
        .install-project-card:hover { border-color: var(--accent-gold); } .install-project-card.selected { border-color: var(--accent-gold); background: rgba(197,168,128,0.08); }
        .install-project-card-name { font-weight: 600; font-size: 0.9rem; color: #fff; } .install-project-card-detail { font-size: 0.75rem; color: var(--text-muted); }
        .install-create-box { padding: 16px; background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 10px; margin-top: 12px; } .install-create-box h4 { font-size: 0.9rem; color: #fff; margin-bottom: 12px; }
        .install-btn-create { padding: 10px 16px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: var(--status-success); cursor: pointer; font-family: var(--font-sans); font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .install-btn-create:hover { background: rgba(16,185,129,0.25); } .install-btn-create:disabled { opacity: 0.5; cursor: not-allowed; }
        .install-nav-buttons { display: flex; gap: 12px; margin-top: 24px; }
        .install-btn-back { flex: 0 0 auto; padding: 13px 18px; background: transparent; border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.88rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .install-btn-back:hover { border-color: var(--text-muted); color: var(--text-primary); }
        .install-btn-next { flex: 1; padding: 13px 22px; background: linear-gradient(135deg, #d4af37 0%, var(--accent-gold) 100%); color: #000; font-family: var(--font-sans); font-size: 0.9rem; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(197,168,128,0.3); }
        .install-btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(197,168,128,0.45); }
        .install-error-box { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; margin-bottom: 14px; }
        .install-error-text { font-size: 0.85rem; color: var(--status-error); line-height: 1.4; }
        .install-run-logs { max-height: 240px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid var(--border-light); border-radius: 10px; padding: 12px; margin-bottom: 18px; }
        .install-log-entry { display: flex; gap: 10px; padding: 4px 0; font-size: 0.8rem; line-height: 1.5; } .install-log-time { flex-shrink: 0; color: var(--text-muted); font-family: monospace; font-size: 0.75rem; }
        .install-log-msg.success { color: var(--status-success); } .install-log-msg.error { color: var(--status-error); } .install-log-msg { color: var(--text-secondary); }
        .install-run-status { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; margin-bottom: 18px; }
        .install-run-status.running { background: rgba(197,168,128,0.08); border: 1px solid rgba(197,168,128,0.15); }
        .install-run-status.success { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
        .install-run-status.error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
        .install-run-status-text { font-size: 0.88rem; font-weight: 500; }
        .install-btn-admin { width: 100%; padding: 13px 22px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-family: var(--font-sans); font-size: 0.9rem; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s; }
        .install-btn-admin:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.3); }
        .install-btn-retry { width: 100%; padding: 13px 22px; background: transparent; border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.88rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } } .install-spinner { animation: spin 1s linear infinite; }
        @media (max-width: 600px) { .install-wizard-card { padding: 22px 16px; } }
        @media (min-width: 601px) { .install-step-label { display: block; } }
      `}</style>

      <div className="install-wizard-card">
        <div className="install-stepper">
          {steps.map((s, i) => {
            const I = s.icon; const active = step === s.num, done = step > s.num;
            return <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div className={`install-step-connector ${done ? 'done' : ''}`} />}
              <div className="install-step-item">
                <div className={`install-step-circle ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  {done ? <CheckCircle2 size={15} /> : <I size={15} />}
                </div>
                <span className={`install-step-label ${active ? 'active' : ''}`}>{s.label}</span>
              </div>
            </div>;
          })}
        </div>

        {stepError && step < 3 && (
          <div className="install-error-box"><AlertCircle size={18} style={{ color: 'var(--status-error)', flexShrink: 0, marginTop: 2 }} /><div className="install-error-text">{stepError}</div></div>
        )}

        {/* PASSO 1: Tokens */}
        {step === 1 && (
          <div>
            <h2 className="install-step-title">Conectar Servicos</h2>
            <p className="install-step-desc">Cole seus tokens. O sistema detecta tudo automaticamente.</p>

            <div className="install-form-group">
              <label className="install-form-label"><Cloud size={13} style={{ display: 'inline', marginRight: 4 }} />Vercel API Token</label>
              <input className="install-form-input" type="password" value={vercelToken}
                onChange={e => setVercelToken(e.target.value)}
                placeholder="Cole seu token Full Account" />
              {vercelProjectId && <span className="install-tag ok">Projeto detectado: {vercelProjectId}</span>}
              {vercelProjects.length > 0 && !vercelProjectId && <span className="install-tag warn">{vercelProjects.length} projeto(s) encontrados</span>}
              <div className="install-form-hint"><a href="https://vercel.com/account/tokens" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>vercel.com/account/tokens</a> — Full Account. Deteccao automatica do projeto.</div>
            </div>

            <div className="install-divider" />

            <div className="install-form-group">
              <label className="install-form-label"><Database size={13} style={{ display: 'inline', marginRight: 4 }} />Supabase Access Token</label>
              <input className="install-form-input" type="password" value={supabaseToken}
                onChange={e => { setSupabaseToken(e.target.value); setSupabaseTokenValidated(false); setOrgs([]); setSelectedOrg(''); setOrgProjects([]); setSelectedProjectRef(''); setSelectedSupabaseUrl(''); }}
                placeholder="Cole seu Personal Access Token (PAT)" />
              {loadingOrgs && <span className="install-tag warn"><Loader2 size={10} className="install-spinner" style={{ display: 'inline' }} /> Buscando...</span>}
              {orgs.length > 0 && <span className="install-tag ok">{orgs.length} org(s) encontrada(s)</span>}
              <div className="install-form-hint"><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>supabase.com/dashboard/account/tokens</a> — PAT. Busca automatica ao colar.</div>
            </div>

            <div className="install-nav-buttons">
              <button className="install-btn-back" onClick={() => router.push('/install/start')}><ArrowLeft size={16} /> Voltar</button>
              <button className="install-btn-next" onClick={goToStep2} disabled={loadingOrgs}>
                {loadingOrgs ? <><Loader2 size={16} className="install-spinner" /> Buscando...</> : <>Proximo <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2: Setup */}
        {step === 2 && (
          <div>
            <h2 className="install-step-title">Configurar Projeto</h2>
            <p className="install-step-desc">Selecione ou crie um projeto Supabase.</p>

            {orgs.length > 1 && (
              <div className="install-form-group">
                <label className="install-form-label">Organizacao</label>
                <select className="install-form-select" value={selectedOrg} onChange={e => loadProjects(e.target.value)}>
                  <option value="">Selecione...</option>
                  {orgs.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                </select>
              </div>
            )}

            {(selectedOrg || orgs.length === 0) && (
              <>
                <div className="install-form-group">
                  <label className="install-form-label">Projeto Supabase</label>
                  {loadingProjects ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={20} className="install-spinner" /></div> :
                    orgProjects.length === 0 ? <div style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{orgs.length === 0 ? 'Nenhum projeto encontrado para este token.' : 'Nenhum projeto. Crie um abaixo.'}</div> :
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {orgProjects.map(p => (
                          <div key={p.ref} className={`install-project-card ${selectedProjectRef === p.ref ? 'selected' : ''}`} onClick={() => selectProject(p.ref)}>
                            <div>
                              <div className="install-project-card-name">{p.name}</div>
                              <div className="install-project-card-detail">{p.ref} {p.status && <span className={`install-tag ${p.status === 'ACTIVE_HEALTHY' ? 'ok' : 'warn'}`}>{p.status}</span>}</div>
                            </div>
                            {selectedProjectRef === p.ref && <CheckCircle2 size={18} style={{ color: 'var(--accent-gold)' }} />}
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {selectedProjectRef && !newProjectName.trim() && (
                  <div className="install-form-group" style={{ marginTop: 12 }}>
                    <label className="install-form-label">Senha do Banco de Dados do Projeto Selecionado</label>
                    <input className="install-form-input" type="password" value={existingProjectDbPass} onChange={e => { setExistingProjectDbPass(e.target.value); setStepError(''); }} placeholder="Senha mestre do banco de dados (postgres)" />
                    <div className="install-form-hint">A senha que voce definiu ao criar esse projeto no Supabase. E necessaria para aplicar o schema e conectar via pooler regional.</div>
                  </div>
                )}

                <div className="install-create-box">
                  <h4><Plus size={14} style={{ display: 'inline', marginRight: 4 }} />Criar Novo Projeto</h4>
                  {!selectedOrg && orgs.length === 0 ? (
                    <div className="install-form-hint">Sua conta nao retornou organizacoes pela API do Supabase. Neste caso, selecione um projeto existente acima.</div>
                  ) : (
                    <>
                      <div className="install-form-group"><input className="install-form-input" type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nome do projeto" /></div>
                      <div className="install-form-group"><input className="install-form-input" type="password" value={newProjectDbPass} onChange={e => setNewProjectDbPass(e.target.value)} placeholder="Senha do banco (min 12 caracteres)" /></div>
                      <div className="install-form-group">
                        <select className="install-form-select" value={newProjectRegion} onChange={e => setNewProjectRegion(e.target.value)}>
                          <option value="">Regiao (auto)</option>
                          <option value="americas">Americas</option>
                          <option value="emea">Europa / Medio Oriente</option>
                          <option value="apac">Asia-Pacifico</option>
                        </select>
                      </div>
                    </>
                  )}
                  <button className="install-btn-create" onClick={handleCreateProject} disabled={creatingProject || !selectedOrg}>
                    {creatingProject ? <Loader2 size={14} className="install-spinner" /> : <Plus size={14} />}
                    {creatingProject ? 'Criando...' : 'Criar Projeto'}
                  </button>
                  {!selectedOrg && orgs.length > 1 && <div className="install-form-hint">Selecione uma organizacao para habilitar a criacao.</div>}
                </div>
              </>
            )}

            {vercelProjects.length > 0 && (<>
              <div className="install-divider" />
              <div className="install-form-group">
                <label className="install-form-label">Projeto Vercel</label>
                <select className="install-form-select" value={vercelProjectId} onChange={e => setVercelProjectId(e.target.value)}>
                  <option value="">Nao configurar</option>
                  {vercelProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>)}

            <div className="install-divider" />

            <div className="install-form-group">
              <label className="install-form-label">Senha do Painel Admin</label>
              <div className="install-form-input-group">
                <input className="install-form-input" type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={e => { setAdminPassword(e.target.value); setStepError(''); }} placeholder="Senha segura" />
                <button className="install-form-toggle-btn" onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <div className="install-form-group">
              <label className="install-form-label">Confirmar Senha</label>
              <input className="install-form-input" type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setStepError(''); }} placeholder="Repita a senha" />
            </div>
            <div className="install-form-group">
              <label className="install-form-label">GTM ID <span className="install-tag ok" style={{ marginLeft: 0 }}>Opcional</span></label>
              <input className="install-form-input" type="text" value={gtmId} onChange={e => setGtmId(e.target.value)} placeholder="GTM-XXXXXXX" />
            </div>

            <div className="install-nav-buttons">
              <button className="install-btn-back" onClick={handleBack}><ArrowLeft size={16} /> Voltar</button>
              <button className="install-btn-next" onClick={handleNext}>Instalar <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {/* PASSO 3: Execucao */}
        {step === 3 && (
          <div>
            <h2 className="install-step-title">{runStatus === 'running' ? 'Executando...' : runStatus === 'success' ? 'Concluido!' : 'Erro'}</h2>
            <div className={`install-run-status ${runStatus}`}>
              {runStatus === 'running' && <><Loader2 size={22} className="install-spinner" style={{ color: 'var(--accent-gold)' }} /><span className="install-run-status-text" style={{ color: 'var(--accent-gold)' }}>Configurando banco e ambiente...</span></>}
              {runStatus === 'success' && <><CheckCircle2 size={22} style={{ color: 'var(--status-success)' }} /><span className="install-run-status-text" style={{ color: 'var(--status-success)' }}>Tudo pronto!</span></>}
              {runStatus === 'error' && <><AlertCircle size={22} style={{ color: 'var(--status-error)' }} /><span className="install-run-status-text" style={{ color: 'var(--status-error)' }}>{errorMsg}</span></>}
            </div>
            <div className="install-run-logs">
              {logs.map((l, i) => <div key={i} className="install-log-entry"><span className="install-log-time">[{l.time}]</span><span className={`install-log-msg ${l.type}`}>{l.message}</span></div>)}
              {runStatus === 'running' && <div className="install-log-entry"><span className="install-log-time">&nbsp;</span><span className="install-log-msg"><Loader2 size={13} className="install-spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Aguardando...</span></div>}
            </div>

            {runStatus === 'error' && supabasePaused && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.07)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '20px',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                color: 'var(--text-secondary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#f59e0b', fontWeight: '600' }}>
                  <Database size={18} />
                  <span>Seu Banco Supabase está Inativo ou Pausado</span>
                </div>
                <p style={{ margin: '0 0 12px 0' }}>
                  Projetos do plano gratuito da Supabase entram em hibernação após 7 dias de inatividade. Para corrigir isso e concluir a instalação, siga os passos abaixo:
                </p>
                <ol style={{ margin: '0 0 16px 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Acesse o <strong><a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Dashboard da Supabase</a></strong>.</li>
                  <li>Localize seu projeto (ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>{selectedProjectRef}</code>).</li>
                  <li>Clique em <strong>"Restore project"</strong> (Restaurar) e aguarde de 2 a 3 minutos até que ele fique ativo.</li>
                  <li>Quando estiver ativo, clique no botão <strong>"Tentar Novamente"</strong> abaixo.</li>
                </ol>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={`https://supabase.com/dashboard/project/${selectedProjectRef}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="install-btn-search"
                    style={{ textDecoration: 'none', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b', padding: '8px 12px', fontSize: '0.78rem' }}
                  >
                    Abrir Painel do Projeto
                  </a>
                </div>
              </div>
            )}

            {runStatus === 'success' && <button className="install-btn-admin" onClick={() => router.push('/admin')}>Acessar Painel <ArrowRight size={16} /></button>}
            {runStatus === 'error' && <div style={{ display: 'flex', gap: 10 }}><button className="install-btn-retry" onClick={() => { setStep(1); setRunStatus('idle'); setLogs([]); setErrorMsg(''); }}><ArrowLeft size={16} /> Corrigir</button><button className="install-btn-next" onClick={runInstall}>Tentar Novamente</button></div>}
          </div>
        )}
      </div>
    </div>
  );
}
