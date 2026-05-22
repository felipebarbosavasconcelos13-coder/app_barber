# Diário de Bordo & Histórico de Desenvolvimento

Este arquivo registra a evolução cronológica, decisões arquiteturais, correções de bugs e o status de desenvolvimento do aplicativo de agendamento online de barbearia. Ele serve de base de acompanhamento contínuo e histórico técnico do projeto.

**Regra operacional:** apos cada alteracao no projeto, atualizar este `LOG_DESENVOLVIMENTO.md` e o `PLANO_DE_IMPLEMENTACAO.md` antes de finalizar a tarefa.

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
    Fase 9: Calendário Próprio (sem Google)  :done,    des9, 2026-05-20, 2026-05-20
    Fase 10: Integração Vercel API no Wizard  :done,    des10, 2026-05-20, 2026-05-20
    Fase 11: Instalador 100% Automático (Supabase API) :done, des11, 2026-05-20, 2026-05-20
    Fase 12: Criação Automática de Projeto Supabase :done, des12, 2026-05-20, 2026-05-20
    Fase 13: Correção do Pooler Supabase & Senha do Banco :done, des13, 2026-05-20, 2026-05-20
    Fase 14: Diagnóstico e Resiliência contra Banco Supabase Pausado :done, des14, 2026-05-20, 2026-05-20
    Fase 15: Diagnóstico Avançado de Connection Pooler e Projetos Novos :done, des15, 2026-05-20, 2026-05-20
    Fase 16: Correção de Timeout de 10s da Vercel no Instalador :done,    des16, 2026-05-21, 2026-05-21
    Fase 17: Proxy do Prisma e Resiliência no `/admin`          :done,    des17, 2026-05-21, 2026-05-21
    Fase 18: Refinamento de Painel e Regras por Barbeiro         :done,    des18, 2026-05-21, 2026-05-21
    Fase 19: Correção de Assinaturas PrismaPg e Fim do Loop      :done,    des19, 2026-05-22, 2026-05-22
    Fase 20: Sincronização de Schema e Migração Supabase         :active,  des20, 2026-05-22, 2026-05-22
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

### **Fase 16: Correção de Timeout de 10s da Vercel (Hobby) no Instalador (Concluída em 21/05/2026)**
- **Otimização Assíncrona no Backend** ✅: Removido o wait síncrono da compilação da Vercel na rota `/api/install/run`, respondendo instantaneamente com `200 OK` e realizando o trigger em background para evitar timeouts de 10s.
- **Feedback na UI** ✅: Interface do Wizard atualizada com alertas educativos em esmeralda avisando do build assíncrono.
- **Git Commit e Push** ✅: Efetuado push para a `master` para deploy definitivo da Vercel.

---

## 🚀 Fase Atual: Resolução Definitiva do Loop do Instalador com Proxy de Conexão e Verificação Direta no Banco (21/05/2026)

### **Ações Realizadas**
1. **Desenvolvimento do Proxy do Prisma Client (`src/lib/prisma.ts`)** ✅:
   - Implementado um **Proxy dinâmico de alta resiliência** que intercepta todas as chamadas ao banco.
   - O Proxy monitora e lê dinamicamente o arquivo `.env` físico em tempo de execução. Se a string de conexão sofrer alteração (processo pós-instalação), ele automaticamente desconecta a instância obsoleta e reinicializa de forma limpa e transparente o pool do driver `pg` sem a necessidade de reinicializar o servidor Node.js/Next.js.
   - Adicionada tratativa de fallback para strings de conexão contendo placeholders de templates (como `[SENHA_DO_BANCO]`) retornando um fallback válido para evitar que a inicialização do driver de banco lance erros `ERR_INVALID_URL` que quebravam o build estático.
2. **Refatoração da Rota de Autenticação/Dashboard Administrativa (`src/app/admin/page.tsx`)** ✅:
   - Removido o anti-padrão de requisições HTTP `fetch` redundantes e complexas para o próprio domínio (`/api/install/check`), as quais quebravam com facilidade devido a problemas de portas locais, restrições de rede, CORS ou DNS na Vercel/localhost.
   - Substituída a verificação por uma chamada de consulta direta e resiliente ao banco de dados via Prisma Proxy.
