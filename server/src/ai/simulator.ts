import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { jobErrorMessage, notifyUser } from '../lib/notify.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { formatSourceDocs, loadSourceDocs } from './materials.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/**
 * Etapa 4 — Simulador de Prática Jurídica.
 * - cases/{id}: o caso fictício (narrativa, documentos e a situação de cada papel)
 * - caseKeys/{id}: a peça esperada para cada papel (só o server lê; o aluno descobre sozinho)
 * - simulations/{id}: a tentativa (papel sorteado, texto, correção)
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const AREAS = ['civil', 'consumidor', 'familia', 'penal', 'trabalho', 'administrativo', 'tributario', 'constitucional', 'empresarial', 'previdenciario'] as const;
const AREA_TEXT: Record<(typeof AREAS)[number], string> = {
  civil: 'Direito Civil (contratos, responsabilidade civil, obrigações)',
  consumidor: 'Direito do Consumidor',
  familia: 'Direito de Família e Sucessões',
  penal: 'Direito Penal e Processo Penal',
  trabalho: 'Direito do Trabalho e Processo do Trabalho',
  administrativo: 'Direito Administrativo',
  tributario: 'Direito Tributário',
  constitucional: 'Direito Constitucional (remédios constitucionais)',
  empresarial: 'Direito Empresarial',
  previdenciario: 'Direito Previdenciário',
};
export const DIFFICULTIES = ['facil', 'medio', 'dificil'] as const;
export const ROLES = ['autor', 'reu', 'magistrado'] as const;
type Role = (typeof ROLES)[number];

export const caseSchema = z.object({
  area: z.enum(AREAS),
  difficulty: z.enum(DIFFICULTIES),
  subjectId: id.nullable().optional(),
  theme: z.string().trim().max(200).optional(),
});

const DOC_KINDS = ['contrato', 'conversa', 'comprovante', 'decisao', 'notificacao', 'email', 'boletim', 'laudo', 'peticao', 'outro'] as const;

const CaseOut = z.object({
  title: z.string(),
  summary: z.string(),
  facts: z.string(),
  parties: z.object({ autor: z.string(), reu: z.string() }),
  documents: z.array(
    z.object({
      kind: z.enum(DOC_KINDS),
      title: z.string(),
      date: z.string().nullable(),
      content: z.string(),
    }),
  ),
  roles: z.object({ autor: z.string(), reu: z.string(), magistrado: z.string() }),
  keys: z.object({
    autor: z.object({ piece: z.string(), essentials: z.array(z.string()) }),
    reu: z.object({ piece: z.string(), essentials: z.array(z.string()) }),
    magistrado: z.object({ piece: z.string(), essentials: z.array(z.string()) }),
  }),
});

const CASE_SYSTEM = `Você cria casos concretos FICTÍCIOS para treino de prática jurídica no Brasil (estilo 2ª fase da OAB e estágio).

${LEGAL_INTEGRITY}

Regras do caso:
- Pessoas, empresas, CPFs, CNPJs, endereços e números de processo são inventados e claramente fictícios (ex.: CPF 000.000.000-00). Nada de pessoas ou empresas reais.
- title: título curto e neutro que descreve o conflito, como manchete (ex.: "A TV que apagou depois de 20 dias"). Não use a palavra "ação" nem nomes de peças, ações ou recursos. summary: 1 a 2 frases. facts: a narrativa dos fatos (3 a 6 parágrafos), com datas, valores e detalhes que importam para a solução (prazos, provas, contradições).
- documents: 3 a 6 documentos do caso, com conteúdo realista e completo o suficiente para ser usado como prova: contratos (cláusulas numeradas), conversas (uma fala por linha, no formato "Nome (dd/mm hh:mm): mensagem"), comprovantes, notificações, e-mails, boletins, laudos, decisões. Pelo menos um documento deve conter um detalhe decisivo para a solução.
- roles: a situação vista por cada papel, em 2ª pessoa, SEM dizer qual peça fazer:
  - autor: "Você é procurado(a) por …" (o que o cliente quer);
  - reu: "Você representa …, que recebeu …" (resuma o que a outra parte pede contra o cliente, com os pedidos);
  - magistrado: "Os autos chegaram conclusos …" (resuma o que cada parte alegou e pediu e o que foi produzido de prova).
- keys: para cada papel, a peça cabível (piece, ex.: "Petição inicial de ação de indenização por danos materiais e morais", "Contestação", "Sentença") e os pontos essenciais (essentials, 5 a 8 itens: competência, pedidos, teses e fundamentos que uma boa resposta precisa ter). Use só fundamentos amplamente consolidados.
- O caso deve fazer sentido para os três papéis.`;

const DIFF_TEXT = { facil: 'fácil (uma tese principal, fatos diretos)', medio: 'médio (duas teses e um detalhe de prova)', dificil: 'difícil (preliminares, teses concorrentes e uma pegadinha processual legítima)' };

/** Tarefa "presa" (o server reiniciou no meio): depois disso pode ser refeita. */
export const STALE_JOB_MS = 10 * 60_000;

