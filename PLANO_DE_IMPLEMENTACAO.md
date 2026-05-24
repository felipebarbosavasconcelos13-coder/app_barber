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

### 8. Aba de Gestão de Clientes (CRM) [NEW]
- **[NEW] `src/app/api/admin/clients/route.ts`**: Endpoint que processa e agrupa agendamentos por telefone exclusivo (`clientPhone`). Calcula valor total gasto, contagem de agendamentos, data do último serviço e dias sem retornar de cada cliente.
- **[UPDATED] `src/components/AdminDashboard.tsx`**: Nova aba interativa "Clientes" com filtros de pesquisa e badges de tempo de ausência para follow-up.

### 9. Automações e Disparos de WhatsApp [NEW]
- **[NEW] `src/app/api/admin/automations/route.ts`**: Endpoint que lê e atualiza as configurações da tabela `SystemSettings`.
- **[NEW] `src/app/api/admin/automations/reengagement-pending/route.ts`**: Rota que calcula e retorna a lista de clientes sem visitas há mais de X dias e sem agendamentos futuros.
- **[NEW] `src/app/api/admin/automations/trigger-reengagement/route.ts`**: Rota que envia lembretes por WhatsApp via Evolution API em lote e ativa a flag de controle `reengagementSent` no banco.
- **[UPDATED] `prisma/schema.prisma` + `src/lib/prisma.ts` + `src/app/api/install/run/route.ts`**: Auto-migrações retrocompatíveis e campos no schema para controle das configurações e disparos.
- **[UPDATED] `src/app/api/booking/create/route.ts`**: Dispara mensagens de confirmação consumindo o template customizado do banco de dados (se habilitado).
- **[UPDATED] `src/components/AdminDashboard.tsx`**: Nova aba interativa "Automações" com formulário de edição de templates dinâmicos e controle de disparos em lote dos lembretes pendentes de reengajamento.

---

## Plano de Verificacao

1. **Testes do Instalador Web**:
   - Abrir o app localmente e garantir que a rota `/install` seja exibida.
   - Fornecer credenciais de teste, concluir o instalador e verificar se o `.env` e gerado e as tabelas populadas via SQL direto.
   - Acessar `/install` apos conclusao e verificar redirecionamento para `/admin`.
   - **Caso de Teste - Banco Pausado / Pooler Inativo**: Simular a conexão com um banco pausado ou com pooler inativo e validar se a mensagem didática refinada e os links são renderizados de forma perfeita na tela.

2. **Testes de Clientes (CRM) e Ausência**:
   - Forçar inserção de agendamento concluído há mais de 30 dias de um cliente no banco.
   - Acessar aba "Clientes" e atestar cálculo do total gasto e contagem de ausência em dias perfeita.
   - Verificar filtro e ordenação da listagem.

3. **Testes das Automações**:
   - Ativar e testar templates dinâmicos da aba "Automações".
   - Criar agendamento e verificar disparo personalizado.
   - Realizar disparo em lote de clientes ausentes há mais de 30 dias e atestar mudança da flag `reengagementSent` para evitar duplicidade.

4. **Build de Producao**:
   - Executar `npm run build` para validar compilacao TypeScript e rotas Next.js.

---

## 📅 Fase 25: Integracao Facilitada com Google (Ficha, Reviews Curados & Mapa) [PROPOSTA REVISADA]

