import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { jobErrorMessage, notifyUser } from '../lib/notify.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { LEGAL_INTEGRITY } from './prompts.js';
import { AREAS, DIFFICULTIES, STALE_JOB_MS } from './simulator.js';

/**
 * Etapa 5 — "Um dia na prática jurídica": a IA monta a agenda de um dia de
 * trabalho (atendimento, prazo, audiência, redação, e-mail ao cliente…),
 * o aluno resolve cada tarefa e, no fim do expediente, a IA avalia tudo.
 * Coleção: users/{uid}/practiceDays/{id}.
 */

export const CAREERS = ['advocacia', 'magistratura', 'promotoria', 'defensoria', 'delegacia'] as const;
const CAREER_TEXT: Record<(typeof CAREERS)[number], string> = {
  advocacia: 'advogado(a) em um escritório pequeno',
  magistratura: 'juiz(a) substituto(a) em uma vara de comarca do interior',
  promotoria: 'promotor(a) de justiça',
  defensoria: 'defensor(a) público(a)',
  delegacia: 'delegado(a) de polícia civil',
};

export const practiceSchema = z.object({
  career: z.enum(CAREERS),
  area: z.enum([...AREAS, 'variado'] as const),
  difficulty: z.enum(DIFFICULTIES),
});

const TASK_KINDS = ['atendimento', 'prazo', 'audiencia', 'redacao', 'email', 'pesquisa', 'decisao', 'reuniao'] as const;

const DayOut = z.object({
  title: z.string(),
  intro: z.string(),
  tasks: z.array(
    z.object({
      time: z.string(),
      kind: z.enum(TASK_KINDS),
      title: z.string(),
      context: z.string(),
      prompt: z.string(),
      size: z.enum(['curta', 'media']),
    }),
  ),
});

const DAY_SYSTEM = `Você cria a agenda de UM dia de trabalho realista de uma carreira jurídica no Brasil, para treino de estudantes. Tudo é fictício (nomes, empresas, números de processo).

${LEGAL_INTEGRITY}

- title: nome curto do dia (ex.: "Segunda-feira cheia no escritório"). intro: 2 a 3 frases situando o aluno (onde trabalha, como está o dia).
- tasks: 5 tarefas em ordem de horário (time "09:00"… "18:00"), variadas, por exemplo: atender um cliente e identificar o problema jurídico; descobrir o prazo/recurso cabível; responder a uma pergunta numa audiência; redigir um trecho curto (cláusula, notificação, despacho, pedido); explicar algo ao cliente por e-mail em linguagem simples; decidir um pedido urgente.
- context: a situação com os detalhes necessários (datas, valores, falas, trechos de documentos), 3 a 8 frases. prompt: o que o aluno deve fazer, numa pergunta ou ordem clara, SEM dar a resposta.
- size: "curta" (responde em até 5 linhas) ou "media" (até ~20 linhas). No máximo 2 tarefas "media".
- As tarefas devem exigir conhecimento jurídico real e consolidado, sem pegadinhas desonestas.`;

const DIFF_TEXT = { facil: 'fácil (estagiário)', medio: 'médio (recém-formado)', dificil: 'difícil (profissional experiente)' };

/** Cria o dia com status "gerando" e responde na hora; a IA monta a agenda em segundo plano. */
export async function startPracticeDay(db: Firestore, uid: string, input: z.infer<typeof practiceSchema>, onFail: () => Promise<void>) {
  const ref = userCol(db, uid, 'practiceDays').doc();
  await ref.set({ ...input, title: 'Montando a agenda…', intro: '', tasks: [], answers: [], status: 'gerando', jobStartedAt: Date.now(), createdAt: FieldValue.serverTimestamp() });
  const url = `/pratica/${ref.id}`;
  generatePracticeDay(input, ref)
    .then((title) => notifyUser(db, uid, { title: 'Seu dia na prática está pronto', body: `${title}: 5 tarefas esperando por você.`, url, tag: `pratica-${ref.id}` }))
    .catch(async (err) => {
      const error = jobErrorMessage(err, 'Não foi possível montar o dia.');
      await ref.update({ status: 'erro', error }).catch(() => {});
      await onFail().catch(() => {});
      await notifyUser(db, uid, { title: 'O dia na prática não foi montado', body: error, url: '/pratica', tag: `pratica-${ref.id}` });
    });
  return ref.id;
}

async function generatePracticeDay(input: z.infer<typeof practiceSchema>, ref: FirebaseFirestore.DocumentReference) {
  const r = await generateStructured({
    schema: DayOut,
    system: DAY_SYSTEM,
    effort: 'medium',
    maxTokens: 12000,
    content: [
      {
        text: [
          `Carreira: ${CAREER_TEXT[input.career]}.`,
          input.area === 'variado' ? 'Áreas variadas ao longo do dia.' : `Área principal: ${input.area}.`,
          `Dificuldade: ${DIFF_TEXT[input.difficulty]}.`,
        ].join('\n'),
      },
    ],
  });
  const title = r.title.slice(0, 150);
  await ref.update({ title, intro: r.intro, tasks: r.tasks.slice(0, 6), answers: r.tasks.slice(0, 6).map(() => ''), status: 'em_andamento' });
  return title;
}

