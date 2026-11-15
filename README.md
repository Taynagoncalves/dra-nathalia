# Plataforma de Estudos e Prática Jurídica

Plataforma pessoal de estudos (faculdade, OAB, concursos, pós, cursos) com materiais, questões,
caderno de erros, calendário e desempenho. Etapas futuras: quizzes com IA, Modo Professora e
Simulador Jurídico.

```
/client   → React + Vite + TypeScript + Tailwind (app)
/server   → Node + Express + TypeScript (assinaturas do Cloudinary e, depois, a IA)
firestore.rules · firestore.indexes.json · firebase.json
```

---

## Rodando localmente

Requisitos: **Node 20+** (testado no 24).

```bash
npm install                 # instala client e server (npm workspaces)

cp client/.env.example client/.env
cp server/.env.example server/.env
# preencha os dois .env (veja as seções abaixo)

npm run dev                 # sobe client (http://localhost:5173) e server (http://localhost:3001)
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run dev:client` / `npm run dev:server` | sobe só um dos lados |
| `npm run typecheck` | checa os tipos do client e do server |
| `npm test` | testes unitários (Vitest) |
| `npm run build` | build de produção |

> **Sem credenciais ainda?** O app abre uma tela explicando o que falta, e a página
> **`/tema-preview`** funciona mesmo assim. O server sobe e avisa no terminal o que está pendente;
> `GET /api/health` mostra o status.

Em desenvolvimento, o Vite redireciona `/api` para o server, então `VITE_API_URL` pode ficar vazio.

---

## 1. Firebase (Auth + Firestore)

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto**.
2. **Authentication** → *Vamos começar* → aba **Método de login**:
   - ative **E-mail/senha**;
   - ative **Google** (escolha um e-mail de suporte).
3. **Firestore Database** → *Criar banco de dados* → modo de **produção** → região
   `southamerica-east1` (São Paulo).
4. **Configurações do projeto** (engrenagem) → **Seus apps** → ícone **Web `</>`** → registre o app.
   Copie os valores do `firebaseConfig` para `client/.env`:

   | firebaseConfig | client/.env |
   |---|---|
   | apiKey | `VITE_FIREBASE_API_KEY` |
   | authDomain | `VITE_FIREBASE_AUTH_DOMAIN` |
   | projectId | `VITE_FIREBASE_PROJECT_ID` |
   | storageBucket | `VITE_FIREBASE_STORAGE_BUCKET` |
   | messagingSenderId | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | appId | `VITE_FIREBASE_APP_ID` |

   Essas chaves do client são públicas por natureza; quem protege os dados são as `firestore.rules`.
5. Ao publicar o site, adicione o domínio em **Authentication → Configurações → Domínios autorizados**
   (o `localhost` já vem liberado).

### Service account do `firebase-admin` (server)

O server usa o `firebase-admin` para validar o login de quem chama a API.

1. **Configurações do projeto → Contas de serviço** → **Gerar nova chave privada**.
2. Salve o JSON como `server/serviceAccount.json` (já está no `.gitignore` — **nunca** faça commit dele).
3. Em `server/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json`
   - Em hospedagens sem arquivo, use `FIREBASE_SERVICE_ACCOUNT_JSON` com o JSON inteiro em uma linha.

### Publicar as regras e os índices do Firestore

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # escolha o projeto (cria o .firebaserc)
firebase deploy --only firestore:rules,firestore:indexes
```

Regra principal: cada usuário só lê e escreve dentro de `users/{uid}`, com `uid == request.auth.uid`.

---

## 2. Cloudinary (arquivos e imagens)

1. Crie uma conta em <https://cloudinary.com> (o plano gratuito serve).
2. No **Dashboard** (ou *Settings → API Keys*), copie para `server/.env`:
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`.
3. **O secret fica só no server.** O client não tem nenhuma variável do Cloudinary: ele pede uma
   assinatura em `POST /api/cloudinary/signature` e envia o arquivo direto para o Cloudinary.
4. **Liberar PDF:** no plano gratuito do Cloudinary, a entrega de PDF pode vir bloqueada por padrão.
   Para liberar, ative **"Allow delivery of PDF and ZIP files"** em **Settings → Security**.

Detalhes:

- Pastas: `estudos/{uid}/{subjectId}/` (materiais) e `estudos/{uid}/perfil/` (foto).
- Tipos: PDF e imagens → `resource_type: image` (o PDF ganha miniatura da 1ª página);
  Word e PowerPoint → `resource_type: raw`.