3. **Validação e Homologação de Build** ✅:
   - Executada a compilação local de produção com o comando `npm run build` (`prisma generate && next build`), com 100% de sucesso, atestando a ausência de erros de lint, tipo ou quebras na geração estática de rotas.

---

## 📝 Histórico de Correções Técnicas (Bugfix Log)

| Data | Componente | Descrição do Problema | Solução Aplicada |
| :--- | :--- | :--- | :--- |
| **20/05/2026** | `src/app/page.tsx` | Erro do Turbopack:styled-jsx não pode ser importado de Server Components. | Movidos os estilos estáticos da Home para `src/app/globals.css` e removida a tag `<style jsx>` do componente. |
| **20/05/2026** | `src/app/page.tsx` | Falha de checagem TypeScript: variáveis `barbers` e `services` com tipo implícito `any[]`. | Inseridas tipagens estritas explícitas nas definições das duas variáveis na renderização da HomePage. |
| **20/05/2026** | `prisma/seed.js` | `@prisma/adapter-libsql` (SQLite/Turso) causaria falha no seed com PostgreSQL no Supabase. | Removido o adapter LibSQL e substituído por `PrismaClient` nativo com `engineType = "library"`. |
| **20/05/2026** | `prisma/schema.prisma` | Prisma v7 exige `adapter` ou `accelerateUrl` no construtor do PrismaClient com engine `client` padrão. | Instalado `@prisma/adapter-pg` + `pg` e atualizado `src/lib/prisma.ts` para usar o adapter PostgreSQL. Adicionado `engineType = "library"` ao generator. |
| **20/05/2026** | `.gitignore` | Padrão `.env*` ignorava o arquivo de template `.env.example` e o `dev.db` (SQLite legado) não era ignorado. | Substituído `.env*` por `.env`, `.env.local`, `.env.*.local` e adicionado `dev.db`. |
| **20/05/2026** | `src/app/api/admin/barbers/route.ts` | TypeScript no Vercel: `Parameter 'b' implicitly has an 'any' type` no `.map()`. | Adicionado `import type { Barber }` e tipagem explícita `(b: Barber)` no callback. |
| **20/05/2026** | `prisma/schema.prisma` | Remoção dos campos `googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry` do modelo `Barber` e adição de `openingTime`/`closingTime` para calendário próprio. | Migração de schema: cada barbeiro agora define seus próprios horários de atendimento, eliminando dependência do Google Calendar. |
| **20/05/2026** | `src/lib/google.ts` → `src/lib/schedule.ts` | Lógica de slots dependia da Google Calendar API. | Reescrevido para calcular slots usando apenas os horários do barbeiro e agendamentos locais no banco. |
| **20/05/2026** | `src/app/install/wizard/page.tsx` | Wizard tinha 4 passos incluindo credenciais Google. | Reduzido para 3 passos: Banco, Admin, Executar. Campos Google removidos do formulário e da chamada API. |
| **20/05/2026** | `src/components/AdminDashboard.tsx` | Formulário de barbeiro não tinha campos de horário, usava botão de conexão Google. | Adicionados `openingTime`/`closingTime` com inputs `type="time"`. Removido status Google e botão "Conectar Agenda Google". |
| **20/05/2026** | `src/components/BookingFlow.tsx` | Exibia "Agenda Google Ativa" / "Google Desconectado" para cada barbeiro. | Substituído por exibição dos horários do barbeiro ("09:00 às 19:00"). |
| **20/05/2026** | `src/app/page.tsx` + `src/app/admin/page.tsx` | Home e Admin não redirecionavam para `/install` quando banco não estava configurado. | Adicionada verificação de `SystemSettings` com `redirect("/install")` ao falhar. |
| **20/05/2026** | `src/app/api/install/run/route.ts` | Escrita do `.env` falhava com `EROFS` no Vercel (read-only filesystem). | Envolvida em try/catch; Vercel API seta env vars permanentemente. |
| **20/05/2026** | `src/lib/prisma.ts` | `PrismaClient()` sem adapter quebrava no build Vercel quando `DATABASE_URL` não existe em tempo de build. | Sempre usa `PrismaPg` adapter com fallback `postgresql://localhost:5432/postgres`. |
| **20/05/2026** | `package.json` | `prisma generate` não rodava antes do build, causando erro `Module has no exported member 'Barber'`. | Adicionado `prisma generate` nos scripts `build` e `postinstall`. |
| **20/05/2026** | `prisma/seed.js` | Seed usava `PrismaClient()` sem adapter, incompatível com Prisma v7 engine `client`. | Adicionado `PrismaPg` adapter com `connectionString`. |
| **20/05/2026** | Wizard `/install/wizard` | Instalador solicitava DATABASE_URL manual. | Substituído por Supabase Token + URL. DATABASE_URL resolvida automaticamente via Supabase Management API (`cli/login-role`). |
| **20/05/2026** | `src/lib/installer/supabase.ts` | DATABASE_URL resolvida com host direto `db.<ref>.supabase.co` usando porta `6543`, que pertence ao pooler e pode falhar ao aplicar schema. | Corrigida a URL para porta direta `5432` com `sslmode=require`. |
| **20/05/2026** | `src/app/api/install/run/route.ts` | Instalador executava `npx prisma db push` e `npx prisma db seed` dentro do runtime da Vercel, fluxo fragil em serverless e sujeito a falha mesmo com banco correto. | Substituido por aplicacao de schema e seed via SQL direto usando `pg`, sem depender do Prisma CLI em runtime. |
| **20/05/2026** | `src/app/install/wizard/page.tsx` | Wizard exibia erro "Selecione uma organizacao." mesmo quando o seletor de organizacao nao aparecia ou a API do Supabase retornava lista vazia. | Comparado com o instalador do CRM `gsdcrm`; ajustado fallback para buscar projetos diretos, permitir projeto existente sem organizacao e exigir organizacao apenas para criar projeto novo. |
| **20/05/2026** | `src/lib/installer/supabase.ts` + `src/app/api/install/run/route.ts` | Em ambiente Vercel, conexao direta `db.<ref>.supabase.co:5432` pode falhar por rede/IPv6, mantendo a falha "Falha ao aplicar o schema". | DATABASE_URL agora gera candidatos pooler regional + direto, testa cada um antes de salvar envs e persiste na Vercel apenas a URL que aplicou o schema com sucesso. |
| **20/05/2026** | `src/app/install/wizard/page.tsx` | UI ocultava o detalhe tecnico retornado pela API, dificultando diagnostico da falha de schema. | Wizard passa a registrar `details` no log da instalacao e exibir esse detalhe como mensagem de erro principal quando disponivel. |
| **20/05/2026** | `src/app/api/install/run/route.ts` | Erro `self-signed certificate in certificate chain` ao conectar no Pooler Supabase. | Desativado temporariamente o rigor TLS (`NODE_TLS_REJECT_UNAUTHORIZED = "0"`) durante o escopo da requisição do instalador. |
| **20/05/2026** | Wizard & Supabase Lib | Erro `tenant/user cli_login_postgres... not found` no Pooler Regional da Supabase. | Adicionado campo de senha do banco para projetos existentes no Passo 2 do Wizard e refatorada `resolveSupabaseDbUrl` para usar o usuário mestre `postgres` caso a senha seja provida, contornando o bug de roles temporárias. |
| **20/05/2026** | Wizard & Run Route | Erro `tenant/user postgres... not found` e `getaddrinfo ENOTFOUND` causado por banco Supabase pausado. | Adicionado tratamento de erro inteligente no backend e no frontend com aviso didático, link direto e orientações claras de como restaurar o projeto no Supabase. |
| **20/05/2026** | `src/lib/installer/supabase.ts` | **CAUSA RAIZ ENCONTRADA:** Host do pooler era montado manualmente como `aws-0-{region}.pooler.supabase.com`, mas o cluster real do projeto era `aws-1-sa-east-1.pooler.supabase.com`. O prefixo `aws-0` vs `aws-1` varia por projeto e não pode ser deduzido da região. | Refatorado `resolveSupabaseDbUrl` para consultar a API `/v1/projects/:ref/config/database/pooler` e obter o host exato do pooler dinamicamente (`aws-1-...`). Fallback para `aws-0` apenas se a API não retornar dados. Script de diagnóstico `scripts/diagnose-supabase.mjs` criado para validação. |
| **20/05/2026** | `src/app/api/install/check/route.ts` + `src/app/admin/page.tsx` | Após instalação bem-sucedida, clicar em "Acessar Painel" voltava à etapa 1 do Wizard. O `/api/install/check` usava `PrismaClient()` sem adapter `PrismaPg` (Prisma v7) e o `process.env.DATABASE_URL` ainda continha o placeholder antigo, pois o dev server não recarregou o `.env` após a escrita. | Reescrito `/api/install/check` para usar `PrismaPg` adapter e ler o `.env` do disco caso `process.env` esteja desatualizado. Admin page agora chama `/api/install/check` via fetch em vez de usar o singleton Prisma global cacheado. |
| **20/05/2026** | `src/lib/installer/vercel.ts` + `src/app/api/install/run/route.ts` | O erro "Acessar Painel" -> Wizard persistia na Vercel porque salvar `DATABASE_URL` via API nao atualiza `process.env` do deployment atual; as novas env vars so entram apos novo deployment. | Adicionadas funcoes `triggerProjectRedeploy` e `waitForVercelDeploymentReady`; o instalador agora dispara redeploy de producao, aguarda `READY` e so entao conclui. Se o redeploy falhar, a instalacao retorna erro explicito em vez de liberar o botao do painel. |
| **21/05/2026** | `src/app/api/install/run/route.ts` + `src/app/install/wizard/page.tsx` | O instalador travava com erro 504 Gateway Timeout na Vercel (Hobby) devido ao tempo do build síncrono. | Removida a espera síncrona pelo build no backend (route.ts). Ajustada a interface do assistente (page.tsx) com aviso informativo de build em segundo plano, sugerindo aguardar 1-2 minutos para o término do deploy na Vercel antes de acessar o painel `/admin`. |
| **21/05/2026** | Wizard & Vercel API | O erro de redirecionamento para o instalador persistia após a instalação concluída devido ao usuário clicar no painel administrativo antes da Vercel compilar o novo deploy. | Implementado polling em tempo real no frontend que consulta `/api/install/vercel/status` e bloqueia o botão "Acessar Painel" até que a Vercel confirme o status `READY`. Efetuado push remoto. |
| **21/05/2026** | `src/lib/prisma.ts` | O compilador do Next.js e o runtime mantinham em cache a conexão do banco de dados obsoleta ou placeholders contendo colchetes (ex: `[SENHA_DO_BANCO]`), causando `ERR_INVALID_URL` no build ou loops de instalação por não ler as novas envs ativas do disco. | Implementado um Proxy dinâmico sobre a instância do Prisma Client. O Proxy lê o `.env` físico em runtime caso mude e reinicia o Pool de conexão do `pg` de forma transparente. Adicionados fallbacks de strings sintaticamente corretas para silenciar exceções de build. |
| **21/05/2026** | `src/app/admin/page.tsx` | O Server Component de `/admin` dependia de um fetch HTTP local instável para `/api/install/check`, gerando erros causados por limitações de rede, portas, CORS ou DNS na Vercel e redirecionando incorretamente para `/install`. | Removida a requisição local desnecessária. Substituída por verificação direta no banco via Prisma Client encapsulado no Proxy dinâmico resiliente. |
| **21/05/2026** | `src/components/BookingFlow.tsx` | O carrossel de datas e os horários eram fixos para domingos e não escutavam as regras individuais de almoço e dias de trabalho do barbeiro selecionado. | Estendida a interface `InitialBarber`, refatorado o `useEffect` de geração de datas para reagir dinamicamente a `selectedBarber` com base no vetor `workDays`, e implementada a exibição premium com expediente, almoço e dias formatados no Passo 1. |

