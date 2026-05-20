# Diário de Bordo & Histórico de Desenvolvimento

Este arquivo registra a evolução cronológica, decisões arquiteturais, correções de bugs e o status de desenvolvimento do aplicativo de agendamento online de barbearia. Ele serve de base de acompanhamento contínuo e histórico técnico do projeto.

---

## 📅 Linha do Tempo e Progresso do Projeto

```mermaid
gantt
    title Histórico de Desenvolvimento
    dateFormat  YYYY-MM-DD
    section Backend & DB
    Fase 1: Setup e SQLite/Prisma           :done,    des1, 2026-05-18, 2026-05-19
    Fase 2: Google OAuth2 & APIs            :done,    des2, 2026-05-19, 2026-05-19
    section Frontend & Design
    Fase 3: Admin Dashboard                 :done,    des3, 2026-05-19, 2026-05-20
    Fase 4: Landing Page & GTM Flow         :done,    des4, 2026-05-20, 2026-05-20
    Fase 5: Design System Vanilla CSS       :done,    des5, 2026-05-20, 2026-05-20
    section Finalização
    Fase 6: Validação de Build & Guias      :done,    des6, 2026-05-20, 2026-05-20
    Fase 7: Wizard de Instalação (/install)  :done,    des7, 2026-05-20, 2026-05-20
    Fase 8: Migração Supabase & GitHub      :done,    des8, 2026-05-20, 2026-05-20
```

---

## 🛠️ Detalhes das Fases Concluídas

### **Fase 1: Setup do Projeto e Estrutura de Dados (Concluída em 19/05/2026)**
- Inicializado o aplicativo utilizando **Next.js 16 (com App Router e TypeScript)** em modo livre de Tailwind.
- Configurada a persistência local com **Prisma v7 e SQLite**.
- Modeladas as tabelas:
  - `SystemSettings`: Controla horários globais da barbearia, senha mestra e ID do Google Tag Manager.
  - `Barber`: Armazena dados dos profissionais e chaves de autorização OAuth do Google Calendar.
  - `Service`: Cadastra serviços (ex: corte de cabelo, barba) com preço BRL e tempo em minutos.
  - `Booking`: Associa os agendamentos salvando nome, e-mail, telefone do cliente, data, barbeiro, serviço e ID do Google.
- Desenvolvido o script de seed inicial populando expediente (09:00 às 19:00), senha admin padrão (`admin123`) e 4 serviços padrão.

### **Fase 2: Integração com Google Calendar API (Concluída em 19/05/2026)**
- Criada a camada de integração em `src/lib/google.ts`.
- Desenvolvidas as rotas de callback OAuth2 (`/api/auth/google` e `/api/auth/google/callback`) para que os barbeiros façam login de forma isolada com suas contas do Google de forma offline (salvando o `refresh_token` de segurança).

### **Fase 3: Área Administrativa do Barbeiro (`/admin`) (Concluída em 20/05/2026)**
- Criada tela de login protegida por cookie HttpOnly de sessão.
- Desenvolvida a área administrativa SPA em Dark Mode dividida por abas interativas:
  - **Agendamentos**: Listagem de reservas efetuadas localmente.
  - **Barbeiros**: Gerenciamento de profissionais e botão de consentimento OAuth do Google de cada um.
  - **Serviços**: CRUD completo de serviços de beleza.
  - **Configurações**: Cadastro do GTM, horários da loja e troca da senha mestra.

### **Fase 4: Landing Page & Fluxo do Cliente (Concluída em 20/05/2026)**
- Criada a Landing Page pública de luxo com layout de alta fidelidade responsivo.
- Construído o componente interativo de agendamento em passos guiados (`BookingFlow.tsx`):
  - *Passo 1*: Escolha do Barbeiro.
  - *Passo 2*: Escolha do Serviço.
  - *Passo 3*: Escolha de Data e Horário (calculado cruzando o expediente da barbearia com os compromissos em tempo real da API do Google Calendar do profissional selecionado).
  - *Passo 4*: Cadastro dos dados do cliente (Nome, E-mail, Telefone).
- **Integração GTM**: Ao confirmar o agendamento com sucesso, o app dispara um evento de conversão `bookings` no `window.dataLayer` com os dados da reserva (valor do serviço e barbeiro) para otimização em campanhas do Meta Ads e Google Ads.

