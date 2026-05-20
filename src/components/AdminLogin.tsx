"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Scissors, Eye, EyeOff, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao fazer login.");
      }

      // Login com sucesso, atualiza o componente de servidor para ler o novo cookie
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container flex-center">
      <div className="glass-card login-card animate-fade-in">
        <div className="login-header">
          <div className="logo-icon flex-center">
            <Scissors size={28} className="gold-glow" style={{ color: "var(--accent-gold)" }} />
          </div>
          <h1 className="title-serif gold-glow">Barbearia Premium</h1>
          <p>Painel Administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message animate-fade-in">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Senha de Acesso
            </label>
            <div className="password-input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="form-input password-input"
                placeholder="Insira a senha mestra"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-gold login-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" /> Autenticando...
              </>
            ) : (
              "Entrar no Painel"
            )}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at center, #1b1b22 0%, #0a0a0c 100%);
          padding: 20px;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 40px 30px;
          text-align: center;
        }
        .login-header {
          margin-bottom: 35px;
        }
        .logo-icon {
          width: 60px;
          height: 60px;
          background: rgba(197, 168, 128, 0.1);
          border: 1px solid rgba(197, 168, 128, 0.2);
          border-radius: 50%;
          margin: 0 auto 20px;
          box-shadow: 0 0 20px rgba(197, 168, 128, 0.1);
        }
        .login-header h1 {
          font-size: 2rem;
          margin-bottom: 8px;
        }
        .login-header p {
          font-size: 0.95rem;
          color: var(--text-muted);
        }
        .login-form {
          text-align: left;
        }
        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--status-error);
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .password-input {
          padding-left: 45px;
          padding-right: 45px;
        }
        .input-icon {
          position: absolute;
          left: 16px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .toggle-password {
          position: absolute;
          right: 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: color 0.2s ease;
        }
        .toggle-password:hover {
          color: var(--text-primary);
        }
        .login-btn {
          width: 100%;
          margin-top: 10px;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
