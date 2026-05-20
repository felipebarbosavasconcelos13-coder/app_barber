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
} from 'lucide-react';

type Step = 1 | 2 | 3;
type RunStatus = 'idle' | 'running' | 'success' | 'error';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface InstallStep {
  id: string;
  status: string;
  message: string;
}

/**
 * Wizard de instalacao multi-passos.
 * Passo 1: Vercel Token + Projeto + URL do banco Supabase
 * Passo 2: Senha do Admin e GTM ID
 * Passo 3: Execucao
 */
export default function InstallWizardPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjectId, setVercelProjectId] = useState('');
  const [vercelTeamId, setVercelTeamId] = useState('');
  const [vercelProjects, setVercelProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const [databaseUrl, setDatabaseUrl] = useState('');

  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gtmId, setGtmId] = useState('');

  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [installSteps, setInstallSteps] = useState<InstallStep[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [stepError, setStepError] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const isVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  const searchProjects = async () => {
    if (!vercelToken.trim()) return;
    setLoadingProjects(true);
    setTokenValid(null);
    try {
      const res = await fetch('/api/install/vercel/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: vercelToken.trim(), teamId: vercelTeamId || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.projects) {
        setVercelProjects(data.projects);
        setTokenValid(true);
        if (data.projects.length === 1) {
          setVercelProjectId(data.projects[0].id);
        }
      } else {
        setTokenValid(false);
        setStepError(data.error || 'Token invalido ou sem projetos.');
      }
    } catch {
      setTokenValid(false);
      setStepError('Erro ao buscar projetos na Vercel.');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Auto-detecta projeto se estiver em um dominio .vercel.app
  useEffect(() => {
    if (isVercel && !vercelProjectId && !vercelToken) {
      const autoProjectId = appUrl.replace('https://', '').replace('.vercel.app', '');
      if (autoProjectId) {
        setVercelProjectId(autoProjectId);
      }
    }
  }, []);

  const validateStep1 = (): boolean => {
    if (!databaseUrl.trim()) {
      setStepError('Informe a URL de conexao do banco de dados.');
      return false;
    }
    if (!databaseUrl.includes('postgresql://') && !databaseUrl.includes('postgres://')) {
      setStepError('A URL deve iniciar com postgresql:// ou postgres://');
      return false;
    }
    setStepError('');
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!adminPassword.trim()) {
      setStepError('Defina uma senha para o painel administrativo.');
      return false;
    }
    if (adminPassword.length < 4) {
      setStepError('A senha deve ter pelo menos 4 caracteres.');
      return false;
    }
    if (adminPassword !== confirmPassword) {
      setStepError('As senhas nao conferem.');
      return false;
    }
    setStepError('');
    return true;
  };

  const handleNext = () => {
    let valid = false;
    if (step === 1) valid = validateStep1();
    if (step === 2) valid = validateStep2();

    if (valid && step < 3) {
      setStep((step + 1) as Step);
    }

    if (valid && step === 2) {
      setStep(3);
      runInstall();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStepError('');
      setStep((step - 1) as Step);
    }
  };

  const runInstall = async () => {
    setRunStatus('running');
    setLogs([]);
    setInstallSteps([]);
    setErrorMsg('');

    addLog('Iniciando o processo de instalacao...');

    if (vercelToken.trim() && vercelProjectId.trim()) {
      addLog('Configurando variaveis de ambiente na Vercel via API...');
    }
    addLog('Conectando ao banco de dados...');

    try {
      const res = await fetch('/api/install/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseUrl: databaseUrl.trim(),
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
        if (data.steps) setInstallSteps(data.steps);
        setRunStatus('error');
        setErrorMsg(data.error || 'Erro ao executar a instalacao');
        return;
      }

      if (data.steps) {
        setInstallSteps(data.steps);
        for (const s of data.steps) {
          addLog(s.message, s.status === 'ok' ? 'success' : s.status === 'warning' ? 'info' : 'error');
        }
      }

      addLog('Schema do Prisma aplicado ao banco (db push).', 'success');
      addLog('Dados iniciais inseridos no banco (db seed).', 'success');
      addLog('Senha administrativa configurada.', 'success');
      addLog('Instalacao concluida com sucesso!', 'success');
      setRunStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Erro critico: ${msg}`, 'error');
      setRunStatus('error');
      setErrorMsg(msg);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVercelToken(e.target.value);
    setTokenValid(null);
    setVercelProjects([]);
  };

  const steps = [
    { num: 1, label: 'Conexao', icon: Cloud },
    { num: 2, label: 'Admin', icon: Settings },
    { num: 3, label: 'Executar', icon: CheckCircle2 },
  ];

  return (
    <div className="install-wizard-container">
      <style>{`
        .install-wizard-container {
          min-height: 100vh;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-sans);
        }
        .install-wizard-card {
          width: 100%;
          max-width: 600px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 36px 32px;
          box-shadow: var(--shadow-premium);
        }
        .install-stepper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 32px;
        }
        .install-step-item { display: flex; align-items: center; gap: 8px; }
        .install-step-circle {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.82rem; font-weight: 600;
          border: 2px solid var(--border-color);
          color: var(--text-muted); background: transparent;
          transition: all 0.3s ease;
        }
        .install-step-circle.active {
          border-color: var(--accent-gold);
          background: rgba(197, 168, 128, 0.1);
          color: var(--accent-gold);
        }
        .install-step-circle.done {
          border-color: var(--status-success);
          background: rgba(16, 185, 129, 0.1);
          color: var(--status-success);
        }
        .install-step-label { font-size: 0.75rem; color: var(--text-muted); display: none; }
        .install-step-label.active { color: var(--accent-gold); }
        .install-step-connector {
          width: 32px; height: 2px; background: var(--border-color);
          margin: 0 6px; transition: background 0.3s ease;
        }
        .install-step-connector.done { background: var(--status-success); }
        .install-step-title { font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .install-step-desc { font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
        .install-form-group { margin-bottom: 18px; }
        .install-form-label { display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
        .install-form-input {
          width: 100%; padding: 13px 16px;
          background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color);
          border-radius: 10px; color: var(--text-primary);
          font-family: var(--font-sans); font-size: 0.95rem;
          transition: all 0.25s ease;
        }
        .install-form-input:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px var(--accent-gold-glow); }
        .install-form-input::placeholder { color: var(--text-muted); }
        .install-form-select {
          width: 100%; padding: 13px 16px;
          background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color);
          border-radius: 10px; color: var(--text-primary);
          font-family: var(--font-sans); font-size: 0.95rem;
          transition: all 0.25s ease; cursor: pointer;
        }
        .install-form-select:focus { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px var(--accent-gold-glow); }
        .install-form-hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; line-height: 1.4; }
        .install-form-input-group { position: relative; }
        .install-form-input-group .install-form-input { padding-right: 44px; }
        .install-form-toggle-btn {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          padding: 4px; display: flex; align-items: center;
        }
        .install-form-toggle-btn:hover { color: var(--text-secondary); }
        .install-optional-tag {
          display: inline-block; padding: 2px 8px; border-radius: 6px;
          background: rgba(245, 158, 11, 0.1); color: var(--status-warning);
          font-size: 0.72rem; font-weight: 600; margin-left: 8px;
        }
        .install-btn-row { display: flex; gap: 8px; align-items: center; }
        .install-btn-search {
          flex-shrink: 0; padding: 13px 18px;
          background: rgba(197, 168, 128, 0.1); border: 1px solid rgba(197, 168, 128, 0.2);
          border-radius: 10px; color: var(--accent-gold); cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;
          transition: all 0.2s ease;
        }
        .install-btn-search:hover { background: rgba(197, 168, 128, 0.2); }
        .install-btn-search:disabled { opacity: 0.5; cursor: not-allowed; }
        .install-token-valid {
          display: inline-block; padding: 2px 8px; border-radius: 6px;
          font-size: 0.75rem; font-weight: 600; margin-top: 4px;
        }
        .install-token-valid.success { background: rgba(16, 185, 129, 0.1); color: var(--status-success); }
        .install-token-valid.error { background: rgba(239, 68, 68, 0.1); color: var(--status-error); }
        .install-divider {
          border: 0; height: 1px; background: var(--border-color);
          margin: 24px 0;
        }
        .install-nav-buttons { display: flex; gap: 12px; margin-top: 28px; }
        .install-btn-back {
          flex: 0 0 auto; padding: 14px 20px;
          background: transparent; border: 1px solid var(--border-color);
          border-radius: 10px; color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;
          cursor: pointer; display: flex; align-items: center; gap: 6px;
          transition: all 0.2s ease;
        }
        .install-btn-back:hover { border-color: var(--text-muted); color: var(--text-primary); }
        .install-btn-next {
          flex: 1; padding: 14px 24px;
          background: linear-gradient(135deg, #d4af37 0%, var(--accent-gold) 100%);
          color: #000; font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600;
          border: none; border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 15px rgba(197, 168, 128, 0.3);
        }
        .install-btn-next:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(197, 168, 128, 0.45); }
        .install-btn-next:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; box-shadow: none; transform: none; }
        .install-error-box {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; margin-bottom: 16px;
        }
        .install-error-text { font-size: 0.85rem; color: var(--status-error); line-height: 1.4; }
        .install-run-logs {
          max-height: 260px; overflow-y: auto;
          background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-light);
          border-radius: 10px; padding: 14px; margin-bottom: 20px;
        }
        .install-log-entry { display: flex; gap: 10px; padding: 5px 0; font-size: 0.82rem; line-height: 1.5; }
        .install-log-time { flex-shrink: 0; color: var(--text-muted); font-family: monospace; font-size: 0.78rem; }
        .install-log-msg { color: var(--text-secondary); }
        .install-log-msg.success { color: var(--status-success); }
        .install-log-msg.error { color: var(--status-error); }
        .install-run-status {
          display: flex; align-items: center; gap: 12px;
          padding: 16px; border-radius: 12px; margin-bottom: 20px;
        }
        .install-run-status.running { background: rgba(197, 168, 128, 0.08); border: 1px solid rgba(197, 168, 128, 0.15); }
        .install-run-status.success { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); }
        .install-run-status.error { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); }
        .install-run-status-text { font-size: 0.9rem; font-weight: 500; }
        .install-run-status.running .install-run-status-text { color: var(--accent-gold); }
        .install-run-status.success .install-run-status-text { color: var(--status-success); }
        .install-run-status.error .install-run-status-text { color: var(--status-error); }
        .install-success-actions { display: flex; flex-direction: column; gap: 10px; }
        .install-btn-admin {
          width: 100%; padding: 14px 24px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff; font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600;
          border: none; border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.3s ease;
        }
        .install-btn-admin:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); }
        .install-btn-retry {
          width: 100%; padding: 14px 24px;
          background: transparent; border: 1px solid var(--border-color);
          border-radius: 10px; color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s ease;
        }
        .install-btn-retry:hover { border-color: var(--text-muted); color: var(--text-primary); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .install-spinner { animation: spin 1s linear infinite; }
        @media (max-width: 600px) {
          .install-wizard-card { padding: 24px 18px; }
          .install-step-label { display: none; }
        }
        @media (min-width: 601px) {
          .install-step-label { display: block; }
        }
      `}</style>

      <div className="install-wizard-card">
        <div className="install-stepper">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div className={`install-step-connector ${isDone ? 'done' : ''}`} />
                )}
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
            <AlertCircle size={18} style={{ color: 'var(--status-error)', flexShrink: 0, marginTop: '2px' }} />
            <div className="install-error-text">{stepError}</div>
          </div>
        )}

        {/* PASSO 1: Conexao Vercel + Supabase */}
        {step === 1 && (
          <div>
            <h2 className="install-step-title">Conectar Vercel e Supabase</h2>
            <p className="install-step-desc">
              Configure a integracao automatica com a Vercel e conecte seu banco Supabase.
            </p>

            {/* Vercel Token */}
            <div className="install-form-group">
              <label className="install-form-label">Vercel API Token</label>
              <div className="install-btn-row">
                <input
                  className="install-form-input"
                  type="password"
                  value={vercelToken}
                  onChange={handleTextChange}
                  placeholder="Cole seu token da Vercel (Full Account)"
                  style={{ flex: 1 }}
                />
                <button
                  className="install-btn-search"
                  onClick={searchProjects}
                  disabled={!vercelToken.trim() || loadingProjects}
                >
                  {loadingProjects ? <Loader2 size={16} className="install-spinner" /> : <Search size={16} />}
                  Buscar
                </button>
              </div>
              {tokenValid === true && (
                <span className="install-token-valid success">Token valido</span>
              )}
              {tokenValid === false && (
                <span className="install-token-valid error">Token invalido</span>
              )}
              <div className="install-form-hint">
                Crie em:{' '}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-gold)' }}>
                  vercel.com/account/tokens
                </a>
                {' '}— escopo <strong>Full Account</strong>.
              </div>
            </div>

            {/* Projeto Vercel */}
            {vercelProjects.length > 0 && (
              <div className="install-form-group">
                <label className="install-form-label">Projeto Vercel</label>
                <select
                  className="install-form-select"
                  value={vercelProjectId}
                  onChange={(e) => setVercelProjectId(e.target.value)}
                >
                  <option value="">Selecione um projeto...</option>
                  {vercelProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {vercelProjects.length === 0 && tokenValid === true && (
              <div className="install-form-group">
                <label className="install-form-label">ID do Projeto Vercel</label>
                <input
                  className="install-form-input"
                  type="text"
                  value={vercelProjectId}
                  onChange={(e) => setVercelProjectId(e.target.value)}
                  placeholder="prj_xxxxxxxxxxxxx"
                />
              </div>
            )}

            <hr className="install-divider" />

            {/* DATABASE_URL */}
            <div className="install-form-group">
              <label className="install-form-label">DATABASE_URL (Supabase)</label>
              <input
                className="install-form-input"
                type="text"
                value={databaseUrl}
                onChange={(e) => { setDatabaseUrl(e.target.value); setStepError(''); }}
                placeholder="postgresql://postgres:[SUA-SENHA]@db.xxxxx.supabase.co:5432/postgres"
                autoFocus={!isVercel}
              />
              <div className="install-form-hint">
                Encontre em: Supabase &rarr; Project Settings &rarr; Database &rarr; Connection String (URI).
              </div>
            </div>

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

        {/* PASSO 2: Administrador */}
        {step === 2 && (
          <div>
            <h2 className="install-step-title">Configuracoes do Administrador</h2>
            <p className="install-step-desc">
              Defina a senha de acesso ao painel administrativo e, opcionalmente, o ID do GTM para tracking.
            </p>

            <div className="install-form-group">
              <label className="install-form-label">Senha do Painel Admin</label>
              <div className="install-form-input-group">
                <input
                  className="install-form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setStepError(''); }}
                  placeholder="Defina uma senha segura"
                  autoFocus
                />
                <button className="install-form-toggle-btn" onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="install-form-group">
              <label className="install-form-label">Confirmar Senha</label>
              <input
                className="install-form-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setStepError(''); }}
                placeholder="Repita a senha"
              />
            </div>

            <div className="install-form-group">
              <label className="install-form-label">
                Google Tag Manager ID
                <span className="install-optional-tag">Opcional</span>
              </label>
              <input
                className="install-form-input"
                type="text"
                value={gtmId}
                onChange={(e) => setGtmId(e.target.value)}
                placeholder="GTM-XXXXXXX"
              />
              <div className="install-form-hint">
                Usado para rastrear eventos de agendamento (bookings) e otimizar campanhas.
              </div>
            </div>

            <div className="install-nav-buttons">
              <button className="install-btn-back" onClick={handleBack}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button className="install-btn-next" onClick={handleNext}>
                Instalar Agora <ArrowRight size={16} />
              </button>
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
              {runStatus === 'idle' && 'Preparando...'}
            </h2>

            <div className={`install-run-status ${runStatus}`}>
              {runStatus === 'running' && (
                <>
                  <Loader2 size={22} className="install-spinner" style={{ color: 'var(--accent-gold)' }} />
                  <span className="install-run-status-text">Configurando o banco de dados e criando as tabelas...</span>
                </>
              )}
              {runStatus === 'success' && (
                <>
                  <CheckCircle2 size={22} style={{ color: 'var(--status-success)' }} />
                  <span className="install-run-status-text">Tudo pronto! O aplicativo esta configurado.</span>
                </>
              )}
              {runStatus === 'error' && (
                <>
                  <AlertCircle size={22} style={{ color: 'var(--status-error)' }} />
                  <span className="install-run-status-text">{errorMsg}</span>
                </>
              )}
            </div>

            <div className="install-run-logs">
              {logs.map((log, i) => (
                <div key={i} className="install-log-entry">
                  <span className="install-log-time">[{log.time}]</span>
                  <span className={`install-log-msg ${log.type}`}>{log.message}</span>
                </div>
              ))}
              {runStatus === 'running' && logs.length > 0 && (
                <div className="install-log-entry">
                  <span className="install-log-time">&nbsp;</span>
                  <span className="install-log-msg">
                    <Loader2 size={14} className="install-spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    {' '}Aguardando...
                  </span>
                </div>
              )}
            </div>

            {runStatus === 'success' && (
              <div className="install-success-actions">
                <button className="install-btn-admin" onClick={() => router.push('/admin')}>
                  Acessar Painel Administrativo <ArrowRight size={16} />
                </button>
              </div>
            )}

            {runStatus === 'error' && (
              <div className="install-success-actions">
                <button className="install-btn-retry" onClick={() => { setStep(1); setRunStatus('idle'); setLogs([]); setInstallSteps([]); setErrorMsg(''); }}>
                  <ArrowLeft size={16} /> Voltar e Corrigir
                </button>
                <button className="install-btn-next" onClick={runInstall}>
                  Tentar Novamente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
