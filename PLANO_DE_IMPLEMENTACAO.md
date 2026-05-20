# Plano de Implementacao: Wizard de Instalacao Web & Migracao para o Supabase

Este documento apresenta o plano de acao detalhado para criar um **Wizard de Instalacao na Web (`/install`)** para o aplicativo de agendamento online de barbearia, unindo-o a migracao para o **Supabase (PostgreSQL)** e ao versionamento completo no **GitHub**.

---

## Detalhes do Novo Recurso: Wizard de Instalacao (`/install`)

Inspirado no instalador do CRM de referencia, desenvolvemos um assistente visual automatizado que permite a configuracao da base de dados diretamente no navegador Web na primeira inicializacao da aplicacao, sem exigir que o usuario final configure arquivos ou execute comandos de terminal manualmente.

Conforme solicitado, **o instalador sera pratico e funcional**, focado em simplicidade, clareza e feedback visual em tempo real do progresso das tarefas de banco de dados (push e seed do Prisma).

### Fluxo de Funcionamento
1. **Verificacao de Inicializacao**: A aplicacao consulta o banco. Se a tabela `SystemSettings` ja estiver devidamente populada e com senha administrativa configurada, a rota `/install` e imediatamente travada e redireciona para `/admin`.
2. **Redirecionamento Automatico**: As rotas `/` (Home) e `/admin` verificam se o banco esta configurado. Se nao, redirecionam para `/install`.
3. **Formulario de Instalacao Multi-passos** (3 passos):
   *   **Passo 1 (Conexao)**: 
       - Token da Vercel (Full Account) com botao "Buscar" que valida e lista projetos.
       - Seletor de projeto Vercel (auto-detectado em dominios `.vercel.app`).
       - Supabase Access Token (PAT) com botao "Buscar" que valida e lista projetos.
       - URL do projeto Supabase (auto-preenchida ao selecionar projeto).
       - **DATABASE_URL e resolvida automaticamente** via Supabase Management API — usuario nao precisa colar connection string.
   *   **Passo 2 (Administrador)**: Senha Mestra administrativa e ID do Google Tag Manager (GTM, opcional).
   *   **Passo 3 (Execucao)**: 
       - Resolve DATABASE_URL via Supabase API (`/v1/projects/{ref}/cli/login-role`).
       - Configura env vars na Vercel via API (`upsertProjectEnvs`): `DATABASE_URL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL`.
       - Aplica migracao Prisma (`prisma db push`) e semeia dados iniciais (`prisma db seed`).
       - Feedback visual em tempo real com logs de cada etapa.

---

## Arquitetura do Sistema de Agendamento

### Modelo de Calendario Proprio (Sem Dependencia do Google)

Cada barbeiro possui seus proprios horarios de atendimento definidos no cadastro:
- **`openingTime`**: Horario de entrada do barbeiro (ex: "09:00")
- **`closingTime`**: Horario de saida do barbeiro (ex: "19:00")

O sistema calcula automaticamente os slots disponiveis com base nos horarios do barbeiro, cruzando com os agendamentos locais existentes. Nao ha dependencia de APIs externas (Google Calendar).

---

## Estrutura de Dados (Schema Prisma - PostgreSQL)