- Limite por arquivo: `MAX_UPLOAD_MB` (server) e `VITE_MAX_UPLOAD_MB` (client) — mantenha iguais.
  O plano gratuito aceita até 10 MB.
- Exclusão: o server confere se o `publicId` está dentro de `estudos/{uid}/` antes de apagar.
- Os links do Cloudinary são públicos (mas difíceis de adivinhar). Isso é necessário para a
  prévia de Word/PowerPoint pelo Office Online Viewer.

---

## 3. Deploy no Render

São **dois serviços**: o site (estático) e a API (Node). O arquivo `render.yaml` já descreve os dois.

**Opção A — Blueprint (recomendado):** Render → **New → Blueprint** → escolha o repositório.
Preencha os valores pedidos no painel.

**Opção B — manual:**

| | Site (Static Site) | API (Web Service, Node) |
|---|---|---|
| Runtime | Static | **Node** |
| Root Directory | `client` | `server` |
| Build command | `npm install && npm run build` | `npm install && npm run build` |
| Publish directory / Start command | `dist` | `npm start` |
| Health check path | — | `/api/health` |
| Variáveis | todas as `VITE_*` do `client/.env.example` + `VITE_API_URL` = URL da API | as do `server/.env.example` (inclusive `VAPID_*` e `CRON_SECRET`), com `CLIENT_ORIGIN` = URL do site |

Depois de criar, **não esqueça**:

1. **Rewrite do site** (só na opção B): *Static Site → Redirects/Rewrites* → Source `/*`,
   Destination `/index.html`, Action **Rewrite**. Sem isso, recarregar em `/perfil` dá 404.
2. **Service account:** na API, *Environment → Secret Files* → arquivo `serviceAccount.json` com o
   JSON do Firebase, e `FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/serviceAccount.json`.
3. **Firebase → Authentication → Configurações → Domínios autorizados:** adicione o domínio do site
   (`seu-site.onrender.com`), senão o login com Google falha.
4. As variáveis `VITE_*` entram **no build**: depois de mudá-las, faça um novo deploy do site.
5. No plano gratuito, a API "dorme" após ~15 min sem uso; a primeira chamada depois disso pode
   levar ~50 s (o upload de arquivos é o que vai sentir).

---

## 4. App no celular (PWA) e notificações

- **Instalar:** Perfil → *App e notificações* → **Instalar app** (Android/Chrome/Edge). No iPhone:
  Safari → Compartilhar → *Adicionar à Tela de Início*. O ícone é a balança ⚖️ (`client/public/icons`).
- **Notificações no aparelho (mesmo com o site fechado):** Perfil → **Ativar notificações**. No iPhone, só
  funciona com o app instalado (iOS 16.4+).
- **O que é avisado:** eventos do calendário **7 dias, 3 dias e 1 dia antes, e no dia** (a partir das 7h) e
  **sequência em risco** às 19h. Tudo também aparece no sino 🔔 do site. Cada lembrete é enviado uma vez só.