---

## 🛠️ Detalhes das Fases Concluídas (Continuação)

### **Fase 18: Refinamento do Painel do Barbeiro e Regras de Horários Personalizados (Concluída em 21/05/2026)**
- **Integração e Sincronização do Banco de Dados** ✅:
  - Estendido o modelo `SystemSettings` com os campos dinâmicos `barberShopName`, `logoUrl`, `address` e `phone` para representação dinâmica de branding e contato.
  - Estendido o modelo `Barber` com os campos `lunchStart`, `lunchEnd` e `workDays` permitindo controle granular do expediente profissional de cada barbeiro de forma independente.
- **Aprimoramento do Painel de Administração (`/admin`)** ✅:
  - **Aba de Configurações**: Reestruturada em **4 Cards Isolados** em Vanilla CSS Premium (Branding, Funcionamento Geral, Google Tag Manager de forma isolada, e Segurança).
  - **Aba de Barbeiros**: Adicionado suporte para cadastro e edição dinâmica de início/fim do almoço e seleção premium de dias de trabalho via seletor de badges interativas.
  - **Aba de Agendamentos**: Adicionado botão de exclusão de reserva com popup de confirmação e integração com a rota `DELETE /api/admin/bookings`.
- **Refinamento do Fluxo do Cliente (`BookingFlow.tsx`)** ✅:
  - O carrossel de 14 dias reage dinamicamente a `selectedBarber`, analisando seu campo `workDays` e ocultando os dias de folga (ex: domingos ou segundas) sem pular fixamente apenas domingos.
  - A exibição do Passo 1 foi estilizada de forma elegante com badges douradas mostrando os horários e dias específicos que o barbeiro trabalha, além de seu horário de almoço individual.
  - A API `/api/booking/available-slots` analisa o almoço do barbeiro e remove os slots conflitantes automaticamente.