/**
 * Cria o caso já com status "gerando" e responde na hora com o ID;
 * a IA preenche em segundo plano e a pessoa é avisada quando terminar.
 */
export async function startCase(db: Firestore, uid: string, input: z.infer<typeof caseSchema>, onFail: () => Promise<void>) {
  let subjectName: string | null = null;
  if (input.subjectId) {
    const subject = await userCol(db, uid, 'subjects').doc(input.subjectId).get();
    if (!subject.exists) throw new HttpError(404, 'Matéria não encontrada.');
    subjectName = subject.get('name');
  }
  const ref = userCol(db, uid, 'cases').doc();
  await ref.set({
    title: 'Montando o caso…',
    summary: '',
    facts: '',
    parties: { autor: '', reu: '' },
    documents: [],
    roles: { autor: '', reu: '', magistrado: '' },
    area: input.area,
    difficulty: input.difficulty,
    subjectId: input.subjectId ?? null,
    status: 'gerando',
    jobStartedAt: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
  const url = `/simulador/casos/${ref.id}`;
  generateCase(db, uid, input, subjectName, ref)
    .then((title) => notifyUser(db, uid, { title: 'Seu caso está pronto', body: `${title}. Gire a roleta para sortear o seu papel.`, url, tag: `caso-${ref.id}` }))
    .catch(async (err) => {
      const error = jobErrorMessage(err, 'Não foi possível gerar o caso.');
      await ref.update({ status: 'erro', error }).catch(() => {});
      await onFail().catch(() => {});
      await notifyUser(db, uid, { title: 'O caso não foi gerado', body: error, url: '/simulador', tag: `caso-${ref.id}` });
    });
  return ref.id;
}

async function generateCase(db: Firestore, uid: string, input: z.infer<typeof caseSchema>, subjectName: string | null, ref: FirebaseFirestore.DocumentReference) {
  let xml = '';
  if (input.subjectId) {
    const mats = await userCol(db, uid, 'materials').where('subjectId', '==', input.subjectId).get();
    const ids = mats.docs.filter((d) => d.get('kind') === 'note' || d.get('aiStatus') === 'pronto').map((d) => d.id);
    const docs = await loadSourceDocs(db, uid, ids.slice(0, 20));
    if (docs.length) xml = formatSourceDocs(docs, 60_000).xml;
  }
  const r = await generateStructured({
    schema: CaseOut,
    system: CASE_SYSTEM,
    effort: 'medium',
    maxTokens: 20000,
    content: [
      ...(xml ? [{ text: `Materiais do aluno (use como inspiração para o tema e os fundamentos):\n${xml}`, cache: true }] : []),
      {
        text: [
          `Área: ${AREA_TEXT[input.area]}.`,
          `Dificuldade: ${DIFF_TEXT[input.difficulty]}.`,
          subjectName ? `Matéria do aluno: ${subjectName}.` : '',
          input.theme ? `Tema pedido: ${input.theme}.` : '',
          'Crie um caso novo e original.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });
  const title = r.title.slice(0, 150);
  const batch = db.batch();
  batch.update(ref, {
    title,
    summary: r.summary,
    facts: r.facts,
    parties: r.parties,
    documents: r.documents.slice(0, 8),
    roles: r.roles,
    status: 'pronto',
  });
  batch.set(userCol(db, uid, 'caseKeys').doc(ref.id), { ...r.keys, createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return title;
}

/* ── Correção ───────────────────────────────────────────────────── */

export const CRITERIA = [
  { key: 'peca', label: 'Peça adequada' },
  { key: 'competencia', label: 'Endereçamento e competência' },
  { key: 'estrutura', label: 'Estrutura e qualificação' },
  { key: 'fatos', label: 'Fatos ou relatório' },
  { key: 'fundamentacao', label: 'Fundamentação jurídica' },
  { key: 'pedidos', label: 'Pedidos ou dispositivo' },
  { key: 'provas', label: 'Uso das provas e documentos' },
  { key: 'linguagem', label: 'Linguagem e técnica' },
] as const;

const ERROR_CATEGORIES = [
  'Não conhecia o conteúdo',
  'Esqueceu a informação',
  'Confundiu conceitos',
  'Interpretou a questão incorretamente',
  'Não conhecia a legislação',
  'Errou por desatenção',
  'Não conseguiu identificar a solução jurídica',
  'Utilizou fundamento inadequado',
] as const;

const Correction = z.object({
  identifiedPiece: z.string(),
  pieceCorrect: z.boolean(),
  criteria: z.array(z.object({ key: z.enum(CRITERIA.map((c) => c.key) as [string, ...string[]]), score: z.number(), comment: z.string() })),
  summary: z.string(),
  strengths: z.array(z.string()),
  errors: z.array(z.object({ error: z.string(), why: z.string(), fix: z.string(), category: z.enum(ERROR_CATEGORIES) })),
  lines: z.array(z.object({ line: z.number().int(), status: z.enum(['ajustar', 'erro']), suggestion: z.string(), comment: z.string() })),
  modelAnswer: z.string(),
});

const ROLE_TEXT: Record<Role, string> = { autor: 'advogado(a) do autor', reu: 'advogado(a) do réu', magistrado: 'magistrado(a)' };

const CORRECT_SYSTEM = `Você é examinador(a) de prática jurídica (estilo 2ª fase da OAB) e corrige a peça de um aluno sobre um caso fictício. A correção é educacional.

${LEGAL_INTEGRITY}

Como corrigir:
- identifiedPiece: qual peça o aluno fez (pelo conteúdo). pieceCorrect: se é a peça cabível (compare com o gabarito; aceite variações equivalentes).
- criteria: exatamente 8 itens, um para cada chave (peca, competencia, estrutura, fatos, fundamentacao, pedidos, provas, linguagem), nota de 0 a 10 e um comentário específico (1 a 3 frases). Se a peça for incabível, a nota de "peca" é no máximo 2 e as demais refletem o aproveitamento real.
- Para magistrado: "fatos" = relatório, "pedidos" = dispositivo, "competencia" = análise de competência/preliminares.
- errors ("Meus erros nesta atividade"): cada erro real e relevante (até 10), com o que está errado, por que está errado e como corrigir, e a categoria do caderno de erros que melhor o explica. Não invente erros.
- lines: o texto do aluno vem com as linhas numeradas [L1], [L2]… Liste SOMENTE as linhas que precisam de ajuste ou estão erradas (até 40), com a sugestão reescrita (a linha corrigida inteira) e um comentário curto. Use o número da linha informado.
- strengths: o que o aluno fez bem. summary: 3 a 5 frases.
- modelAnswer: uma resposta-modelo completa da peça cabível, bem estruturada (endereçamento, qualificação, fatos/relatório, fundamentos, pedidos/dispositivo, fechamento), usando os fatos e os documentos do caso. Use os nomes fictícios do caso. Não invente número de artigo de que não tenha certeza.
- Seja justo e rigoroso: aceite outras palavras quando o conteúdo jurídico estiver correto.`;

/**
 * Confere a peça, marca "corrigindo" e responde na hora; a correção roda em
 * segundo plano e a pessoa é avisada (no site e no celular) quando terminar.
 */
export async function startCorrection(db: Firestore, uid: string, simulationId: string, onFail: () => Promise<void>) {
  const simRef = userCol(db, uid, 'simulations').doc(simulationId);
  const sim = await simRef.get();
  if (!sim.exists) throw new HttpError(404, 'Simulação não encontrada.');
  if (sim.get('status') === 'corrigida') throw new HttpError(409, 'Esta peça já foi corrigida.');
  if (sim.get('status') === 'corrigindo' && Date.now() - Number(sim.get('jobStartedAt') ?? 0) < STALE_JOB_MS) {
    throw new HttpError(409, 'Esta peça já está sendo corrigida.');
  }
  const text = String(sim.get('text') ?? '').trim();
  if (text.length < 200) throw new HttpError(422, 'A peça está muito curta para corrigir (mínimo de 200 caracteres).');
  if (text.length > 60_000) throw new HttpError(422, 'A peça passou do limite de 60 mil caracteres.');
  const role = sim.get('role') as Role;
  const caseId = String(sim.get('caseId'));
  const [caseSnap, keySnap] = await Promise.all([userCol(db, uid, 'cases').doc(caseId).get(), userCol(db, uid, 'caseKeys').doc(caseId).get()]);
  if (!caseSnap.exists) throw new HttpError(404, 'O caso desta simulação foi excluído.');
  const c = caseSnap.data()!;
  const key = keySnap.get(role) as { piece: string; essentials: string[] } | undefined;

  const lines = text.split(/\r?\n/);
  const numbered = lines.map((l, i) => `[L${i + 1}] ${l}`).join('\n');
  const docs = (c.documents as { kind: string; title: string; date: string | null; content: string }[])
    .map((d, i) => `Documento ${i + 1} — ${d.title} (${d.kind}${d.date ? `, ${d.date}` : ''}):\n${d.content}`)
    .join('\n\n');

  await simRef.update({ status: 'corrigindo', jobStartedAt: Date.now(), correctionError: FieldValue.delete() });
  const url = `/simulador/pecas/${simulationId}`;
  const caseTitle = String(c.title);

  const run = async () => {
    const r = await generateStructured({
      schema: Correction,
      system: CORRECT_SYSTEM,
      effort: 'high',
      maxTokens: 30000,
      content: [
        {
          text: [
            `CASO: ${c.title}\n${c.facts}`,
            `Partes: autor — ${c.parties?.autor}; réu — ${c.parties?.reu}`,
            `DOCUMENTOS:\n${docs}`,
            `PAPEL DO ALUNO: ${ROLE_TEXT[role]}. Situação apresentada a ele: ${c.roles?.[role]}`,
            key ? `GABARITO (não revele como "gabarito"; use para corrigir): peça cabível — ${key.piece}. Pontos essenciais: ${key.essentials.join('; ')}` : 'Sem gabarito salvo: determine você a peça cabível.',
            `PEÇA DO ALUNO (título dado por ele: ${sim.get('pieceTitle') || 'sem título'}):\n${numbered}`,
          ].join('\n\n'),
        },
      ],
    });

    const byKey = new Map(r.criteria.map((x) => [x.key, x]));
    const criteria = CRITERIA.map((c) => {
      const got = byKey.get(c.key);
      return { key: c.key, label: c.label, score: Math.max(0, Math.min(10, Math.round((got?.score ?? 0) * 10) / 10)), comment: got?.comment ?? 'Sem comentário.' };
    });
    const overall = Math.round((criteria.reduce((s, x) => s + x.score, 0) / criteria.length) * 10);
    const seen = new Set<number>();
    const lineFixes = r.lines
      .filter((l) => l.line >= 1 && l.line <= lines.length && !seen.has(l.line) && seen.add(l.line))
      .map((l) => ({ ...l, index: l.line - 1 }));

    const correction = {
      overall,
      expectedPiece: key?.piece ?? r.identifiedPiece,
      identifiedPiece: r.identifiedPiece,
      pieceCorrect: r.pieceCorrect,
      criteria,
      summary: r.summary,
      strengths: r.strengths,
      errors: r.errors.slice(0, 10),
      lines: lineFixes.slice(0, 40).map(({ index, status, suggestion, comment }) => ({ index, status, suggestion, comment })),
      modelAnswer: r.modelAnswer,
      essentials: key?.essentials ?? [],
    };
    await simRef.update({ status: 'corrigida', correction, score: overall, submittedAt: FieldValue.serverTimestamp() });
    return overall;
  };

  run()
    .then((overall) => notifyUser(db, uid, { title: `Peça corrigida: ${overall}/100`, body: `${caseTitle} — ${ROLE_TEXT[role]}. Veja a correção e o modelo de resposta.`, url, tag: `peca-${simulationId}` }))
    .catch(async (err) => {
      const error = jobErrorMessage(err, 'Não foi possível corrigir a peça.');
      await simRef.update({ status: 'rascunho', correctionError: error }).catch(() => {});
      await onFail().catch(() => {});
      await notifyUser(db, uid, { title: 'A correção não terminou', body: `${error} O seu texto continua salvo.`, url, tag: `peca-${simulationId}` });
    });
}
