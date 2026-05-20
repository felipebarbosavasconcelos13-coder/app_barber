# Premium Barbershop Booking - App de Agendamento Online

Um aplicativo de agendamento online sofisticado, desenvolvido sob medida para barbearias clássicas e salões de luxo. Conta com suporte multi-barbeiro, integração nativa e em tempo real com as agendas do **Google Calendar** e otimização de campanhas de tráfego pago (Meta Ads e Google Ads) através do **Google Tag Manager (GTM)**.

Construído em **Next.js 16 (App Router + TypeScript)** com um **design system moderno em CSS Vanilla (Dark Mode Premium)** inspirado na alta alfaiataria e barbearias de alto padrão.

---

## 💎 Diferenciais do App

- **Estética Ultra Premium**: Interface visual envolvente sem o uso de Tailwind. Estilizada inteiramente em CSS Vanilla com glassmorphism sutil, tons dourados/bronze e micro-animações envolventes que transmitem luxo ao cliente.
- **Múltiplos Barbeiros Independentes**: O sistema permite cadastrar vários profissionais. Cada barbeiro possui sua própria agenda do Google Calendar associada e controla seus próprios horários e agendamentos.
- **Sincronização Bidirecional com Google Calendar**:
  - Consulta em tempo real a agenda individual dos barbeiros utilizando a API `freebusy` do Google para cruzar os expedientes da loja com compromissos pessoais, mostrando ao cliente apenas os horários realmente livres.
  - Insere o agendamento diretamente no calendário de cada profissional no momento em que é realizado.
- **Integração Dinâmica com GTM (Google Tag Manager)**:
  - O administrador cadastra seu ID do GTM diretamente no painel administrativo `/admin`.
  - O script do GTM é injetado no cabeçalho de todas as páginas públicas instantaneamente.
  - Ao concluir um agendamento com sucesso, o app envia o evento `bookings` com o valor do serviço selecionado e o nome do barbeiro para a camada de dados (`window.dataLayer`), permitindo otimizar campanhas de conversão no Meta Ads e Google Ads com facilidade.
- **Painel Administrativo Completo (`/admin`)**:
  - Aba de **Agendamentos**: Lista as reservas locais.
  - Aba de **Barbeiros**: Cadastra barbeiros, remove e conecta a agenda deles ao Google através do botão de fluxo OAuth2 individual.
  - Aba de **Serviços**: Cadastra serviços especificando o preço e a duração em minutos.
  - Aba de **Configurações**: Altera horários globais de funcionamento da loja, cadastra o código do GTM e redefine a senha mestra do sistema.

---

## 🛠️ Tecnologias e Dependências

- **Framework**: Next.js 16.2.6 (App Router e React 19)
- **Banco de Dados**: Prisma v7 + SQLite local (`dev.db`). Altamente portátil para PostgreSQL/Supabase em produção.
- **Driver de Banco**: `@prisma/adapter-libsql` + `@libsql/client` para alta compatibilidade e estabilidade.
- **API do Google**: `google-auth-library` e `googleapis` (OAuth 2.0 e Calendar API).
- **Estilos**: CSS Vanilla customizado no arquivo global `src/app/globals.css`.

---

## ⚙️ Configuração e Execução Local

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Renomeie ou crie uma cópia do arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```
Abra o arquivo `.env` e insira suas credenciais:
- As credenciais do Google Cloud são essenciais para que o sistema consiga acessar as agendas e sincronizar horários. Siga o arquivo [GUIA_GOOGLE_CLOUD.md](file:///c:/Users/felip/Desktop/N8N/Atigra/app_agendamento%20online/GUIA_GOOGLE_CLOUD.md) para criá-las passo a passo no Google Cloud Console.

### 3. Executar as Migrações do Banco de Dados (Prisma)
Para preparar seu banco de dados SQLite local, execute:
```bash
npx prisma db push
```

### 4. Alimentar o Banco de Dados com Dados Iniciais (Seed)
Execute o seed para criar a senha administrativa padrão (`admin123`), os horários padrão da loja e alguns serviços de exemplo:
```bash
# Se o script de seed estiver em JS compilado, ou você pode rodar o seed do prisma:
npx prisma db seed
```
*(Nota: O arquivo `prisma.config.ts` está configurado para direcionar o seed adequadamente).*

### 5. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse as interfaces do app localmente nos links abaixo:
- **Área Pública (Cliente)**: [http://localhost:3000](http://localhost:3000)
- **Área Administrativa (Barbeiro)**: [http://localhost:3000/admin](http://localhost:3000/admin) (Senha de acesso inicial: `admin123`)

---

## 🚀 Guia de Deploy (GitHub & Vercel)

Para colocar seu aplicativo no ar em produção de forma gratuita na Vercel integrada ao GitHub, siga estas etapas:

### 1. Inicializar o Git Localmente e Subir no GitHub
Na pasta do seu projeto local, execute:
```bash
# Inicializa o repositório git
git init

# Adiciona todos os arquivos (o .gitignore já protege o banco local dev.db e o .env de subirem)
git add .

# Faz o commit inicial
git commit -m "feat: app de agendamento online de barbearia concluido"

# Crie um repositório no seu painel do GitHub (ex: 'barbearia-agendamento') e adicione a origem remota
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git

# Envia o código para o GitHub
git push -u origin main
```

### 2. Criar e Configurar o App na Vercel
1. Acesse o painel da [Vercel](https://vercel.com/) e faça login com sua conta do GitHub.
2. Clique em **"Add New"** > **"Project"**.
3. Importe o repositório que você acabou de subir no GitHub.
4. Na tela de configurações do deploy:
   - **Framework Preset**: Next.js (detectado automaticamente).
   - **Build & Development Settings**: Deixe as opções padrão.
   - **Environment Variables**: Clique para adicionar as chaves de ambiente que colocamos no `.env` (exatamente como listado no seu `.env.example`).
     > ⚠️ **MUITO IMPORTANTE**: Em ambiente de produção na Vercel, o banco de dados SQLite local (`file:./dev.db`) é recriado a cada deploy/reinicialização do servidor serverless. 
     > Para produção estável, crie um banco de dados serverless (como um banco PostgreSQL gratuito no Supabase, Neon ou um SQLite distribuído no Turso) e adicione a URL correspondente na variável `DATABASE_URL`.
5. Clique em **"Deploy"** e aguarde a finalização da build.
6. A Vercel gerará um domínio gratuito do tipo `https://seu-app.vercel.app`.

### 3. Ajustar as Credenciais do Google Cloud após o Deploy
Após obter o link oficial da Vercel (ex: `https://barbearia-vip.vercel.app`):
1. Acesse o seu projeto no [Google Cloud Console](https://console.cloud.google.com/).
2. Vá em **APIs e Serviços** > **Credenciais**.
3. Edite o ID do cliente OAuth 2.0 criado para o seu app.
4. Em **Origens JavaScript autorizadas**, clique em Adicionar URI e insira a URL da sua aplicação na Vercel (sem a barra final): `https://barbearia-vip.vercel.app`
5. Em **URIs de redirecionamento autorizadas**, clique em Adicionar URI e insira a URL de callback de produção: `https://barbearia-vip.vercel.app/api/auth/google/callback`
6. Clique em **Salvar**.
7. Vá no seu painel da Vercel (Configurações do Projeto > Environment Variables) e edite as variáveis `GOOGLE_REDIRECT_URI` e `NEXT_PUBLIC_APP_URL` com as URLs corretas de produção. Faça um novo deploy ou redeploy para carregar as novas variáveis.

Tudo pronto! Seus barbeiros agora poderão acessar o painel administrativo na Vercel, clicar para autenticar e conectar as agendas do Google Cloud com total segurança, e seus clientes poderão marcar os agendamentos de qualquer lugar do mundo!
