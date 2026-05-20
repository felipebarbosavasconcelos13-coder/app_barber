'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Cloud,
  Globe,
} from 'lucide-react';

type Step = 1 | 2 | 3;
type RunStatus = 'idle' | 'running' | 'success' | 'error';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function InstallWizardPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  // Vercel
  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjectId, setVercelProjectId] = useState('');
  const [vercelProjects, setVercelProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVercel, setLoadingVercel] = useState(false);
  const [vercelValid, setVercelValid] = useState<boolean | null>(null);

  // Supabase
  const [supabaseToken, setSupabaseToken] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseProjects, setSupabaseProjects] = useState<Array<{ ref: string; name: string }>>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [supabaseValid, setSupabaseValid] = useState<boolean | null>(null);

  // Admin
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gtmId, setGtmId] = useState('');

  // Execucao
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [stepError, setStepError] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const isVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  // Auto-detecta projeto Vercel
  useEffect(() => {
    if (isVercel && !vercelProjectId && !vercelToken) {
      const autoId = appUrl.replace('https://', '').replace('.vercel.app', '');
      if (autoId) setVercelProjectId(autoId);
    }
  }, []);

  const searchVercelProjects = async () => {
    if (!vercelToken.trim()) return;
    setLoadingVercel(true);
    setVercelValid(null);
    try {
      const res = await fetch('/api/install/vercel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: vercelToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.projects) {
        setVercelProjects(data.projects);
        setVercelValid(true);
        if (data.projects.length === 1) setVercelProjectId(data.projects[0].id);
      } else {
        setVercelValid(false);
        setStepError(data.error || 'Token Vercel invalido.');
      }
    } catch {
      setVercelValid(false);
    } finally {
      setLoadingVercel(false);
    }
  };

  const searchSupabaseProjects = async () => {
    if (!supabaseToken.trim()) return;
    setLoadingSupabase(true);
    setSupabaseValid(null);
    try {
      const res = await fetch('/api/install/supabase/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: supabaseToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.projects) {
        setSupabaseProjects(data.projects);
        setSupabaseValid(true);
        if (data.projects.length === 1) {
          const p = data.projects[0];
          setSupabaseUrl(`https://${p.ref}.supabase.co`);
        }
      } else {
        setSupabaseValid(false);
        setStepError(data.error || 'Token Supabase invalido.');
      }
    } catch {
      setSupabaseValid(false);
    } finally {
      setLoadingSupabase(false);
    }
  };

  const validateStep1 = (): boolean => {
    if (!supabaseToken.trim()) {
      setStepError('Informe o token do Supabase.');
      return false;
    }
    if (!supabaseUrl.trim()) {
      setStepError('Informe a URL do projeto Supabase.');
      return false;
    }
    if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.com')) {
      setStepError('URL do Supabase invalida.');
      return false;
    }
    setStepError('');
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!adminPassword.trim()) { setStepError('Defina uma senha.'); return false; }
    if (adminPassword.length < 4) { setStepError('Senha: min 4 caracteres.'); return false; }
    if (adminPassword !== confirmPassword) { setStepError('Senhas nao conferem.'); return false; }
    setStepError('');
    return true;
  };

  const handleNext = () => {
    let valid = false;
    if (step === 1) valid = validateStep1();
    if (step === 2) valid = validateStep2();
    if (valid && step < 3) setStep((step + 1) as Step);
    if (valid && step === 2) { setStep(3); runInstall(); }
  };

  const handleBack = () => { if (step > 1) { setStepError(''); setStep((step - 1) as Step); } };

  const runInstall = async () => {
    setRunStatus('running');
    setLogs([]);
    setErrorMsg('');
    addLog('Iniciando instalacao...');
    addLog(`Resolvendo DATABASE_URL via API do Supabase...`);

    try {
      const res = await fetch('/api/install/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseToken: supabaseToken.trim(),
          supabaseUrl: supabaseUrl.trim(),
          vercelToken: vercelToken.trim() || undefined,
          vercelProjectId: vercelProjectId.trim() || undefined,
          nextPublicAppUrl: appUrl,
          adminPassword: adminPassword.trim(),
          gtmId: gtmId.trim() || '',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        addLog(`Erro: ${data.error || 'Falha desconhecida'}`, 'error');
        if (data.details) addLog(`Detalhes: ${data.details}`, 'error');
        if (data.steps) data.steps.forEach((s: any) => addLog(s.message, s.status === 'ok' ? 'success' : 'error'));
        setRunStatus('error');
        setErrorMsg(data.error || 'Erro ao executar a instalacao');
        return;
      }

      if (data.steps) data.steps.forEach((s: any) => addLog(s.message, s.status === 'ok' ? 'success' : s.status === 'warning' ? 'info' : 'error'));
      addLog('Instalacao concluida!', 'success');
      setRunStatus('success');
    } catch (err) {
      addLog(`Erro critico: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setRunStatus('error');
      setErrorMsg(String(err));
    }
  };

  const steps = [
    { num: 1, label: 'Tokens', icon: Cloud },
    { num: 2, label: 'Admin', icon: Settings },
    { num: 3, label: 'Executar', icon: CheckCircle2 },
  ];

  return (
    <div className="install-wizard-container">
      <style>{`
        .install-wizard-container { min-height: 100vh; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; padding: 24px; font-family: var(--font-sans); }
        .install-wizard-card { width: 100%; max-width: 600px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; padding: 36px 32px; box-shadow: var(--shadow-premium); }
        .install-stepper { display: flex; align-items: center; justify-content: center; margin-bottom: 32px; }
        .install-step-item { display: flex; align-items: center; gap: 8px; }
        .install-step-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 600; border: 2px solid var(--border-color); color: var(--text-muted); background: transparent; transition: all 0.3s ease; }
        .install-step-circle.active { border-color: var(--accent-gold); background: rgba(197, 168, 128, 0.1); color: var(--accent-gold); }
        .install-step-circle.done { border-color: var(--status-success); background: rgba(16, 185, 129, 0.1); color: var(--status-success); }
        .install-step-label { font-size: 0.75rem; color: var(--text-muted); display: none; }
        .install-step-label.active { color: var(--accent-gold); }
        .install-step-connector { width: 32px; height: 2px; background: var(--border-color); margin: 0 6px; transition: background 0.3s ease; }
        .install-step-connector.done { background: var(--status-success); }
        .install-step-title { font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .install-step-desc { font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
        .install-form-group { margin-bottom: 18px; }
        .install-form-label { display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
        .install-form-input { width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-family: var(--font-sans); font-size: 0.9rem; transition: all 0.25s ease; }
        .install-form-input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px var(--accent-gold-glow); }
        .install-form-input::placeholder { color: var(--text-muted); }
        .install-form-select { width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-family: var(--font-sans); font-size: 0.9rem; cursor: pointer; }
        .install-form-select:focus { outline: none; border-color: var(--accent-gold); }
        .install-form-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4; }
        .install-form-input-group { position: relative; }
        .install-form-input-group .install-form-input { padding-right: 44px; }
        .install-form-toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center; }
        .install-btn-row { display: flex; gap: 8px; align-items: center; }
        .install-btn-search { flex-shrink: 0; padding: 12px 16px; background: rgba(197,168,128,0.1); border: 1px solid rgba(197,168,128,0.2); border-radius: 10px; color: var(--accent-gold); cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: var(--font-sans); font-size: 0.85rem; font-weight: 500; transition: all 0.2s ease; }
        .install-btn-search:hover { background: rgba(197,168,128,0.2); }
        .install-btn-search:disabled { opacity: 0.5; cursor: not-allowed; }
        .install-tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; margin-top: 4px; }
        .install-tag.ok { background: rgba(16,185,129,0.1); color: var(--status-success); }
        .install-tag.err { background: rgba(239,68,68,0.1); color: var(--status-error); }
        .install-divider { border: 0; height: 1px; background: var(--border-color); margin: 20px 0; }
        .install-nav-buttons { display: flex; gap: 12px; margin-top: 28px; }
        .install-btn-back { flex: 0 0 auto; padding: 14px 20px; background: transparent; border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease; }
        .install-btn-back:hover { border-color: var(--text-muted); color: var(--text-primary); }
        .install-btn-next { flex: 1; padding: 14px 24px; background: linear-gradient(135deg, #d4af37 0%, var(--accent-gold) 100%); color: #000; font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(197,168,128,0.3); }
        .install-btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(197,168,128,0.45); }
        .install-error-box { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; margin-bottom: 16px; }
        .install-error-text { font-size: 0.85rem; color: var(--status-error); line-height: 1.4; }
        .install-run-logs { max-height: 260px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; margin-bottom: 20px; }
        .install-log-entry { display: flex; gap: 10px; padding: 5px 0; font-size: 0.82rem; line-height: 1.5; }
        .install-log-time { flex-shrink: 0; color: var(--text-muted); font-family: monospace; font-size: 0.78rem; }
        .install-log-msg { color: var(--text-secondary); }
        .install-log-msg.success { color: var(--status-success); }
        .install-log-msg.error { color: var(--status-error); }
        .install-run-status { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 12px; margin-bottom: 20px; }
        .install-run-status.running { background: rgba(197,168,128,0.08); border: 1px solid rgba(197,168,128,0.15); }
        .install-run-status.success { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
        .install-run-status.error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
        .install-run-status-text { font-size: 0.9rem; font-weight: 500; }
        .install-btn-admin { width: 100%; padding: 14px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease; }
        .install-btn-admin:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.3); }
        .install-btn-retry { width: 100%; padding: 14px 24px; background: transparent; border: 1px solid var(--border-color); border-radius: 10px; color: var(--text-secondary); font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .install-spinner { animation: spin 1s linear infinite; }
        @media (max-width: 600px) { .install-wizard-card { padding: 24px 18px; } }
        @media (min-width: 601px) { .install-step-label { display: block; } }
      `}</style>

      <div className="install-wizard-card">
        <div className="install-stepper">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div className={`install-step-connector ${isDone ? 'done' : ''}`} />}
                <div className="install-step-item">
                  <div className={`install-step-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                    {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`install-step-label ${isActive ? 'active' : ''}`}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {stepError && step < 3 && (
          <div className="install-error-box">
            <AlertCircle size={18} style={{ color: 'var(--status-error)', flexShrink: 0, marginTop: 2 }} />
            <div className="install-error-text">{stepError}</div>
          </div>
        )}

        {/* PASSO 1: Vercel + Supabase Tokens */}
        {step === 1 && (
          <div>
            <h2 className="install-step-title">Conectar Servicos</h2>
            <p className="install-step-desc">Cole os tokens de acesso para configurar tudo automaticamente.</p>

            {/* Vercel */}
            <div className="install-form-group">
              <label className="install-form-label"><Cloud size={14} style={{ display: 'inline', marginRight: 4 }} />Vercel API Token</label>
              <div className="install-btn-row">
                <input className="install-form-input" type="password" value={vercelToken}
                  onChange={(e) => { setVercelToken(e.target.value); setVercelValid(null); setVercelProjects([]); }}
                  placeholder="Token Full Account da Vercel" style={{ flex: 1 }} />
                <button className="install-btn-search" onClick={searchVercelProjects}
                  disabled={!vercelToken.trim() || loadingVercel}>
                  {loadingVercel ? <Loader2 size={16} className="install-spinner" /> : <Search size={16} />}
                </button>
              </div>
              {vercelValid === true && <span className="install-tag ok">Token valido</span>}
              {vercelValid === false && <span className="install-tag err">Token invalido</span>}
              <div className="install-form-hint">
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>vercel.com/account/tokens</a> — escopo <strong>Full Account</strong>. Opcional para dev local.
              </div>
            </div>

            {vercelProjects.length > 0 && (
              <div className="install-form-group">
                <label className="install-form-label">Projeto Vercel</label>
                <select className="install-form-select" value={vercelProjectId}
                  onChange={(e) => setVercelProjectId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {vercelProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {vercelProjects.length === 0 && vercelValid === true && (
              <div className="install-form-group">
                <label className="install-form-label">ID do Projeto Vercel</label>
                <input className="install-form-input" type="text" value={vercelProjectId}
                  onChange={(e) => setVercelProjectId(e.target.value)} placeholder="prj_xxxxxxxxxxxxx" />
              </div>
            )}

            <div className="install-divider" />

            {/* Supabase */}
            <div className="install-form-group">
              <label className="install-form-label"><Database size={14} style={{ display: 'inline', marginRight: 4 }} />Supabase Access Token</label>
              <div className="install-btn-row">
                <input className="install-form-input" type="password" value={supabaseToken}
                  onChange={(e) => { setSupabaseToken(e.target.value); setSupabaseValid(null); setSupabaseProjects([]); }}
                  placeholder="Personal Access Token do Supabase" style={{ flex: 1 }} />
                <button className="install-btn-search" onClick={searchSupabaseProjects}
                  disabled={!supabaseToken.trim() || loadingSupabase}>
                  {loadingSupabase ? <Loader2 size={16} className="install-spinner" /> : <Search size={16} />}
                </button>
              </div>
              {supabaseValid === true && <span className="install-tag ok">Token valido</span>}
              {supabaseValid === false && <span className="install-tag err">Token invalido</span>}
              <div className="install-form-hint">
                <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>supabase.com/dashboard/account/tokens</a> — Access Token (PAT).
              </div>
            </div>

            {supabaseProjects.length > 0 && (
              <div className="install-form-group">
                <label className="install-form-label">Projeto Supabase</label>
                <select className="install-form-select" value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}>
                  <option value="">Selecione...</option>
                  {supabaseProjects.map((p) => (
                    <option key={p.ref} value={`https://${p.ref}.supabase.co`}>{p.name} ({p.ref})</option>
                  ))}
                </select>
              </div>
            )}

            {supabaseProjects.length === 0 && (
              <div className="install-form-group">
                <label className="install-form-label"><Globe size={14} style={{ display: 'inline', marginRight: 4 }} />URL do Projeto Supabase</label>
                <input className="install-form-input" type="text" value={supabaseUrl}
                  onChange={(e) => { setSupabaseUrl(e.target.value); setStepError(''); }}
                  placeholder="https://xxxxxxxxxxxx.supabase.co" autoFocus={!isVercel} />
                <div className="install-form-hint">Encontre em: Supabase Dashboard &rarr; Project Settings &rarr; URL.</div>
              </div>
            )}

            <div className="install-nav-buttons">
              <button className="install-btn-back" onClick={() => router.push('/install/start')}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button className="install-btn-next" onClick={handleNext}>
                Proximo <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2: Admin */}
        {step === 2 && (
          <div>
            <h2 className="install-step-title">Configuracoes do Administrador</h2>
            <p className="install-step-desc">Defina a senha do painel administrativo.</p>
            <div className="install-form-group">
              <label className="install-form-label">Senha do Painel Admin</label>
              <div className="install-form-input-group">
                <input className="install-form-input" type={showPassword ? 'text' : 'password'}
                  value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setStepError(''); }}
                  placeholder="Senha segura" autoFocus />
                <button className="install-form-toggle-btn" onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="install-form-group">
              <label className="install-form-label">Confirmar Senha</label>
              <input className="install-form-input" type={showPassword ? 'text' : 'password'}
                value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setStepError(''); }}
                placeholder="Repita a senha" />
            </div>
            <div className="install-form-group">
              <label className="install-form-label">Google Tag Manager ID <span className="install-tag ok" style={{ marginLeft: 0 }}>Opcional</span></label>
              <input className="install-form-input" type="text" value={gtmId}
                onChange={(e) => setGtmId(e.target.value)} placeholder="GTM-XXXXXXX" />
            </div>
            <div className="install-nav-buttons">
              <button className="install-btn-back" onClick={handleBack}><ArrowLeft size={16} /> Voltar</button>
              <button className="install-btn-next" onClick={handleNext}>Instalar Agora <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {/* PASSO 3: Execucao */}
        {step === 3 && (
          <div>
            <h2 className="install-step-title">
              {runStatus === 'running' && 'Executando Instalacao...'}
              {runStatus === 'success' && 'Instalacao Concluida!'}
              {runStatus === 'error' && 'Erro na Instalacao'}
            </h2>

            <div className={`install-run-status ${runStatus}`}>
              {runStatus === 'running' && <><Loader2 size={22} className="install-spinner" style={{ color: 'var(--accent-gold)' }} /><span className="install-run-status-text" style={{ color: 'var(--accent-gold)' }}>Configurando banco e ambiente...</span></>}
              {runStatus === 'success' && <><CheckCircle2 size={22} style={{ color: 'var(--status-success)' }} /><span className="install-run-status-text" style={{ color: 'var(--status-success)' }}>Tudo pronto!</span></>}
              {runStatus === 'error' && <><AlertCircle size={22} style={{ color: 'var(--status-error)' }} /><span className="install-run-status-text" style={{ color: 'var(--status-error)' }}>{errorMsg}</span></>}
            </div>

            <div className="install-run-logs">
              {logs.map((log, i) => (
                <div key={i} className="install-log-entry">
                  <span className="install-log-time">[{log.time}]</span>
                  <span className={`install-log-msg ${log.type}`}>{log.message}</span>
                </div>
              ))}
              {runStatus === 'running' && logs.length > 0 && (
                <div className="install-log-entry"><span className="install-log-time">&nbsp;</span><span className="install-log-msg"><Loader2 size={14} className="install-spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Aguardando...</span></div>
              )}
            </div>

            {runStatus === 'success' && (
              <div className="install-success-actions">
                <button className="install-btn-admin" onClick={() => router.push('/admin')}>Acessar Painel Administrativo <ArrowRight size={16} /></button>
              </div>
            )}
            {runStatus === 'error' && (
              <div className="install-success-actions">
                <button className="install-btn-retry" onClick={() => { setStep(1); setRunStatus('idle'); setLogs([]); setErrorMsg(''); }}>
                  <ArrowLeft size={16} /> Voltar e Corrigir
                </button>
                <button className="install-btn-next" onClick={runInstall}>Tentar Novamente</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
