import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { BOARD_STYLE, BOARDS } from './boards.js';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { formatSourceDocs, loadSourceDocs, type SourceDoc } from './materials.js';
import { FEEDBACK_SYSTEM, GRADE_SYSTEM, QUIZ_SYSTEM } from './prompts.js';

/* ── Formatos ───────────────────────────────────────────────────── */

export const QUESTION_TYPES = ['multipla', 'certo_errado', 'lacunas', 'discursiva'] as const;
export const DIFFICULTIES = ['facil', 'medio', 'dificil', 'pegadinha', 'oab', 'concurso'] as const;
export const ERROR_CATEGORIES = [
  'Não conhecia o conteúdo',
  'Esqueceu a informação',
  'Confundiu conceitos',
  'Interpretou a questão incorretamente',
  'Não conhecia a legislação',
  'Errou por desatenção',
  'Não conseguiu identificar a solução jurídica',
  'Utilizou fundamento inadequado',
] as const;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const quizRequestSchema = z.object({
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('material'), subjectId: id, materialIds: z.array(id).min(1).max(20) }),
    z.object({ type: z.literal('folder'), subjectId: id, folderId: id }),
    z.object({ type: z.literal('subject'), subjectId: id, topicId: id.nullable().optional() }),
    z.object({ type: z.literal('errors'), subjectId: id }),
    z.object({ type: z.literal('tema'), subjectId: id, theme: z.string().trim().min(3).max(300) }),
    z.object({ type: z.literal('quiz_erros'), subjectId: id, fromQuizId: id, indices: z.array(z.number().int().min(0)).min(1) }),
  ]),
  config: z.object({
    count: z.number().int().min(1).max(30),
    types: z.array(z.enum(QUESTION_TYPES)).min(1),
    difficulty: z.enum(DIFFICULTIES),
    mode: z.enum(['treino', 'prova', 'relampago']),
    timerSec: z.number().int().min(10).max(600).nullable().optional(),
    focus: z.enum(['geral', 'artigos', 'jurisprudencia', 'conceitos']).default('geral'),
    /** estilo de uma banca (FGV, Cebraspe…) */
    board: z.enum(BOARDS).nullable().optional(),
  }),
});
export type QuizRequest = z.infer<typeof quizRequestSchema>;

/** Formato pedido à IA (saída estruturada). */
const GeneratedItem = z.object({
  type: z.enum(QUESTION_TYPES),
  statement: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
  optionExplanations: z.array(z.string()),
  sourceDocRef: z.string().nullable(),
  sourcePage: z.number().int().nullable(),
  sourceQuote: z.string().nullable(),
  topicRef: z.string().nullable(),
  topicName: z.string(),
  difficulty: z.enum(['facil', 'medio', 'dificil']),
});
const GeneratedQuiz = z.object({ title: z.string(), questions: z.array(GeneratedItem) });

/** Questão como fica guardada no quiz. */
export interface QuizItem {
  type: (typeof QUESTION_TYPES)[number];
  statement: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  optionExplanations: string[];
  sourceMaterialId: string | null;
  sourceMaterialTitle: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
  topicId: string | null;
  topicName: string;
  difficulty: 'facil' | 'medio' | 'dificil';
}

const DIFFICULTY_TEXT: Record<(typeof DIFFICULTIES)[number], string> = {
  facil: 'fácil',
  medio: 'médio',
  dificil: 'difícil',
  pegadinha: 'pegadinha',
  oab: 'nível OAB',
  concurso: 'nível concurso',
};
const TYPE_TEXT: Record<(typeof QUESTION_TYPES)[number], string> = {
  multipla: 'múltipla escolha',
  certo_errado: 'certo ou errado',
  lacunas: 'lacunas',
  discursiva: 'discursiva curta',
};
const FOCUS_TEXT = {
  geral: '',
  artigos: 'Foque SÓ em artigos de lei e na sua literalidade (presentes nos documentos).',
  jurisprudencia: 'Foque SÓ em jurisprudência e súmulas (presentes nos documentos).',
  conceitos: 'Foque SÓ em conceitos, definições e distinções entre institutos.',
};