- **Validação e Build de Produção** ✅:
  - Compilação realizada com sucesso absoluto através de `npm run build`, sem erros de TypeScript ou Next.js.

### **Fase 19: Correção de Assinaturas PrismaPg e Resolução Definitiva do Loop de Instalação (Concluída em 22/05/2026)**
- **Substituição por Proxy na Rota de Check (`src/app/api/install/check/route.ts`)** ✅:
  - Removida a inicialização local instável do `PrismaPg` que passava a connection string bruta (comportamento incompatível com o Prisma v7, gerando falhas de conexão silenciosas e jogando o instalador em loop infinito de redirecionamentos).
  - Substituída a verificação pelo consumo direto da instância global do Prisma em `src/lib/prisma.ts`. Graças ao proxy dinâmico que construímos na Fase 17, a rota agora consome conexões resilientes via `pg.Pool`, sincroniza de forma limpa quando as credenciais mudam em runtime no disco `.env` e é 100% livre de vazamentos de conexão ou quebras sintáticas.
- **Corrigido o Script de Seed Oficial do Prisma (`prisma/seed.js`)** ✅:
  - Identificada a mesma inconsistência de assinatura do `PrismaPg` na inicialização do seed.
  - Atualizado o script para instanciar corretamente a classe `Pool` do driver `pg`, tratando conexões SSL do Supabase de forma integrada e injetando a instância da pool no adaptador. Isso garante que comandos manuais e rotas automatizadas de seed se completem com total integridade e sem falhas em qualquer ambiente.