const Evaluation = z.object({
  tasks: z.array(z.object({ index: z.number().int(), score: z.number(), feedback: z.string(), ideal: z.string() })),
  summary: z.string(),
  strengths: z.array(z.string()),
  toImprove: z.array(z.string()),
});

const EVAL_SYSTEM = `Você é um(a) profissional experiente que avalia o dia de trabalho de um(a) estagiário(a)/recém-formado(a) em uma simulação educacional.

${LEGAL_INTEGRITY}

Para cada tarefa (index começa em 0): nota de 0 a 10 (score), feedback direto e específico (2 a 4 frases: o que acertou, o que errou ou faltou) e uma resposta ideal (ideal) no tamanho pedido. Resposta vazia vale 0 e o feedback diz que ficou sem resposta. Seja justo: aceite outras palavras quando o conteúdo jurídico estiver certo.
summary: 2 a 4 frases sobre o desempenho no dia. strengths: pontos fortes. toImprove: o que estudar.`;

/** Confere, marca "avaliando" e responde na hora; a avaliação roda em segundo plano. */
export async function startPracticeEvaluation(db: Firestore, uid: string, dayId: string, onFail: () => Promise<void>) {
  const ref = userCol(db, uid, 'practiceDays').doc(dayId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Dia de prática não encontrado.');
  if (snap.get('status') === 'concluido') throw new HttpError(409, 'Este dia já foi avaliado.');
  if (snap.get('status') === 'avaliando' && Date.now() - Number(snap.get('jobStartedAt') ?? 0) < STALE_JOB_MS) {
    throw new HttpError(409, 'Este dia já está sendo avaliado.');
  }
  if (snap.get('status') === 'gerando' || snap.get('status') === 'erro') throw new HttpError(409, 'A agenda deste dia não ficou pronta.');
  const tasks = snap.get('tasks') as z.infer<typeof DayOut>['tasks'];
  const answers = ((snap.get('answers') as string[] | undefined) ?? []).map((a) => String(a ?? '').slice(0, 8000));
  if (!answers.some((a) => a.trim())) throw new HttpError(422, 'Responda pelo menos uma tarefa antes de encerrar o expediente.');

  await ref.update({ status: 'avaliando', jobStartedAt: Date.now(), evaluationError: FieldValue.delete() });
  const url = `/pratica/${dayId}`;

  const run = async () => {
    const r = await generateStructured({
      schema: Evaluation,
      system: EVAL_SYSTEM,
      effort: 'medium',
      maxTokens: 16000,
      content: [
        {
          text: [
            `Carreira: ${CAREER_TEXT[snap.get('career') as (typeof CAREERS)[number]] ?? snap.get('career')}. ${snap.get('intro')}`,
            ...tasks.map(
              (t, i) => `TAREFA index=${i} — ${t.time} — ${t.title} (resposta ${t.size})\nSituação: ${t.context}\nPedido: ${t.prompt}\nRESPOSTA DO ALUNO: ${answers[i]?.trim() || '(sem resposta)'}`,
            ),
          ].join('\n\n'),
        },
      ],
    });
    const byIndex = new Map(r.tasks.map((t) => [t.index, t]));
    const perTask = tasks.map((_, i) => {
      const t = byIndex.get(i);
      const blank = !answers[i]?.trim();
      return {
        score: blank ? 0 : Math.max(0, Math.min(10, Math.round((t?.score ?? 0) * 10) / 10)),
        feedback: t?.feedback ?? (blank ? 'Tarefa sem resposta.' : 'Sem comentário.'),
        ideal: t?.ideal ?? '',
      };
    });
    const score = Math.round((perTask.reduce((s, t) => s + t.score, 0) / perTask.length) * 10);
    const evaluation = { perTask, summary: r.summary, strengths: r.strengths, toImprove: r.toImprove };
    await ref.update({ status: 'concluido', score, evaluation, finishedAt: FieldValue.serverTimestamp() });
    return score;
  };

  run()
    .then((score) => notifyUser(db, uid, { title: `Expediente avaliado: ${score}/100`, body: 'Veja o feedback e a resposta ideal de cada tarefa.', url, tag: `pratica-${dayId}` }))
    .catch(async (err) => {
      const error = jobErrorMessage(err, 'Não foi possível avaliar o dia.');
      await ref.update({ status: 'em_andamento', evaluationError: error }).catch(() => {});
      await onFail().catch(() => {});
      await notifyUser(db, uid, { title: 'A avaliação não terminou', body: `${error} As suas respostas continuam salvas.`, url, tag: `pratica-${dayId}` });
    });
}