### **Resumo do Recurso (Zero Chave de API ou Custos)**
Para eliminar a necessidade de criar contas de faturamento no Google Cloud, expor dados de cartao ou lidar com configuracoes de API Keys complexas, implementaremos uma abordagem de alta conversao e 100% simplificada:
1. **Depoimentos de Sucesso (Curadoria Local - CRUD)**: Criaremos uma aba simples no painel administrativo para que o dono da barbearia possa cadastrar depoimentos de destaque (copiando os melhores elogios de 5 estrelas da sua ficha do Google). Isso garante controle de reputacao (evitando comentarios maliciosos na Home), exibe depoimentos estilizados com selos elegantes do Google no nosso design de luxo, e funciona de forma 100% gratuita.
2. **Suporte a Widgets Externos Gratuitos**: Um campo de texto livre no painel permitira colar o código de integracao de qualquer widget de reviews gratuito de terceiros (ex: *Elfsight*, *SociableKIT*, *ReviewsOnMyWebsite*), caso o administrador prefira injetar o widget dinamico em tempo real de forma automatica.
3. **Mapa do Google Facilitado (Embed Gratuito)**: O administrador cola a URL de incorporacao direta do Google Maps obtida com apenas 3 cliques no Maps (Compartilhar -> Incorporar -> Copiar URL). Se ele nao fornecer nenhuma URL, o aplicativo resolve e gera uma URL de mapa dinamica resiliente baseada no endereco fisico cadastrado no estabelecimento (`settings.address`).

### **Proposta de Alteracoes Arquiteturais**

#### 1. Banco de Dados & Migracoes
- **[MODIFY] [schema.prisma](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/prisma/schema.prisma)**:
  - Adicionar o modelo `Testimonial` para curadoria de depoimentos:
    ```prisma
    model Testimonial {
      id         String   @id @default(uuid())
      authorName String
      rating     Int      @default(5)
      content    String
      avatarUrl  String?
      source     String   @default("Google") // Google, Local, etc.
      createdAt  DateTime @default(now())
      updatedAt  DateTime @updatedAt
    }
    ```
  - Adicionar campos no modelo `SystemSettings`:
    - `googleMapsEmbedUrl` (String, opcional)
    - `googleReviewsWidget` (String, opcional) - Para injetar iframe/script de terceiros se desejado.
- **[MODIFY] [prisma.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/lib/prisma.ts)**:
  - Adicionar DDLs automáticas em runtime:
    ```sql
    CREATE TABLE IF NOT EXISTS "Testimonial" (
      "id" TEXT NOT NULL,
      "authorName" TEXT NOT NULL,
      "rating" INTEGER NOT NULL DEFAULT 5,
      "content" TEXT NOT NULL,
      "avatarUrl" TEXT,
      "source" TEXT NOT NULL DEFAULT 'Google',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
    );
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleMapsEmbedUrl" TEXT;
    ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "googleReviewsWidget" TEXT;
    ```
- **[MODIFY] [route.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/api/install/run/route.ts)**:
  - Atualizar setup inicial DDL para novas instalacoes e inserir 3 depoimentos padrão de seed para a Landing Page iniciar linda.

#### 2. Backend APIs
- **[NEW] [route.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/api/admin/testimonials/route.ts)**:
  - Criar CRUD completo para o painel de administracao: `GET`, `POST`, `PUT` e `DELETE` para gerenciar depoimentos curados.
- **[NEW] [route.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/api/testimonials/route.ts)**:
  - Criar rota pública `GET /api/testimonials` que retorna os depoimentos cadastrados ou fallbacks de demonstração premium caso a lista esteja vazia.
- **[MODIFY] [route.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/api/admin/settings/route.ts)**:
  - Estender o `PUT` de salvar configuracoes para gravar e persistir `googleMapsEmbedUrl` e `googleReviewsWidget`.

#### 3. Frontend Landing Page (Cliente)
- **[MODIFY] [page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/page.tsx)**:
  - Buscar `googleMapsEmbedUrl`, `googleReviewsWidget` e `address` nas configuracoes gerais do banco.
  - Inserir **Secao de Avaliacoes ("O que dizem nossos clientes")**:
    - Layout de luxo com glassmorphic cards, estrelas douradas animadas e carousel/grid.
    - Se `googleReviewsWidget` estiver configurado, injeta o iframe/widget de terceiros de forma limpa. Caso contrario, consome a rota pública `/api/testimonials` mostrando os depoimentos curados pelo dono da barbearia (com o selo elegante *"Avaliação do Google"*).
  - Inserir **Secao de Localizacao ("Onde Estamos")**:
    - Layout com duas colunas: Informacoes de contato e o **Mapa do Google**.
    - Se `googleMapsEmbedUrl` estiver configurado, usa ele direto. Se nao estiver, monta a URL dinamica resiliente baseada no endereco cadastrado:
      `https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`