/** Divide a quantidade entre os tipos escolhidos (ex.: 10 em 3 tipos → 4/3/3). */
function distribute(count: number, types: readonly string[]) {
  return types.map((t, i) => ({ t, n: Math.floor(count / types.length) + (i < count % types.length ? 1 : 0) })).filter((x) => x.n > 0);
}

/* ── Fontes ─────────────────────────────────────────────────────── */

async function materialIdsFor(db: Firestore, uid: string, req: QuizRequest): Promise<string[]> {
  const s = req.source;
  const materials = userCol(db, uid, 'materials');
  const usable = (d: FirebaseFirestore.QueryDocumentSnapshot) => ['pdf', 'word', 'slides', 'note'].includes(d.get('kind'));

  if (s.type === 'material') return s.materialIds;
  if (s.type === 'folder') {
    const folders = await userCol(db, uid, 'folders').where('subjectId', '==', s.subjectId).get();
    const ids = new Set([s.folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders.docs) if (!ids.has(f.id) && ids.has(f.get('parentId'))) (ids.add(f.id), (grew = true));
    }
    const all = await materials.where('subjectId', '==', s.subjectId).get();
    return all.docs.filter((d) => usable(d) && ids.has(d.get('folderId'))).map((d) => d.id);
  }
  if (s.type === 'subject') {
    const all = await materials.where('subjectId', '==', s.subjectId).get();
    return all.docs.filter((d) => usable(d) && (!s.topicId || d.get('topicId') === s.topicId)).map((d) => d.id);
  }
  if (s.type === 'quiz_erros') {
    const prev = await userCol(db, uid, 'quizzes').doc(s.fromQuizId).get();
    return (prev.get('sourceMaterialIds') as string[] | undefined) ?? [];
  }
  return [];
}

/* ── Geração ────────────────────────────────────────────────────── */