- **Como funciona:** o server envia Web Push com chaves VAPID próprias (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`,
  geradas com `npx web-push generate-vapid-keys`). A rotina `server/src/jobs/reminders.ts` roda a cada 30 min
  enquanto o server está acordado e é chamada **de hora em hora pelo GitHub Actions**
  (`.github/workflows/lembretes.yml`), que também acorda o server gratuito do Render.

### Configurar o agendador (GitHub Actions)

GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `API_URL` | URL do server no Render, ex.: `https://dra-nathalia-server.onrender.com` |
| `CRON_SECRET` | o mesmo valor de `CRON_SECRET` do `server/.env` |

Teste em **Actions → Lembretes → Run workflow**. (O GitHub pausa agendamentos de repositórios sem commits
por 60 dias — se isso acontecer, é só reativar na aba Actions.)

---

## 5. Inteligência Artificial (Etapa 2)

A IA roda **só no server** (`server/src/ai/`); a chave nunca vai para o navegador. Há dois provedores:

| | Gemini (Google) — **padrão** | Claude (Anthropic) — opcional |
|---|---|---|
| Custo | **gratuito** (plano free do Google AI Studio, com limites por minuto e por dia) | pago por uso |
| Chave | <https://aistudio.google.com/apikey> (conta Google, sem cartão) | <https://console.anthropic.com> → API Keys |
| Variáveis | `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MODEL` |

1. Gere a chave do Gemini e coloque em `server/.env` (e nas variáveis do server no Render): `GEMINI_API_KEY=...`
2. Reinicie o server. `GET /api/health` deve mostrar `"ai": true`.

> **Privacidade no plano gratuito:** o Google pode usar o conteúdo enviado no plano gratuito para melhorar
> os produtos dele (inclusive com revisão humana). Para apostilas e anotações de estudo não há problema;
> **não envie documentos com dados pessoais de terceiros** (ex.: peças reais de clientes). No plano pago do
> Gemini ou com o Claude, os dados não são usados para treino.

`AI_DAILY_LIMIT` (padrão 30) limita os usos por pessoa por dia. `GEMINI_MODEL` (padrão `gemini-3.6-flash`) é o
modelo principal; `GEMINI_FALLBACK_MODELS` são reservas usadas se ele estiver sobrecarregado. Se o plano gratuito atingir o limite do Google, o site avisa para tentar
mais tarde.

**Como funciona**

- **Materiais → texto:** ao enviar PDF, Word (.docx) ou PowerPoint (.pptx), o server extrai o texto
  (pdf-parse, mammoth, jszip) e guarda em `materials/{id}/chunks` (texto, página, ordem). O card mostra
  *Processando…* → *Pronto para IA*. Anotações são lidas na hora. PDFs escaneados (só imagem) e .doc/.ppt
  antigos aparecem como *Sem texto p/ IA*.
- **Quiz com IA:** de um material, de uma pasta (com subpastas), da matéria/assunto, do caderno de erros, de
  um tema livre ou "só o que errei". Modos treino, prova e relâmpago; múltipla escolha, certo/errado,
  lacunas e discursiva (corrigida pela IA). Cada questão traz gabarito comentado, explicação de cada
  alternativa e o **trecho de origem** com link para o material na página certa.
- **Respostas em JSON validado:** saídas estruturadas + zod; se vier inválido, tenta de novo uma vez.
- **Integridade jurídica:** o prompt proíbe inventar artigos, súmulas e julgados e pede para dizer quando
  não há certeza (`server/src/ai/prompts.ts`).
- **Caderno IA (estilo NotebookLM):** dentro de cada matéria (aba *Caderno IA*) ou pelo menu. Você marca as
  fontes (PDFs, Word, PowerPoint, anotações) e: **conversa** com elas — cada afirmação vem com [n], o trecho
  citado e o link para a página — ou gera no **Estúdio** resumo, guia de estudo, perguntas frequentes, linha do
  tempo e mapa mental (ficam salvos). Se a pergunta não estiver nos materiais, a resposta avisa. O NotebookLM
  do Google não tem API pública, por isso a experiência foi recriada aqui com o Gemini.
- **Formato garantido:** no Gemini, `responseJsonSchema`; no Claude, saídas estruturadas + *fallback* do
  servidor em caso de recusa. Nos dois, a resposta é validada com zod.
- **Limites:** cada quiz lê no máximo ~180 mil caracteres do material. O limite diário (`AI_DAILY_LIMIT`) e o
  contador em `users/{uid}/aiUsage` (só o server escreve) controlam o uso. Falhas não contam no limite.

---

## API (`/server`)

Todas as rotas, exceto `/api/health`, exigem `Authorization: Bearer <Firebase ID Token>`.

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/health` | status (público) |
| POST | `/api/cloudinary/signature` | `{ purpose: 'material', subjectId }` ou `{ purpose: 'avatar' }` |
| DELETE | `/api/cloudinary/:publicId?resourceType=image\|raw` | exclui um arquivo do usuário |
| POST | `/api/cloudinary/delete-batch` | `{ items: [{ publicId, resourceType }] }` |
| DELETE | `/api/folders/:id?mode=moveUp|cascade` | exclui pasta (conteúdo sobe um nível, ou apaga tudo + arquivos) |
| DELETE | `/api/subjects/:id` | exclui a matéria com tudo dela (inclusive os arquivos) |
| GET | `/api/push/public-key` | chave VAPID pública |
| POST | `/api/push/subscribe` · `/api/push/unsubscribe` · `/api/push/test` | notificações do aparelho |
| POST | `/api/cron/lembretes` | rotina de lembretes (cabeçalho `x-cron-secret`, sem login) |
| GET | `/api/ai/status` | IA configurada? usos de hoje / limite |
| POST | `/api/ai/materials/:id/process` | extrai o texto do material para a IA |
| POST | `/api/ai/quizzes` | começa a gerar um quiz (status acompanhado pelo Firestore) |
| POST | `/api/ai/quizzes/:id/finish` | resultado + feedback da IA + categoria sugerida dos erros |
| POST | `/api/ai/grade` | corrige uma resposta discursiva |
| POST | `/api/ai/notebook/chat` | Caderno IA: pergunta sobre as fontes (resposta com citações) |
| DELETE | `/api/ai/notebook/chat/:subjectId` | limpa a conversa da matéria |
| POST | `/api/ai/decks` · `/api/ai/teach/evaluate` | slides com IA · avaliação do ensino oral |
| POST | `/api/ai/tayna/question` · `answer` · `feedback` | perguntas, reações e feedback da Tayna |
| POST | `/api/live` · `/api/live/:code/suggest` · `evaluate` · `end` | sessão ao vivo (Tayna de verdade) |
| POST | `/api/ai/plan` | plano do dia (“O que devo estudar agora?” com IA) |
| POST | `/api/ai/notebook/studio` | Caderno IA: resumo, guia, FAQ, linha do tempo ou mapa mental |
| DELETE | `/api/projects/:id` | exclui o projeto com todas as matérias e o conteúdo delas |

---

## Tema (claro / escuro)

- Cores definidas **só** em `client/src/index.css`, como variáveis CSS semânticas em `:root` (claro)
  e `.dark` (escuro): `--bg`, `--surface`, `--surface-elevated`, `--border`, `--primary`,
  `--primary-hover`, `--primary-soft`, `--primary-text`, `--on-primary`, `--text`, `--text-muted`,
  `--success`, `--error`, `--warning`, `--info`, `--chart-1…5`.
- Viram classes do Tailwind (`bg-surface`, `text-text-muted`, `border-border`, `bg-primary`,
  `text-on-primary`, `text-primary-text`…). **Nos componentes, use só essas classes** — nunca
  `bg-purple-600` e afins.
- Opções: Claro, Escuro e Automático (padrão). Salvo no `localStorage` (chave `tema`) e em
  `users/{uid}.settings.theme`.
- Gráficos: use `client/src/components/charts/chartTheme.ts`.
- Cores de pasta escolhidas pelo usuário: use `readableTextOn()` de `client/src/lib/color.ts` para o
  texto sobre elas.
- **Cor principal personalizável** (Perfil → Aparência), uma para cada modo. `client/src/lib/accent.ts` calcula hover, fundo suave, texto sobre o botão e cor de link a partir da cor escolhida, garantindo contraste AA (testado em `accent.test.ts`). Salva em `settings.accentLight/accentDark` e no localStorage (`tema-cores-css`, aplicado pelo index.html antes do React).
- Prévia de tudo: **`/tema-preview`** (página temporária).

---

## Status do desenvolvimento (Etapa 1)

- [x] Parte 1 — Setup, autenticação e sistema de temas
- [x] Parte 2 — Layout (sidebar) e perfil
- [x] Parte 3 — Projetos, matérias, assuntos e timer de estudo
- [x] Parte 4 — Materiais com pastas (4a pastas · 4b upload · 4c visualização · 4d organização)
- [x] Parte 5 — Banco de questões
- [x] Parte 6 — Caderno de erros
- [x] Parte 7 — Calendário
- [x] Parte 8 — Desempenho
- [x] Parte 9 — Dashboard
- [x] Extras — cor principal personalizável, excluir projeto, app instalável (PWA) com ícone, notificações e lembretes

**Etapa 1 concluída.**

### Etapa 2 (IA)

- [x] Base da IA: módulo `server/ai`, extração de texto em trechos, JSON validado, limite diário
- [x] Gerador de Quiz com IA (todas as origens, modos, correção de discursivas, feedback, contestar, salvar no banco)
- [x] Caderno IA (estilo NotebookLM): chat com as fontes e citações + estúdio (resumo, guia, FAQ, linha do tempo, mapa mental)
- [x] Resumos automáticos (“Resumir com IA” no material), revisões inteligentes (intervalo adaptado ao acerto) e plano do dia com IA

**Etapa 2 concluída.**

### Etapa 3 (Modo Professora)

- [x] Slides gerados pela IA (5 modelos), editáveis e reordenáveis
- [x] Ensino oral: fala transcrita (Web Speech API, pt-BR) e avaliada (conceitos, omissões, clareza, coerência)
- [x] Modo Tayna: nível, momento, personalidade e voz/texto; reage como colega (boa → “entendi!”, incompleta → acompanhamento, errada → anota); feedback final, quiz do que errou e caderno de erros
- [x] Tayna de verdade: sessão ao vivo com código (`/ao-vivo/CÓDIGO`), convidado entra sem conta (login anônimo), slide sincronizado, perguntas sugeridas com gabarito escondido e avaliação pela IA. Regras: só quem tem o código abre, e só enquanto a sessão está ativa

> A transcrição de voz funciona no Chrome e no Edge (computador e Android). Sem suporte, dá para digitar.

**Etapa 3 concluída.**