#### 4. Frontend Painel Administrativo (Barbeiro)
- **[MODIFY] [AdminDashboard.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/components/AdminDashboard.tsx)**:
  - Adicionar campos `googleMapsEmbedUrl` e `googleReviewsWidget` no state local de `settings` e estender o payload do submit.
  - Adicionar aba ou Card de configuracao dedicada: **Integracao Google & Localizacao**:
    - Formulário CRUD simples e premium para Adicionar, Editar e Remover Depoimentos Curados (Nome, Nota 1-5, Comentário, Foto Opcional).
    - Campo para colar Iframe/Link do Google Maps e do Widget de Reviews de Terceiros.
    - **Instrucoes Passo a Passo Ricas**:
      1. **Mapa Gratuito**: Como ir no Google Maps, buscar a barbearia, clicar em "Compartilhar" -> "Incorporar um mapa", copiar o código HTML iframe e colar o link correspondente no input (passo simples de 3 cliques).
      2. **Widgets Gratuitos**: Links e instrucoes sugerindo ferramentas de widgets de reviews gratuitas (ex: Elfsight) e como colar o código final gerado.

---

### **Status e Conclusão da Fase 25**
- **Verificacao no Painel Administrativo** ✅:
  - Confirmado o perfeito funcionamento da nova seção de depoimentos no painel `/admin`, permitindo a criação, edição e remoção dinâmica de depoimentos curados.
  - Validada a persistência em tempo real dos campos de URL de Embed do Google Maps e Widget de Avaliações nas Configurações Gerais.
- **Verificacao no Backend** ✅:
  - Rota `/api/testimonials` testada com sucesso absoluto, retornando os depoimentos cadastrados no banco ou os fallbacks estruturados se a tabela estiver sem registros.
  - Rota administrativa `/api/admin/settings` e Evolution API testadas, com gravação dinâmica e direta no Supabase.
- **Verificacao na Landing Page (Cliente)** ✅:
  - Carrossel de depoimentos estilizado em Glassmorphism Premium com o selo verificado do Google, estrelas douradas e SVG original de identificação do Google exibido de forma fluida.
  - Seção de Localização com o Mapa do Google perfeitamente estilizado em Dark Mode Premium via filtros de matriz gráfica CSS, com fallback dinâmico resiliente e automático baseado em `settings.address` caso o administrador não configure uma URL.
- **Build Geral de Homologação** ✅:
  - Executada a compilação de produção com sucesso absoluto (`npm run build`), garantindo total conformidade TypeScript e integridade estrutural do Next.js sem nenhuma falha!

**Toda a Fase 25 foi concluída com sucesso e homologada em produção!**

---

## 📅 Fase 26: Otimização Mobile Premium Touch-First & Validação Visual (Concluída em 23/05/2026)

### **Resumo do Recurso (Ergonomia Móvel e Consistência)**
Para proporcionar uma experiência premium e impecável aos clientes e administradores em smartphones (especialmente iPhones e Androids com telas pequenas), aplicamos um conjunto robusto de melhorias em Vanilla CSS e HTML5 sem comprometer a leveza ou a performance:
1. **Otimização de globals.css (Touch Targets & CSS Puro)**:
   - Modificado [globals.css](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/globals.css) para incluir um Design System Móvel responsivo `@media (max-width: 768px)`.
   - Adicionada a quebra de tabelas com a classe `.premium-table` em cards empilhados ricos via CSS puro, ocultando o cabeçalho original e injetando as etiquetas contextuais dinamicamente com o atributo pseudo-elemento `content: attr(data-label)`.
   - Ampliação de touch targets clicáveis (botões de abas `.nav-item`, botões rápidos de ação `.btn-delete`, `.btn-edit-action` e botões de agendamento `.btn-gold`, `.btn-outline`) para altura/área de toque mínima de `44px` a `48px`, garantindo usabilidade ergonômica ideal (Thumb Zone).
   - Ajuste em inputs `.form-input` de formulários para `font-size: 1.05rem` (16.8px) no mobile para anular o zoom automático invasivo forçado pelo Safari no iOS ao focar em inputs menores que 16px.