export async function generateQuiz(db: Firestore, uid: string, req: QuizRequest) {
  const { source, config } = req;
  const subject = await userCol(db, uid, 'subjects').doc(source.subjectId).get();
  if (!subject.exists) throw new HttpError(404, 'Matéria não encontrada.');
  const topics = (await userCol(db, uid, 'topics').where('subjectId', '==', source.subjectId).get()).docs.map((d, i) => ({
    ref: `T${i + 1}`,
    id: d.id,
    name: String(d.get('name')),
  }));

  // Documentos do aluno
  const materialIds = await materialIdsFor(db, uid, req);
  const docs: SourceDoc[] = materialIds.length ? await loadSourceDocs(db, uid, materialIds.slice(0, 40)) : [];
  const needsDocs = ['material', 'folder', 'subject'].includes(source.type);
  if (needsDocs && !docs.length) {
    throw new HttpError(
      422,
      'Nenhum material com texto pronto para a IA. Envie PDF, Word, PowerPoint ou escreva anotações (e espere ficar “Pronto para IA”).',
    );
  }
  const { xml, truncated } = docs.length ? formatSourceDocs(docs) : { xml: '', truncated: false };

  // Foco extra: caderno de erros / questões erradas de um quiz anterior
  let focusBlock = '';
  if (source.type === 'errors') {
    const errors = (await userCol(db, uid, 'errors').where('subjectId', '==', source.subjectId).get()).docs
      .filter((d) => !d.get('resolved'))
      .slice(0, 30);
    if (!errors.length) throw new HttpError(422, 'Esta matéria não tem erros pendentes no caderno.');
    const lines: string[] = [];
    for (const e of errors) {
      const qid = e.get('questionId') as string | null;
      const q = qid ? await userCol(db, uid, 'questions').doc(qid).get() : null;
      const topic = topics.find((t) => t.id === e.get('topicId'))?.name;
      lines.push(
        `- Motivo: ${e.get('category')}${topic ? ` | Assunto: ${topic}` : ''}${e.get('note') ? ` | Anotação do aluno: ${e.get('note')}` : ''}${q?.exists ? ` | Questão que errou: ${String(q.get('statement')).slice(0, 400)}` : ''}`,
      );
    }
    focusBlock = `O aluno errou os pontos abaixo (caderno de erros). Crie questões NOVAS (não copie) sobre esses assuntos, atacando exatamente as confusões indicadas:\n${lines.join('\n')}`;
  }
  if (source.type === 'quiz_erros') {
    const prev = await userCol(db, uid, 'quizzes').doc(source.fromQuizId).get();
    const items = (prev.get('items') as QuizItem[] | undefined) ?? [];
    const wrong = source.indices.map((i) => items[i]).filter(Boolean) as QuizItem[];
    focusBlock = `O aluno errou as questões abaixo num quiz anterior. Crie questões NOVAS sobre os mesmos pontos (outras formulações e ângulos), sem repetir os enunciados:\n${wrong
      .map((q) => `- [${q.topicName}] ${q.statement.slice(0, 400)}`)
      .join('\n')}`;
  }

  const plan = distribute(config.count, config.types).map((x) => `${x.n} de ${TYPE_TEXT[x.t as keyof typeof TYPE_TEXT]}`);
  const instructions = [
    `Matéria: ${subject.get('name')}.`,
    `Crie exatamente ${config.count} questões: ${plan.join(', ')}.`,
    `Dificuldade pedida: ${DIFFICULTY_TEXT[config.difficulty]}.`,
    FOCUS_TEXT[config.focus],
    config.board ? `Estilo da banca: ${BOARD_STYLE[config.board]} Imite o estilo (formato do enunciado, das alternativas e o tipo de cobrança), mas crie questões NOVAS: não reproduza questões reais de provas.` : '',
    topics.length ? `Assuntos da matéria (use em topicRef):\n${topics.map((t) => `${t.ref}: ${t.name}`).join('\n')}` : 'A matéria não tem assuntos cadastrados: use topicRef = null e dê um topicName curto.',
    source.type === 'tema'
      ? `Tema pedido pelo aluno: "${source.theme}". NÃO há documentos do aluno: use conhecimento jurídico consolidado, deixe sourceDocRef/sourcePage/sourceQuote = null e redobre o cuidado com números de artigos e súmulas.`
      : source.type === 'subject' && source.topicId
        ? `Concentre-se no assunto ${topics.find((t) => t.id === source.topicId)?.name ?? ''}.`
        : '',
    focusBlock,
    docs.length ? 'Use os documentos acima como fonte. Cada questão deve ter o trecho de origem.' : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = [
    ...(xml ? [{ text: xml, cache: true }] : []),
    { text: instructions },
  ];

  const result = await generateStructured({
    schema: GeneratedQuiz,
    system: QUIZ_SYSTEM,
    content,
    effort: 'medium',
    maxTokens: Math.min(64000, 6000 + config.count * 1800),
  });

  // Validação de cada questão + troca das referências (M1, T3) pelos IDs reais
  const byRef = new Map(docs.map((d) => [d.ref, d]));
  const items: QuizItem[] = [];
  for (const q of result.questions) {
    const hasOptions = q.type === 'multipla' || q.type === 'lacunas';
    if (hasOptions) {
      const idx = Number(q.correctAnswer);
      if (q.options.length < 2 || q.options.length > 5 || !Number.isInteger(idx) || idx < 0 || idx >= q.options.length) continue;
    }
    if (q.type === 'certo_errado' && q.correctAnswer !== 'certo' && q.correctAnswer !== 'errado') continue;
    if (!q.statement.trim() || !q.correctAnswer.trim()) continue;
    const doc = q.sourceDocRef ? byRef.get(q.sourceDocRef) : undefined;
    const topic = q.topicRef ? topics.find((t) => t.ref === q.topicRef) : undefined;
    items.push({
      type: q.type,
      statement: q.statement.trim(),
      options: hasOptions ? q.options : [],
      correctAnswer: q.correctAnswer.trim(),
      explanation: q.explanation,
      optionExplanations: hasOptions && q.optionExplanations.length === q.options.length ? q.optionExplanations : [],
      sourceMaterialId: doc?.materialId ?? null,
      sourceMaterialTitle: doc?.title ?? null,
      sourcePage: doc ? q.sourcePage : null,
      sourceQuote: doc ? q.sourceQuote : null,
      topicId: topic?.id ?? null,
      topicName: topic?.name ?? q.topicName,
      difficulty: q.difficulty,
    });
  }
  if (!items.length) throw new HttpError(502, 'A IA não gerou questões válidas. Tente de novo.');

  return {
    title: result.title.slice(0, 120),
    items: items.slice(0, config.count),
    sourceMaterialIds: docs.map((d) => d.materialId),
    noMaterial: !docs.length,
    truncated,
  };
}

/** Cria o quiz (status "gerando") e gera em segundo plano; o site acompanha pelo Firestore. */
export async function startQuiz(db: Firestore, uid: string, req: QuizRequest, onFail: () => Promise<void>) {
  const ref = userCol(db, uid, 'quizzes').doc();
  const s = req.source;
  await ref.set({
    title: s.type === 'tema' ? `Quiz: ${s.theme}` : 'Novo quiz',
    subjectId: s.subjectId,
    topicId: s.type === 'subject' ? (s.topicId ?? null) : null,
    source: s,
    sourceMaterialIds: s.type === 'material' ? s.materialIds : [],
    sourceFolderId: s.type === 'folder' ? s.folderId : null,
    config: req.config,
    questionIds: [],
    items: [],
    status: 'gerando',
    createdAt: FieldValue.serverTimestamp(),
  });

  generateQuiz(db, uid, req)
    .then((r) => ref.update({ ...r, status: 'pronto', readyAt: FieldValue.serverTimestamp() }))
    .catch(async (err) => {
      const message = err instanceof HttpError ? err.message : 'Falha ao gerar o quiz.';
      if (!(err instanceof HttpError)) console.error('Falha ao gerar quiz:', err);
      await ref.update({ status: 'erro', error: message }).catch(() => {});
      await onFail().catch(() => {});
    });

  return ref.id;
}

/* ── Correção de discursiva ─────────────────────────────────────── */

const GradeSchema = z.object({
  score: z.number().int(),
  verdict: z.enum(['correta', 'parcial', 'incorreta']),
  good: z.array(z.string()),
  missing: z.array(z.string()),
  feedback: z.string(),
});

export async function gradeAnswer(db: Firestore, uid: string, quizId: string, index: number, answer: string) {
  const quiz = await userCol(db, uid, 'quizzes').doc(quizId).get();
  const item = (quiz.get('items') as QuizItem[] | undefined)?.[index];
  if (!item) throw new HttpError(404, 'Questão não encontrada.');
  const r = await generateStructured({
    schema: GradeSchema,
    system: GRADE_SYSTEM,
    effort: 'medium',
    maxTokens: 8000,
    content: [
      {
        text: [
          `Pergunta: ${item.statement}`,
          `Resposta-modelo: ${item.correctAnswer}`,
          item.sourceQuote ? `Trecho do material: "${item.sourceQuote}"` : '',
          `Resposta do aluno: ${answer.slice(0, 4000)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  });
  return { ...r, score: Math.max(0, Math.min(10, r.score)), correct: r.score >= 7 };
}

/* ── Fim do quiz: resultado + feedback ──────────────────────────── */

export const finishSchema = z.object({
  answers: z.array(
    z.object({
      index: z.number().int().min(0),
      answer: z.string().max(5000),
      correct: z.boolean(),
      contested: z.boolean().default(false),
    }),
  ),
  timeSpentSec: z.number().int().min(0).max(24 * 3600),
});

const FeedbackSchema = z.object({
  feedback: z.string(),
  weakTopics: z.array(z.string()),
  suggestions: z.array(z.object({ index: z.number().int(), category: z.enum(ERROR_CATEGORIES) })),
});

const label = (item: QuizItem, answer: string) => {
  if (item.type === 'multipla' || item.type === 'lacunas') return `${'ABCDE'[Number(answer)] ?? '?'}) ${item.options[Number(answer)] ?? ''}`;
  if (item.type === 'certo_errado') return answer === 'certo' ? 'Certo' : 'Errado';
  return answer;
};

export async function finishQuiz(db: Firestore, uid: string, quizId: string, input: z.infer<typeof finishSchema>) {
  const ref = userCol(db, uid, 'quizzes').doc(quizId);
  const quiz = await ref.get();
  if (!quiz.exists) throw new HttpError(404, 'Quiz não encontrado.');
  const items = (quiz.get('items') as QuizItem[]) ?? [];

  const counted = input.answers.filter((a) => !a.contested && items[a.index]);
  const correct = counted.filter((a) => a.correct).length;
  const total = counted.length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  const topicMap = new Map<string, { topic: string; correct: number; total: number }>();
  for (const a of counted) {
    const t = items[a.index]!.topicName || 'Geral';
    const e = topicMap.get(t) ?? { topic: t, correct: 0, total: 0 };
    e.total += 1;
    if (a.correct) e.correct += 1;
    topicMap.set(t, e);
  }
  const byTopic = [...topicMap.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);

  // Feedback escrito pela IA (se falhar, o resultado sai mesmo assim)
  let ai: z.infer<typeof FeedbackSchema> = { feedback: '', weakTopics: [], suggestions: [] };
  if (total) {
    try {
      ai = await generateStructured({
        schema: FeedbackSchema,
        system: FEEDBACK_SYSTEM,
        effort: 'low',
        maxTokens: 8000,
        content: [
          {
            text: `Nota: ${correct} de ${total}.\n\nQuestões:\n${counted
              .map((a) => {
                const it = items[a.index]!;
                return `#${a.index} [${it.topicName}] ${a.correct ? 'ACERTOU' : 'ERROU'}\nEnunciado: ${it.statement.slice(0, 600)}\nResposta do aluno: ${label(it, a.answer).slice(0, 400)}\nGabarito: ${label(it, it.correctAnswer).slice(0, 400)}`;
              })
              .join('\n\n')}`,
          },
        ],
      });
    } catch (err) {
      console.warn('Feedback da IA indisponível:', (err as Error).message);
      ai.feedback = byTopic.length ? `Revise principalmente: ${byTopic.filter((t) => t.correct < t.total).map((t) => t.topic).join(', ') || 'nada — mandou bem!'}.` : '';
    }
  }

  const contested = input.answers.filter((a) => a.contested).map((a) => a.index);
  const wrongIdx = new Set(counted.filter((a) => !a.correct).map((a) => a.index));
  const suggestions = ai.suggestions.filter((s) => wrongIdx.has(s.index));
  const resultRef = userCol(db, uid, 'quizResults').doc();
  const result = {
    quizId,
    subjectId: quiz.get('subjectId') ?? null,
    score,
    total,
    correct,
    timeSpentSec: input.timeSpentSec,
    weakTopics: ai.weakTopics.slice(0, 5),
    byTopic,
    feedback: ai.feedback,
    contested,
    // respostas e sugestões ficam guardadas para revisar depois (mesmo recarregando a página)
    answers: input.answers,
    suggestions,
    createdAt: FieldValue.serverTimestamp(),
  };
  await resultRef.set(result);
  await ref.update({ result: { score, total, correct, timeSpentSec: input.timeSpentSec, resultId: resultRef.id }, contested, finishedAt: FieldValue.serverTimestamp() });
  return { resultId: resultRef.id, ...result, createdAt: null };
}