### **Fase 5: Estilização de Luxo Vanilla CSS (Concluída em 20/05/2026)**
- Desenvolvido o arquivo `src/app/globals.css` atuando como Design System Vanilla CSS Premium unificado:
  - Paleta baseada em tons escuros (carvão/preto profundo), acentos dourados/bronze e off-white.
  - Efeitos de glassmorphism refinado, sombras 3D e micro-animações responsivas perfeitas para celulares.

### **Fase 6: Validação de Compilação & Guias (Concluída em 20/05/2026)**
- **Resolução de Erros de Build**:
  - *styled-jsx no Servidor*: Corrigido o erro do Turbopack em `src/app/page.tsx` movendo estilos estáticos da home page para o global `globals.css`, permitindo que a home page execute como Server Component ultraveloz.
  - *Tipagem Implícita*: Adicionadas tipagens explícitas às variáveis de retorno do Prisma no HomePage.
- **Validação de Sucesso**: Executado o comando `npm run build` local, gerando a compilação de produção com 100% de integridade e sem falhas.
- **Configurações de Apoio**: Criados o modelo de variáveis de ambiente `.env.example` e o manual passo a passo de APIs [GUIA_GOOGLE_CLOUD.md](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/GUIA_GOOGLE_CLOUD.md).

---

## 🚀 Fase Atual: Projeto Concluído e Enviado ao GitHub (20/05/2026)

### **Ações Realizadas**
1. **Wizard de Instalação Web (`/install`)** ✅:
   - Interface visual de 4 passos de alta fidelidade implementada (Banco Supabase, Google Cloud APIs, Cadastro Administrativo, Execução).
   - Rotas de checagem (`/api/install/check`) e execução (`/api/install/run`) criadas para gravar `.env`, validar conexões de banco e rodar migração e seed do Prisma.
2. **Migração do Banco de Dados para Supabase (PostgreSQL)** ✅:
   - `provider` no `schema.prisma` alterado de `"sqlite"` para `"postgresql"`.
   - Removido o adapter `@prisma/adapter-libsql` do `prisma/seed.js` (era incompatível com PostgreSQL).
   - Instalado o adapter oficial `@prisma/adapter-pg` + `pg` para compatibilidade com Prisma v7.
   - Adicionado `engineType = "library"` ao generator do Prisma Client no schema.
3. **Validação de Build** ✅:
   - Executado `npm run build` com sucesso (39.4s compile, 28.1s TypeScript).
   - Erros de Prisma durante o build são capturados pelo try/catch no layout (DATABASE_URL placeholder).
4. **Versionamento e Envio ao GitHub** ✅:
   - Commit estruturado com 39 arquivos, 7392 inserções, 175 exclusões.
   - Push completo para o repositório GitHub: `https://github.com/felipebarbosavasconcelos13-coder/app_barber`.

---

## 📝 Histórico de Correções Técnicas (Bugfix Log)

| Data | Componente | Descrição do Problema | Solução Aplicada |
| :--- | :--- | :--- | :--- |
| **20/05/2026** | `src/app/page.tsx` | Erro do Turbopack:styled-jsx não pode ser importado de Server Components. | Movidos os estilos estáticos da Home para `src/app/globals.css` e removida a tag `<style jsx>` do componente. |
| **20/05/2026** | `src/app/page.tsx` | Falha de checagem TypeScript: variáveis `barbers` e `services` com tipo implícito `any[]`. | Inseridas tipagens estritas explícitas nas definições das duas variáveis na renderização da HomePage. |
| **20/05/2026** | `prisma/seed.js` | `@prisma/adapter-libsql` (SQLite/Turso) causaria falha no seed com PostgreSQL no Supabase. | Removido o adapter LibSQL e substituído por `PrismaClient` nativo com `engineType = "library"`. |
| **20/05/2026** | `prisma/schema.prisma` | Prisma v7 exige `adapter` ou `accelerateUrl` no construtor do PrismaClient com engine `client` padrão. | Instalado `@prisma/adapter-pg` + `pg` e atualizado `src/lib/prisma.ts` para usar o adapter PostgreSQL. Adicionado `engineType = "library"` ao generator. |
| **20/05/2026** | `.gitignore` | Padrão `.env*` ignorava o arquivo de template `.env.example` e o `dev.db` (SQLite legado) não era ignorado. | Substituído `.env*` por `.env`, `.env.local`, `.env.*.local` e adicionado `dev.db`. |