2. **Refinamento do Fluxo de Agendamento (BookingFlow.tsx)**:
   - Configuração de scroll horizontal suave por gesto touch nativo (`-webkit-overflow-scrolling: touch`) no carrossel de 14 dias, ocultando a barra de rolagem visualmente poluída.
   - Otimização das grades de horários e botões de seleção de barbeiro e serviços com espaçamento de segurança amplo para prevenir toques errôneos.
3. **Responsividade SPA Administrativa (AdminDashboard.tsx)**:
   - Menu lateral de abas administrativas no mobile redimensionado com área de toque mínima de `48px` e distribuição de grade de fluxo contínuo.
   - **Tabela de Clientes (CRM)** atualizada com a injeção do atributo `data-label` em todos os elementos `<td>` correspondentes (Cliente, WhatsApp / Celular, Agendamentos, Total Gasto, Último Serviço, Tempo sem Voltar, Ação).
   - Agora, tanto a listagem de agendamentos, o cadastro de depoimentos quanto o CRM de clientes quebram de forma impecável em blocos verticais compactos e refinados em celulares, impedindo completamente o scroll horizontal no painel.

### **Status e Conclusão da Fase 26**
- **Touch Targets Auditados** ✅: Todos os botões, badges interativas e links clicáveis atendem à ergonomia touch recomendada de >= 44px de altura.
- **Inexistência de Scroll Horizontal** ✅: Landing Page (`/`) e Painel Administrativo (`/admin`) são 100% contidos nas dimensões horizontais do viewport móvel.
- **Tabelas Responsivas Homologadas** ✅: As tabelas de Agendamentos, Depoimentos e Clientes se comportam de forma fluida e legível em celulares na forma de cartões elegantes.
- **Acessibilidade e Contraste** ✅: Garantida a excelente leitura com a combinação de fontes gold (`#c5a880`) e off-white sobre fundo carvão escuro (`#0a0a0c`).
- **Build Geral de Homologação** ✅: Compilação local e de produção realizada com sucesso absoluto (`npm run build`), garantindo 100% de sucesso e integridade de tipos TypeScript.

**Toda a Fase 26 foi concluída com sucesso e homologada em produção!**

---

## 📅 Fase 27: Resiliência contra Loops de Reinstalação e Atualização Silenciosa Pós-Push (Concluída em 23/05/2026)

### **Resumo do Recurso (Proteção de Deploy & Atualização Contínua)**
Para resolver definitivamente a instabilidade em que atualizações pós-push forçavam o redirecionamento indevido para o instalador (`/install`), implementamos uma barreira arquitetural de resiliência baseada em variáveis de ambiente ativas:
1. **Inteligência de Estado (`isDatabaseConfigured`)**:
   - Criada a função `isDatabaseConfigured()` em [prisma.ts](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/lib/prisma.ts) que atesta em tempo de execução se a connection string do banco de dados PostgreSQL real de produção já está ativa nas variáveis de ambiente virtuais ou físicas (`process.env.DATABASE_URL`).
   - Se ativa, o aplicativo é considerado **Instalado Definitivamente**, independente do estado da rede ou da atividade momentânea do banco.
