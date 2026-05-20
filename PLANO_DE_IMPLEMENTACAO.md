# Plano de Implementacao: Wizard de Instalacao Web & Migracao para o Supabase

Este documento apresenta o plano de acao detalhado para criar um **Wizard de Instalacao na Web (`/install`)** para o aplicativo de agendamento online de barbearia, unindo-o a migracao para o **Supabase (PostgreSQL)** e ao versionamento completo no **GitHub**.

**Regra operacional:** apos cada alteracao no projeto, atualizar este `PLANO_DE_IMPLEMENTACAO.md` e o `LOG_DESENVOLVIMENTO.md` antes de finalizar a tarefa.

---

## Detalhes do Novo Recurso: Wizard de Instalacao (`/install`)

Inspirado no instalador do CRM de referencia, desenvolvemos um assistente visual automatizado que permite a configuracao da base de dados diretamente no navegador Web na primeira inicializacao da aplicacao, sem exigir que o usuario final configure arquivos ou execute comandos de terminal manualmente.

Conforme solicitado, **o instalador sera pratico e funcional**, focado em simplicidade, clareza e feedback visual em tempo real do progresso das tarefas de banco de dados (schema e seed via SQL direto).

### Fluxo de Funcionamento
1. **Verificacao de Inicializacao**: A aplicacao consulta o banco. Se a tabela `SystemSettings` ja estiver devidamente populada e com senha administrativa configurada, a rota `/install` e imediatamente travada e redireciona para `/admin`.
2. **Redirecionamento Automatico**: As rotas `/` (Home) e `/admin` verificam se o banco esta configurado. Se nao, redirecionam para `/install`.
3. **Formulario de Instalacao Multi-passos** (3 passos):
   *   **Passo 1 (Conexao)**: 
       - Token da Vercel (Full Account) com botao "Buscar" que valida e lista projetos.
       - Seletor de projeto Vercel (auto-detectado em dominios `.vercel.app`).
       - Supabase Access Token (PAT) com busca automatica que valida, lista organizacoes e usa fallback de projetos diretos quando nenhuma organizacao e retornada.
   *   **Passo 2 (Setup)**:
       - Selecao/Criacao de projeto Supabase. **Se selecionado um projeto existente, e exibido um campo seguro para digitar a senha mestre do banco (postgres).** Se for criar um projeto novo, a senha do novo banco e informada.
       - Senha Mestra administrativa do Painel e ID do Google Tag Manager (GTM, opcional).
   *   **Passo 3 (Execucao)**: 
       - Resolve DATABASE_URL via Supabase API. **Se a senha do banco for fornecida (projeto existente ou criado dinamicamente), o sistema monta a string de conexao usando o usuario mestre `postgres.[projectRef]` (para o Pooler Regional) e a senha real, contornando falhas do Pooler com roles temporarias de CLI.** Caso contrario, usa o fluxo legado de CLI login role.
       - Configura env vars na Vercel via API (`upsertProjectEnvs`): `DATABASE_URL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL`.
       - Aplica schema e semeia dados iniciais via API usando SQL direto (`pg`), sem depender de Prisma CLI no runtime da Vercel. As variaveis na Vercel sao salvas apenas depois que a conexao do banco e validada.
       - Dispara redeploy de producao na Vercel e aguarda o deployment ficar `READY`, garantindo que `/admin` execute com a nova `DATABASE_URL` antes de exibir sucesso.
       - **Ajuste Robusto de SSL:** Para evitar erros de certificados autoassinados (`self-signed certificate in certificate chain`) em proxies locais ou restrições da cadeia de conexão do pooler regional da Supabase, a rota POST do instalador desativa temporariamente a verificação TLS rígida (`NODE_TLS_REJECT_UNAUTHORIZED = "0"`) e a restaura perfeitamente no bloco `finally`.
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
- **[UPDATED] `src/app/api/install/run/route.ts`**: Resolve DATABASE_URL via Supabase API, testa candidatos pooler/direto, aplica schema/seed via SQL direto e so entao seta env vars Vercel.
- **[NEW] `src/lib/installer/vercel.ts`**: `upsertProjectEnvs`, `listVercelProjects`, `validateVercelToken`.
- **[UPDATED] `src/lib/installer/vercel.ts`**: `triggerProjectRedeploy` e `waitForVercelDeploymentReady` para aplicar env vars no deployment ativo antes de liberar o painel.
- **[NEW] `src/lib/installer/supabase.ts`**: `resolveSupabaseDbUrl`, `listSupabaseProjects`, `extractProjectRefFromUrl`; a resolucao retorna candidatos de DATABASE_URL para pooler regional e conexao direta.

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

