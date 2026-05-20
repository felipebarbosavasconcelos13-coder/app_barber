# Plano de Implementação: Wizard de Instalação Web & Migração para o Supabase

Este documento apresenta o plano de ação detalhado para criar um **Wizard de Instalação na Web (`/install`)** para o aplicativo de agendamento online de barbearia, unindo-o à migração para o **Supabase (PostgreSQL)** e ao versionamento completo no **GitHub**.

---

## Detalhes do Novo Recurso: Wizard de Instalação (`/install`)

Inspirado no instalador do CRM de referência, desenvolveremos um assistente visual automatizado que permite a configuração da base de dados e das APIs integradas diretamente no navegador Web na primeira inicialização da aplicação, sem exigir que o usuário final configure arquivos ou execute comandos de terminal manualmente.

Conforme solicitado, **o instalador será prático e funcional**, focado em simplicidade, clareza e feedback visual em tempo real do progresso das tarefas de banco de dados (push e seed do Prisma).

### Fluxo de Funcionamento
1. **Verificação de Inicialização**: A aplicação consulta o banco. Se a tabela `SystemSettings` já estiver devidamente populada e com senha administrativa configurada, a rota `/install` é imediatamente travada e redireciona para `/admin`.
2. **Formulário de Instalação Multi-passos**:
   *   **Passo 1 (Supabase)**: Inserção da URL de banco do Supabase (`DATABASE_URL`).
   *   **Passo 2 (Google APIs)**: Inserção das chaves `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (exibindo a URL de redirecionamento que ele deve cadastrar no Google Developer Console).
   *   **Passo 3 (Administrador)**: Definição da Senha Mestra administrativa e inserção opcional do ID do Google Tag Manager (GTM).
3. **Execução em Tempo Real**: O assistente grava o `.env` localmente, valida a conexão, aplica a migração Prisma (`prisma db push`) e semeia os dados iniciais (`prisma db seed`).

---

## Alterações Propostas

### 1. Novo Módulo: Wizard de Instalação

#### [NEW] [src/app/install/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/page.tsx)
- Rota de entrada que detecta o estado de inicialização no cliente e redireciona o usuário para `/install/start` ou para o Painel Admin `/admin`.

#### [NEW] [src/app/install/start/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/start/page.tsx)
- Interface de boas-vindas do instalador com Vanilla CSS prático e funcional. Explica os requisitos necessários e dá início ao processo.

#### [NEW] [src/app/install/wizard/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/wizard/page.tsx)
- O formulário interativo de passos com feedback visual em tempo real para conectar o banco, configurar a Google Calendar API, a senha administrativa e rodar a criação das tabelas.

---

### 2. Versionamento & GitHub
- Commit completo de todas as alterações (landing page de luxo, admin dashboard, google APIs, e o novo instalador `/install`).
- Configuração do Git remoto com a URL fornecida: `https://github.com/felipebarbosavasconcelos13-coder/app_barber`.
- Push inicial para o repositório no GitHub do usuário.

---

## Plano de Verificação

1.  **Testes do Instalador Web**:
    - Abrir o app localmente desconfigurado (ou com banco vazio) e garantir que a rota `/install` seja exibida perfeitamente.
    - Fornecer credenciais de teste, concluir o instalador e verificar se o arquivo `.env` local é gerado/atualizado e se as tabelas foram devidamente populadas.
    - Acessar `/install` novamente após a conclusão e verificar se o redirecionamento automático de segurança para `/admin` é executado instantaneamente.
2.  **Build de Produção local**:
    - Executar `npm run build` para validar se todo o código TypeScript e rotas do Next.js compilam perfeitamente sem falhas.