2. **Páginas de Indisponibilidade de Banco de Luxo**:
   - Refatoradas as rotas da Landing Page pública [src/app/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/page.tsx) e do Painel Administrativo [src/app/admin/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/admin/page.tsx).
   - Se o banco de dados estiver inativo, pausado ou apresentar qualquer oscilação temporária de cold start, o sistema **NÃO** redireciona o usuário para `/install`. 
   - Em vez disso, renderiza uma **página de indisponibilidade luxuosa em Dark Mode**, com instruções claras de como reativar o projeto no painel da Supabase ("Restore project") e um botão "Tentar Novamente", mitigando falsos alarmes de perda de dados.
3. **Refatoração da API e Proteção do Instalador**:
   - A rota de check [/api/install/check](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/api/install/check/route.ts) agora responde `initialized: true` se o banco estiver configurado no ambiente, mesmo que offline no momento.
   - O instalador [src/app/install/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/page.tsx), a tela inicial [src/app/install/start/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/start/page.tsx) e o Wizard [src/app/install/wizard/page.tsx](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/src/app/install/wizard/page.tsx) foram blindados. Se acessados diretamente no navegador após a instalação, eles consultam a API, detectam a configuração ativa e desviam o usuário instantaneamente para `/admin`.
4. **Auto-Migrações Silenciosas**:
   - Novas tabelas e colunas adicionadas nos commits do Git são aplicadas silenciosamente e de forma 100% invisível em runtime por meio do proxy Prisma pg pool na inicialização do servidor, sem exigir intervenções manuais ou reinstalações.

### **Status e Conclusão da Fase 27**
- **Resiliência de Estado Homologada** ✅: O aplicativo agora diferencia perfeitamente quedas temporárias de banco de dados da ausência total de setup.
- **Telas de Erro Integradas** ✅: Criados componentes de erro de conexão responsivos e alinhados com o Design System Premium Gold/Carvão da barbearia.
- **Rotas Blindadas contra Reinstalação** ✅: O Wizard de Instalação está 100% inacessível após a configuração inicial estar salva.
- **Build Geral de Homologação** ✅: Compilação local e de produção realizada com sucesso absoluto (`npm run build`), garantindo total integridade e compilação do Next.js sem erros de build.

**Toda a Fase 27 foi concluída com sucesso e homologada em produção!**

---

## 📅 Fase 28: Painel de Cores Customizável, Avaliações do Google no Hero, Correção de Contraste e Modo Foco no Agendamento (Concluída em 23/05/2026)

### **Resumo dos Recursos Propostos**

Esta fase reúne melhorias de branding, clareza visual de usabilidade (contraste de acessibilidade de horários), marketing de reputação dinâmico no Hero e foco de conversão no agendamento do cliente móvel:

1. **Reputação Google Maps no Hero Principal**:
   - **Campos no Banco**: Adicionar `googleRating` (Decimal, ex: 5.0) e `googleReviewsCount` (Int, ex: 154) no modelo `SystemSettings`.
   - **Exibição na Landing Page**: Renderizar um badge flutuante dourado e elegante logo abaixo do nome da barbearia no Hero. Exemplo: `★ 5.0 (154 avaliações no Google Meu Negócio)`.
   - **Visibilidade Inteligente**: Caso o campo de URL de mapa do Google ou avaliações esteja inativo, a seção não será exibida, mantendo o design limpo.

2. **Diagnóstico e Correção de Depoimentos Reais do Google Maps**:
   - **Causa Técnica**: O iframe de embed do Google Maps padrão (`<iframe>`) serve exclusivamente para renderização visual geográfica e, devido a restrições de segurança de domínio e CORS do próprio Google, **não exporta nem permite ler depoimentos em formato de texto** dinâmico para estilização customizada na Landing Page.
   - **Soluções Propostas**:
     - *Opção A (Widget de Terceiros)*: O barbeiro colará o código de script e container fornecido por widgets gratuitos de reputação (como *Elfsight* ou *Trustpilot*) no campo `googleReviewsWidget` já existente. Adicionaremos no painel administrativo instruções extremamente claras e ilustradas de como gerar esse widget gratuito e copiar o código correto.
     - *Opção B (Curadoria Manual)*: O barbeiro copia os depoimentos reais de maior destaque da sua ficha do Google Meu Negócio e cadastra na tabela de depoimentos curados do painel administrativo. Eles serão renderizados instantaneamente na página principal com design de luxo, avatares e selo verificado do Google.

