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
| Variáveis | todas as `VITE_*` do `client/.env.example` + `VITE_API_URL` = URL da API | as do `server/.env.example`, com `CLIENT_ORIGIN` = URL do site |

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
- Prévia de tudo: **`/tema-preview`** (página temporária).

---

## Status do desenvolvimento (Etapa 1)

- [x] Parte 1 — Setup, autenticação e sistema de temas
- [x] Parte 2 — Layout (sidebar) e perfil
- [x] Parte 3 — Projetos, matérias, assuntos e timer de estudo
- [x] Parte 4 — Materiais com pastas (4a pastas · 4b upload · 4c visualização · 4d organização)
- [x] Parte 5 — Banco de questões
- [x] Parte 6 — Caderno de erros
- [ ] Parte 7 — Calendário
- [ ] Parte 8 — Desempenho
- [ ] Parte 9 — Dashboard