### 5. Resiliência contra Banco Supabase Pausado/Inativo [NEW]

- **[UPDATED] `src/app/api/install/run/route.ts`**: Intercepta falhas de rede (`ENOTFOUND`) e erros de pooler (`tenant/user ... not found`) gerados por projetos Supabase inativos, pausados ou deletados, e responde com orientações amigáveis de como restaurar o projeto no painel da Supabase.
- **[UPDATED] `src/app/install/wizard/page.tsx`**: Melhora a apresentação visual de falhas técnicas do banco, detectando se o erro envolve bancos pausados e orientando o usuário passo a passo com link para o dashboard do Supabase.

### 6. Diagnóstico Aprimorado do Connection Pooler Supabase [NEW]

- **[UPDATED] `src/app/api/install/run/route.ts`**: Atualiza a lógica de detecção de erros de pooler. Além do banco pausado, trata explicitamente o caso de projetos ativos mas com **Connection Pooler desativado** ou em **processo de propagação/sincronização regional**.
- **[UPDATED] `src/app/install/wizard/page.tsx`**: Exibe no card de erro instruções guiadas sobre como acessar as configurações de banco (Database Settings) no painel da Supabase, verificar o estado do Connection Pooler, ativá-lo ou aguardar alguns minutos caso o projeto seja muito recente.

### 7. Resolução Dinâmica do Host do Pooler via API Supabase [NEW] — CAUSA RAIZ

- **[UPDATED] `src/lib/installer/supabase.ts`**: **CAUSA RAIZ ENCONTRADA E CORRIGIDA.** O host do Connection Pooler era montado manualmente como `aws-0-{region}.pooler.supabase.com`, mas o cluster real varia por projeto (ex: `aws-1-sa-east-1.pooler.supabase.com`). Agora o sistema consulta a API `GET /v1/projects/:ref/config/database/pooler` para obter o host exato, a porta e o usuário do pooler dinamicamente. Fallback para `aws-0` apenas se a API não retornar dados.
- **[NEW] `scripts/diagnose-supabase.mjs`**: Script de diagnóstico que consulta a Supabase Management API para verificar status do projeto, health check, configuração do pooler e testa conectividade TCP nas portas 5432 e 6543.

---

## Plano de Verificacao

1. **Testes do Instalador Web**:
   - Abrir o app localmente e garantir que a rota `/install` seja exibida.
   - Fornecer credenciais de teste, concluir o instalador e verificar se o `.env` e gerado e as tabelas populadas via SQL direto.
   - Acessar `/install` apos conclusao e verificar redirecionamento para `/admin`.
   - **Caso de Teste - Banco Pausado / Pooler Inativo**: Simular a conexão com um banco pausado ou com pooler inativo e validar se a mensagem didática refinada e os links são renderizados de forma perfeita na tela.

2. **Testes do Sistema de Agendamento**:
   - Cadastrar barbeiro com horarios customizados.
   - Verificar se os slots disponiveis respeitam os horarios do barbeiro.
   - Criar agendamento e verificar se o slot fica indisponivel.

3. **Build de Producao**:
   - Executar `npm run build` para validar compilacao TypeScript e rotas Next.js.