3. **Correção de Contraste e Visibilidade dos Horários (Acessibilidade WCAG)**:
   - **Problema Identificado**: Os horários disponíveis no seletor de agendamento (`.slot-btn`) estão exibindo texto cinza escuro sobre fundo escuro, impossibilitando a leitura confortável (baixo contraste).
   - **Melhoria Proposta**: Modificar o CSS de `.slot-btn` no arquivo `BookingFlow.tsx` para forçar cores de altíssima legibilidade em conformidade com as diretrizes da WCAG:
     - Texto em off-white claro (`#ffffff` ou `var(--text-primary)`) por padrão.
     - Ícone do relógio Lucide com cor gold ativa (`var(--accent-gold)`) para brilho estético.
     - Fundo do botão não selecionado em cinza translúcido suave (`rgba(255, 255, 255, 0.04)`), garantindo contraste absoluto sobre o container escuro.

4. **Painel de Branding & Paleta de Cores Dinâmica pelo Barbeiro**:
   - **Modelagem de Banco (schema.prisma)**: Adicionar as colunas de cores ao modelo `SystemSettings`:
     - `colorAccentGold` (String, padrão `#c5a880` - Destaque dourado)
     - `colorBgPrimary` (String, padrão `#0a0a0c` - Fundo Principal Dark)
     - `colorBgSecondary` (String, padrão `#121216` - Fundo Secundário)
     - `colorBgTertiary` (String, padrão `#1b1b22` - Fundo Terciário)
   - **Painel Administrativo (`/admin` - Branding)**: Implementar seletor interativo de paleta de cores com inputs do tipo nativo color (`type="color"`), permitindo que o administrador defina a paleta exata da sua marca (azul, vermelho, verde, preto profundo, etc.).
   - **Injeção Dinâmica na UI**: Injetar as variáveis CSS modificadas no `:root` no layout do servidor Next.js em tempo real. O aplicativo herdará automaticamente as cores personalizadas do barbeiro em toda a Landing Page e Painel Administrativo de forma instantânea!

5. **Modo Foco em Agendamento (Ergonomia e Conversão)**:
   - **Comportamento Proposto**: Assim que o cliente final interagir e selecionar o barbeiro (Passo 1), o componente `BookingFlow.tsx` ativará o estado de foco (`isFocused`).
   - **Lógica na UI**: Quando focado, a página pública ocultará de forma suave (transições fade) as seções externas de distração (como o Hero gigante no topo, seções de depoimentos longos e mapa do rodapé) ou aplicará um container focado de altura cheia. Isso impede o deslocamento involuntário de tela (rolagens acidentais para cima ou para baixo), centralizando 100% da atenção do usuário no fluxo rápido de passos do agendamento, maximizando as conversões.

---

