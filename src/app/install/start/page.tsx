'use client';

import { useRouter } from 'next/navigation';
import { Database, KeyRound, Settings, ArrowRight } from 'lucide-react';

/**
 * Tela de boas-vindas do instalador.
 * Apresenta os pré-requisitos necessários e inicia o fluxo do wizard.
 */
export default function InstallStartPage() {
  const router = useRouter();

  const requisitos = [
    {
      icon: Database,
      titulo: 'Banco de Dados Supabase',
      descricao: 'Tenha em mãos a URL de conexão (Connection String) do seu projeto no Supabase.',
    },
    {
      icon: KeyRound,
      titulo: 'Credenciais Google Cloud',
      descricao: 'Client ID e Client Secret do Google OAuth 2.0 (para integração com o Google Calendar).',
    },
    {
      icon: Settings,
      titulo: 'Configurações do Admin',
      descricao: 'Defina a senha de acesso ao painel administrativo e, opcionalmente, o ID do Google Tag Manager.',
    },
  ];

  return (
    <div className="install-start-container">
      <style>{`
        .install-start-container {
          min-height: 100vh;
          background: var(--bg-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-sans);
        }

        .install-start-card {
          width: 100%;
          max-width: 540px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 40px 32px;
          box-shadow: var(--shadow-premium);
        }

        .install-start-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(197, 168, 128, 0.1);
          border: 1px solid rgba(197, 168, 128, 0.2);
          color: var(--accent-gold);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .install-start-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }

        .install-start-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .install-start-requisitos {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .install-requisito-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          transition: border-color 0.2s ease;
        }

        .install-requisito-item:hover {
          border-color: var(--border-color);
        }

        .install-requisito-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(197, 168, 128, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-gold);
        }

        .install-requisito-titulo {
          font-size: 0.95rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .install-requisito-descricao {
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .install-start-btn {
          width: 100%;
          padding: 16px 24px;
          background: linear-gradient(135deg, #d4af37 0%, var(--accent-gold) 100%);
          color: #000;
          font-family: var(--font-sans);
          font-size: 1rem;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 15px rgba(197, 168, 128, 0.3);
        }

        .install-start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(197, 168, 128, 0.45);
        }

        .install-start-btn:active {
          transform: translateY(0);
        }

        @media (max-width: 600px) {
          .install-start-card {
            padding: 28px 20px;
          }
          .install-start-title {
            font-size: 1.4rem;
          }
        }
      `}</style>

      <div className="install-start-card">
        <div className="install-start-badge">Assistente de Configuração</div>
        <h1 className="install-start-title">Bem-vindo ao Instalador</h1>
        <p className="install-start-subtitle">
          Configure o aplicativo de agendamento em poucos passos.
          Antes de começar, certifique-se de ter em mãos os itens abaixo:
        </p>

        <div className="install-start-requisitos">
          {requisitos.map((req, i) => {
            const Icon = req.icon;
            return (
              <div key={i} className="install-requisito-item">
                <div className="install-requisito-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="install-requisito-titulo">{req.titulo}</div>
                  <div className="install-requisito-descricao">{req.descricao}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="install-start-btn"
          onClick={() => router.push('/install/wizard')}
        >
          Iniciar Configuração
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
