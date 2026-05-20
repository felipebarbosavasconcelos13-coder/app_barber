# Guia de Configuração: Google Cloud Console & Google Calendar API

Este guia orienta passo a passo sobre como criar e configurar seu projeto no **Google Cloud Console** para obter as credenciais de integração do aplicativo de agendamento de barbearia com as agendas do Google Calendar dos barbeiros.

---

## Passo 1: Acessar o Google Cloud Console
1. Acesse o site do [Google Cloud Console](https://console.cloud.google.com/).
2. Faça login com uma conta Google (preferencialmente uma conta administrativa estável ou da barbearia).

## Passo 2: Criar um Novo Projeto
1. No canto superior esquerdo (ao lado do logotipo do Google Cloud), clique no menu suspenso de projetos (se for um novo usuário, pode estar escrito "Selecionar projeto").
2. Clique no botão **"Novo Projeto"** (New Project).
3. Preencha os dados:
   - **Nome do Projeto**: `Barbearia Agendamento` (ou o nome que preferir).
   - **Organização / Local**: Deixe como padrão ou "Sem organização".
4. Clique em **"Criar"** (Create) e aguarde alguns segundos até o projeto ser inicializado. Certifique-se de que o projeto recém-criado esteja selecionado na barra superior.

## Passo 3: Ativar a API do Google Calendar
1. No menu lateral esquerdo (ou na barra de pesquisa no topo), vá em **"APIs e Serviços"** (APIs & Services) e clique em **"Biblioteca"** (Library).
2. Na barra de busca da biblioteca de APIs, digite: `Google Calendar API`.
3. Clique no resultado **Google Calendar API**.
4. Clique no botão azul **"Ativar"** (Enable). Isso permitirá que o aplicativo consulte disponibilidades e insira novos eventos nas agendas dos barbeiros cadastrados.

## Passo 4: Configurar a Tela de Consentimento OAuth (OAuth Consent Screen)
Como o aplicativo solicita acesso offline e permissão para gerenciar os eventos dos calendários dos barbeiros, é necessário configurar a tela de permissão que o barbeiro visualizará quando conectar sua agenda.

1. No menu esquerdo, vá em **"APIs e Serviços"** (APIs & Services) e clique em **"Tela de consentimento OAuth"** (OAuth consent screen).
2. Selecione o tipo de usuário (**User Type**):
   - **Externo (External)**: Recomendado (qualquer conta Google de barbeiro externa poderá se autenticar).
3. Clique em **"Criar"** (Create).
4. **Informações do App (App Information)**:
   - **Nome do aplicativo**: `Agendamento Barbearia` (Nome exibido na tela de consentimento).
   - **E-mail de suporte do usuário**: Selecione o seu e-mail na lista.
   - **Logotipo do app**: Opcional (não necessário para uso em produção interna/homologação).
5. **Domínio do aplicativo (App domain)**:
   - Se estiver rodando apenas localmente, pode deixar em branco.
   - Se for publicar na Vercel, adicione os links nos campos (ex: `https://seu-app.vercel.app`).
6. **Dados de contato do desenvolvedor**:
   - Insira o seu e-mail.
7. Clique em **"Salvar e Continuar"** (Save and Continue).
8. **Escopos (Scopes)**:
   - Os escopos definem quais dados o app poderá ler ou alterar. Clique em **"Adicionar ou Remover Escopos"** (Add or Remove Scopes).
   - Na lista, filtre ou selecione os seguintes escopos da API do Google Calendar:
     - `.../auth/calendar.events` (Visualizar e editar eventos nos seus calendários) — **CRÍTICO para criar os agendamentos**.
     - `.../auth/calendar.readonly` (Visualizar seus calendários) — **CRÍTICO para verificar disponibilidade de horários (slots livres)**.
   - Clique em **"Atualizar"** (Update) no final da lista.
   - Clique em **"Salvar e Continuar"**.
9. **Usuários de Teste (Test Users)**:
   - Como o app estará inicialmente em modo de "Rascunho/Desenvolvimento" (Testing) no Google, apenas os e-mails listados aqui poderão fazer login no OAuth.
   - **IMPORTANTE**: Clique em **"Add Users"** e insira os e-mails dos barbeiros que você planeja cadastrar no sistema para que eles consigam autorizar a integração.
   - Clique em **"Salvar e Continuar"**.
10. Revise as informações e clique em **"Voltar ao painel"** (Back to dashboard).

## Passo 5: Criar as Credenciais OAuth 2.0 (Client ID e Secret)
1. No menu esquerdo de **APIs e Serviços**, clique em **"Credenciais"** (Credentials).
2. Clique no botão superior **"+ Criar Credenciais"** (+ Create Credentials) e selecione **"ID do cliente OAuth"** (OAuth client ID).
3. No campo **Tipo de aplicativo** (Application type), selecione **"Aplicativo da Web"** (Web application).
4. Preencha as configurações:
   - **Nome**: `Web Agendamento Barbearia` (Nome interno de controle).
   - **Origens JavaScript autorizadas** (Authorized JavaScript origins):
     - Clique em **"Adicionar URI"** e adicione o endereço de desenvolvimento: `http://localhost:3000`
     - Se o app já estiver na Vercel, clique em **"Adicionar URI"** e coloque a URL de produção: `https://seu-app.vercel.app`
   - **URIs de redirecionamento autorizadas** (Authorized redirect URIs):
     - **MUITO IMPORTANTE**: É a URL exata para onde o Google enviará os códigos de autorização.
     - Desenvolvimento local: `http://localhost:3000/api/auth/google/callback`
     - Produção (Vercel): `https://seu-app.vercel.app/api/auth/google/callback`
5. Clique em **"Criar"** (Create).
6. Um pop-up surgirá na tela contendo:
   - **Seu ID de cliente** (Your Client ID)
   - **Sua chave secreta de cliente** (Your Client Secret)
7. Copie esses dois valores e cole-os no seu arquivo `.env` (ou configure-os como variáveis de ambiente na Vercel) nas chaves `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

---

## Dicas de Produção & Publicação
- Enquanto o projeto estiver em status de **"Testing"** (Teste) na tela de consentimento, o Google exibirá um aviso de "App não verificado" ao tentar se autenticar. Isso é normal e não impede o funcionamento! Basta o barbeiro clicar em *"Avançado"* e depois em *"Acessar Barbearia Agendamento (não seguro)"* para conceder a permissão.
- Se você quiser remover este aviso, basta clicar em **"Publicar aplicativo"** (Publish app) na aba de *Tela de consentimento OAuth*. Para uso pessoal ou de pequenos comércios, manter em modo de teste adicionando os e-mails dos barbeiros nas configurações de usuários de teste é a solução mais rápida e eficiente.