### **Status e Conclusão da Fase 28**
- **Reputação Google no Hero** ✅: Adicionados os campos `googleRating` e `googleReviewsCount` em `SystemSettings`, persistidos pela API administrativa e exibidos em badge premium no Hero quando há dados de reputação ou Maps configurados.
- **Avaliações Reais do Google Maps Sem Chave** ✅: Verificado que o iframe/link do Google Maps não permite extrair automaticamente textos de avaliações para cards customizados sem chave/API. A alternativa sem chave mantida é incorporar mapa/ficha visual via embed e aceitar HTML de widget externo (`googleReviewsWidget`) quando o administrador quiser avaliações dinâmicas sem configurar API própria do Google.
- **Contraste dos Horários** ✅: Botões `.slot-btn` do `BookingFlow.tsx` receberam texto branco, fundo translúcido e ícone dourado, elevando a legibilidade no tema escuro.
- **Paleta de Cores Dinâmica** ✅: Adicionados os campos `colorAccentGold`, `colorBgPrimary`, `colorBgSecondary` e `colorBgTertiary`, com auto-migrações no runtime e no instalador. O layout injeta as variáveis CSS globais a partir do banco.
- **Painel Administrativo de Branding** ✅: Criado card "Paleta da Marca" com inputs `type="color"` e campos hexadecimais para customização direta pelo barbeiro.
- **Modo Foco do Agendamento** ✅: Após a seleção do barbeiro, `BookingFlow.tsx` adiciona a classe `booking-focused` e o CSS global oculta Hero, depoimentos, mapa e rodapé, centralizando o fluxo de reserva.
- **Build Geral de Homologação** ✅: Executado `npm run build` com sucesso. Os logs locais de `ECONNREFUSED` ocorreram apenas pela ausência de PostgreSQL local durante prerender, sem falha de build.
- **Correção de Exibição de Depoimentos** ✅: Removidos os fallbacks fictícios da Landing Page, da API pública `/api/testimonials` e do seed do instalador. A seção "O Que Nossos Clientes Dizem" agora só aparece se houver widget externo configurado ou depoimentos reais cadastrados no painel administrativo.
- **Revisão Sem Google API Key** ✅: Removida a abordagem com Google Places API por exigir chave. O painel agora documenta a limitação do iframe do Maps e oferece o caminho sem chave: embed/link do Google Maps, nota/quantidade e widget externo opcional de avaliações.
- **Importação de Widget Público Sem API** ✅: Implementado endpoint `POST /api/admin/google-reviews/import-widget` para importar avaliações a partir de HTML ou URL pública de widgets renderizados, como o exemplo WordPress `wp-gr rpi wpac`. O painel agora permite colar esse HTML/URL e importar os depoimentos para `Testimonial` sem chave Google.
- **Opção com Google Places API Key** ✅: Adicionada alternativa oficial para quem quiser usar chave de API: campos `googlePlacesApiKey` e `googlePlaceId`, botão "Usar API Key" no painel e endpoint `POST /api/admin/google-reviews/sync`. A opção sem API por widget público permanece disponível.
- **Ambiente de Teste da API Key** ✅: Criado endpoint `POST /api/admin/google-reviews/test` e botão "Testar API Key" no painel. O teste valida a chave e o estabelecimento sem importar dados, retornando diagnósticos claros de permissões, billing, Places API desativada ou Place ID inválido.
- **Correção de Exibição das Avaliações** ✅: Ajustada a landing para priorizar as avaliações salvas em `Testimonial` e não renderizar iframe/link de Google Maps como widget de depoimentos. O painel agora explica que a Google Places API retorna no máximo 5 avaliações e recomenda widget público ou cadastro manual para mostrar mais.

**Toda a Fase 28 foi concluída com sucesso e homologada em build local!**

---

## 📅 Fase 30: Otimização de Copy para Conversão & Redução de Repetições (Concluída em 23/05/2026)

### **Resumo do Recurso**
Para elevar a taxa de agendamentos (conversão) e limpar a Landing Page de elementos poluídos e redundantes, aplicamos técnicas avançadas de copywriting (baseadas na skill `content-creator`), eliminamos a repetição excessiva do endereço físico e do contato, e refinamos os componentes visuais para um design ultra-premium.