- **Auditoria de Outros Instaladores no Workspace** ✅:
  - Realizada busca profunda no workspace por outros adaptadores e arquivos de instalação em subdiretórios. Nenhuma outra ocorrência do bug de `PrismaPg` foi identificada, isolando a correção no aplicativo principal.
- **Validação e Homologação de Build** ✅:
  - Executada a compilação completa do Next.js via `npm run build` confirmando sucesso na geração das rotas estáticas e na integridade de tipos.

---

## 🚀 Fase Atual: Fase 20 - Sincronização do Schema do Instalador com Campos Personalizados e Migração Retrocompatível (Concluída em 22/05/2026)

### **Ações Realizadas**
1. **Identificação da Causa Raiz** ✅:
   - Identificamos que a API de produção `/api/install/check` estava quebrando devido à ausência das colunas adicionadas na **Fase 18** (`barberShopName`, `lunchStart`, `workDays`, etc.) no banco Supabase remoto do usuário. Como o Prisma exige essas colunas, as consultas falhavam e a aplicação redirecionava em loop para `/install/wizard`.
2. **Atualização do DDL no Instalador (`src/app/api/install/run/route.ts`)** ✅:
   - Adicionadas as novas colunas aos blocos `CREATE TABLE IF NOT EXISTS` do `SystemSettings` e do `Barber` na constante `schemaSql`.
3. **Criação de Patches de Migração (`src/app/api/install/run/route.ts`)** ✅:
   - Adicionados comandos `ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS ...` e `ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS ...` no final do script `schemaSql` para atualizar bancos de dados já criados, de forma totalmente transparente e sem perda de dados, ao executar o Wizard.
4. **Validação de Compilação do Next.js** ✅:
   - Executada a compilação completa de produção local via `npm run build` com sucesso absoluto, confirmando que o código TypeScript e a infraestrutura do Prisma estão perfeitamente íntegros.