```prisma
model SystemSettings {
  id            String   @id @default("default")
  gtmId         String?
  openingTime   String   @default("09:00")
  closingTime   String   @default("19:00")
  adminPassword String   @default("admin123")
  updatedAt     DateTime @updatedAt
}

model Barber {
  id          String    @id @default(uuid())
  name        String
  email       String    @unique
  openingTime String    @default("09:00")
  closingTime String    @default("19:00")
  services    Service[] @relation("BarberServices")
  bookings    Booking[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Service {
  id        String   @id @default(uuid())
  name      String
  price     Float
  duration  Int
  barbers   Barber[] @relation("BarberServices")
  bookings  Booking[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Booking {
  id          String   @id @default(uuid())
  clientName  String
  clientEmail String
  clientPhone String
  dateTime    DateTime
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  barberId    String
  barber      Barber   @relation(fields: [barberId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Alteracoes Propostas

### 1. Novo Modulo: Wizard de Instalacao (3 passos com integracao total)

- **[NEW] `src/app/install/page.tsx`**: Rota de entrada que detecta o estado de inicializacao e redireciona.
- **[NEW] `src/app/install/start/page.tsx`**: Interface de boas-vindas com pre-requisitos.
- **[UPDATED] `src/app/install/wizard/page.tsx`**: Wizard com busca de projetos Vercel + Supabase. DATABASE_URL resolvida automaticamente.
- **[NEW] `src/app/api/install/vercel/projects/route.ts`**: API que valida token Vercel e retorna projetos.
- **[NEW] `src/app/api/install/supabase/projects/route.ts`**: API que valida token Supabase e retorna projetos.
- **[UPDATED] `src/app/api/install/run/route.ts`**: Resolve DATABASE_URL via Supabase API + seta env vars Vercel + prisma push/seed.
- **[NEW] `src/lib/installer/vercel.ts`**: `upsertProjectEnvs`, `listVercelProjects`, `validateVercelToken`.
- **[NEW] `src/lib/installer/supabase.ts`**: `resolveSupabaseDbUrl`, `listSupabaseProjects`, `extractProjectRefFromUrl`.

### 2. Redirecionamento Automatico

- **[UPDATED] `src/app/page.tsx`**: Verifica `SystemSettings`; se falhar, `redirect("/install")`.
- **[UPDATED] `src/app/admin/page.tsx`**: Verifica `SystemSettings`; se falhar, `redirect("/install")`.

### 3. Sistema de Calendario Proprio

- **[UPDATED] `src/lib/schedule.ts`**: Logica de calculo de slots disponiveis baseada nos horarios do barbeiro e agendamentos locais (sem Google Calendar).
- **[UPDATED] `src/app/api/booking/available-slots/route.ts`**: Usa `getBarberAvailableSlots` com os horarios customizados do barbeiro.
- **[UPDATED] `src/app/api/booking/create/route.ts`**: Cria agendamento local sem integracao com Google Calendar.
- **[UPDATED] `src/app/api/admin/barbers/route.ts`**: Inclui `openingTime` e `closingTime` no cadastro e listagem de barbeiros.
- **[UPDATED] `src/components/AdminDashboard.tsx`**: Formulario de barbeiro com campos de horario de entrada/saida.
- **[UPDATED] `src/components/BookingFlow.tsx`**: Exibe horarios do barbeiro em vez de status de conexao Google.

### 3. Remocao da Dependencia Google Calendar

- As APIs de Google OAuth (`/api/auth/google`) permanecem no codigo mas nao sao mais referenciadas pelo fluxo principal.
- Os pacotes `googleapis` e `google-auth-library` permanecem instalados para compatibilidade futura opcional.

### 4. Versionamento & GitHub

- Repositorio: `https://github.com/felipebarbosavasconcelos13-coder/app_barber`
- Commits estruturados com todas as alteracoes.

---

## Plano de Verificacao

1. **Testes do Instalador Web**:
   - Abrir o app localmente e garantir que a rota `/install` seja exibida.
   - Fornecer credenciais de teste, concluir o instalador e verificar se o `.env` e gerado e as tabelas populadas.
   - Acessar `/install` apos conclusao e verificar redirecionamento para `/admin`.

2. **Testes do Sistema de Agendamento**:
   - Cadastrar barbeiro com horarios customizados.
   - Verificar se os slots disponiveis respeitam os horarios do barbeiro.
   - Criar agendamento e verificar se o slot fica indisponivel.

3. **Build de Producao**:
   - Executar `npm run build` para validar compilacao TypeScript e rotas Next.js.