1. **Hero Section (`src/app/page.tsx`)**:
   - **Remoção de Repetição**: Substituição do endereço completo e número de telefone estáticos por botões interativos de ação rápida.
   - **Gatilhos de Conversão**:
     - *Endereço* vira `Ver Localização no Mapa` (link âncora suave para a seção `#onde-estamos`, livre de emoticons redundantes e com ícone SVG `MapPin` limpo).
     - *Telefone* vira `Ligar para a Barbearia` (link de discagem direta `tel:`, livre de emoticons redundantes e com ícone SVG `Phone` limpo).
   - **Estilo Ultra-Premium (Remoção de Emoticons e Upgrade de Ícones)**:
     - Badge superior: `"EXCELÊNCIA E PRECISÃO NO CUIDADO DO SEU VISUAL"` (removido emoticon `⭐` redundante ao lado do SVG `Award`).
     - Avaliações do Google: Substituição do caractere unicode `★` por um ícone SVG real do Lucide-React (`<Star size={14} ... />` preenchido de ouro) e simplificação do texto de `"Google Meu Negócio"` para apenas `"Google"`, tornando a leitura mais limpa e focada.
   - **Copy Persuasiva**:
     - Subtítulo focado em simplicidade e escassez: `"Escolha o barbeiro de sua preferência, selecione o serviço e garanta a sua reserva em menos de 1 minuto — de forma prática, online e sem filas."`

2. **Seção de Agendamento (`src/app/page.tsx`)**:
   - Subtítulo focado em clareza: `"Selecione o profissional, o serviço e defina a melhor data para você."`

3. **Seção de Depoimentos (`src/app/page.tsx`)**:
   - Badge superior: `"REPUTAÇÃO E CONFIANÇA"` (removido emoticon `⭐` redundante).
   - H2 principal: `"Quem Frequenta, Recomenda"`.
   - Subtítulo: `"Veja a experiência de quem confia na nossa equipe para cuidar do seu estilo todos os dias."`

4. **Seção de Localização (`src/app/page.tsx`)**:
   - Adição do ID `id="onde-estamos"` para ancoragem fluida do Hero.
   - Melhoria da copy com foco em experiência sensorial e conforto: `"Ambiente climatizado com estacionamento privativo, café gourmet e cerveja gelada esperando por você. Cada detalhe foi planejado para transformar o seu corte de cabelo em um momento exclusivo de relaxamento."`

5. **Footer (`src/app/page.tsx`)**:
   - **Remoção de Repetição**: Retirada da linha contendo o endereço completo e telefone redundantes.
   - Slogan de marca elegante: `"Sua marca registrada é o seu estilo. Agende online hoje mesmo."`

---

## 📅 Fase 31: Automação de Lembrete 1h Antes do Agendamento (Concluída em 23/05/2026)

### **Resumo do Recurso**
Para reduzir a taxa de faltas (no-shows) de clientes e agregar valor à experiência operacional, implementamos um disparador automático de **Lembretes de WhatsApp 1 hora antes do agendamento**.

1. **Banco de Dados & Auto-Migração (`src/lib/prisma.ts` e `src/app/api/install/run/route.ts`)**:
   - **Campos no Banco**: Adicionado `whatsappReminderEnabled` (Boolean, default: true) e `whatsappReminderTemplate` (String, default) na tabela `SystemSettings`.
   - Adicionado a flag de controle de envio `reminderSent` (Boolean, default: false) na tabela `Booking` para evitar envios duplicados.
   - Adicionado patches de auto-migração SQL no proxy Prisma, no instalador e também no `prisma/schema.prisma` local para suportar runtime e compilação do Next.js sem quebra de tipos.

2. **API de Disparo Periódico (`src/app/api/admin/automations/trigger-reminders/route.ts`)**:
   - Desenvolvido o endpoint de trigger assíncrono que pode ser chamado por cron ou manualmente.
   - O algoritmo busca agendamentos futuros pendentes de lembrete (`reminderSent = false`) que acontecem entre `agora + 45 minutos` e `agora + 75 minutos` (resiliência de 1 hora antes com tolerância).
   - Formata o template de forma personalizada substituindo as tags dinâmicas: `{cliente}`, `{data}`, `{horario}`, `{barbeiro}`, `{servico}`, `{valor}` e `{barbearia}`.
   - Dispara a notificação via Evolution API do WhatsApp e grava `reminderSent = true` no banco.

3. **Painel de Automações (`src/components/AdminDashboard.tsx` & `/api/admin/automations`)**:




