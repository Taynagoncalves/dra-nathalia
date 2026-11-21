import { Router } from 'express';
import { z } from 'zod';
import { aiModelName, aiProvider, isAiConfigured } from '../config/env.js';
import { processMaterial } from '../ai/materials.js';
import { planSchema, studyPlan } from '../ai/plan.js';
import { answerSchema, checkSchema, checkUnderstanding, coachAnswer, deckSchema, evaluateSchema, evaluateTeaching, feedbackSchema, generateDeck, questionSchema, taynaAnswer, taynaFeedback, taynaQuestion } from '../ai/teacher.js';
import { caseSchema, startCase, startCorrection } from '../ai/simulator.js';
import { createDeckFromMaterial, organizeOwnDeck, ownSlidesSchema } from '../ai/ownSlides.js';
import { importSchema, startQuestionImport } from '../ai/questionImport.js';
import { commentQuestion } from '../ai/questionComment.js';
import { practiceSchema, startPracticeDay, startPracticeEvaluation } from '../ai/practiceDay.js';
import { rateLimitOrThrow } from '../lib/rateLimit.js';
import { chatSchema, clearNotebookChat, generateStudio, notebookChat, studioSchema } from '../ai/notebook.js';
import { finishQuiz, finishSchema, gradeAnswer, quizRequestSchema, startQuiz } from '../ai/quiz.js';
import { aiUsageToday, consumeAiCredit } from '../ai/usage.js';
import { requireDb } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const aiRouter = Router();

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');

/** GET /api/ai/status — a IA está configurada? quanto do limite diário já foi usado? */
aiRouter.get('/status', async (req, res) => {
  const usage = await aiUsageToday(requireDb(), req.uid!);
  res.json({ configured: isAiConfigured, provider: aiProvider, model: aiModelName, ...usage });
});

/** POST /api/ai/materials/:id/process — extrai o texto do material para a IA (não usa a IA). */
aiRouter.post('/materials/:id/process', async (req, res) => {
  res.json(await processMaterial(requireDb(), req.uid!, id.parse(req.params.id)));
});

/** POST /api/ai/quizzes — começa a gerar um quiz (responde na hora com o ID). */
aiRouter.post('/quizzes', async (req, res) => {
  const body = quizRequestSchema.parse(req.body);
  const db = requireDb();
  if (!isAiConfigured) {
    return res.status(503).json({ error: 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).' });
  }
  const refund = await consumeAiCredit(db, req.uid!, 'quiz');
  const quizId = await startQuiz(db, req.uid!, body, refund);
  res.status(202).json({ quizId });
});

/** POST /api/ai/quizzes/:id/finish — calcula o resultado e pede o feedback da IA. */
aiRouter.post('/quizzes/:id/finish', async (req, res) => {
  res.json(await finishQuiz(requireDb(), req.uid!, id.parse(req.params.id), finishSchema.parse(req.body)));
});

/** POST /api/ai/grade — corrige uma resposta discursiva. */
aiRouter.post('/grade', async (req, res) => {
  const body = z.object({ quizId: id, index: z.number().int().min(0), answer: z.string().trim().min(1).max(5000) }).parse(req.body);
  const db = requireDb();
  const refund = await consumeAiCredit(db, req.uid!, 'correcao');
  try {
    res.json(await gradeAnswer(db, req.uid!, body.quizId, body.index, body.answer));
  } catch (err) {
    await refund();
    throw err;
  }
});

/* ── Caderno IA (estilo NotebookLM) ───────────────────────────────── */

/** Executa uma chamada de IA que consome 1 uso do limite diário (devolvido se falhar). */
async function withCredit<T>(uid: string, kind: string, fn: () => Promise<T>): Promise<T> {
  const db = requireDb();
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  const refund = await consumeAiCredit(db, uid, kind);
  try {
    return await fn();
  } catch (err) {
    await refund().catch(() => {});
    throw err;
  }
}

/**
 * Tarefa longa em segundo plano: consome 1 uso, `start` confere tudo, grava o
 * status ("gerando"…) e dispara a IA sem esperar; responde na hora.
 * Se `start` falhar antes de disparar, o uso é devolvido.
 */
async function startWithCredit<T>(uid: string, kind: string, start: (refund: () => Promise<void>) => Promise<T>): Promise<T> {
  const db = requireDb();
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  const refund = await consumeAiCredit(db, uid, kind);
  try {
    return await start(refund);
  } catch (err) {
    await refund().catch(() => {});
    throw err;
  }
}

/** POST /api/ai/notebook/chat — pergunta sobre os materiais (resposta com citações). */
aiRouter.post('/notebook/chat', async (req, res) => {
  const body = chatSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'chat', () => notebookChat(requireDb(), req.uid!, body)));
});

/** DELETE /api/ai/notebook/chat/:subjectId — limpa a conversa da matéria. */
aiRouter.delete('/notebook/chat/:subjectId', async (req, res) => {
  await clearNotebookChat(requireDb(), req.uid!, id.parse(req.params.subjectId));
  res.json({ ok: true });
});

/** POST /api/ai/notebook/studio — gera resumo, guia, FAQ, linha do tempo ou mapa mental. */
aiRouter.post('/notebook/studio', async (req, res) => {
  const body = studioSchema.parse(req.body);
  res.json(await withCredit(req.uid!, body.kind, () => generateStudio(requireDb(), req.uid!, body)));
});

/** POST /api/ai/plan — "O que devo estudar agora?" com IA (plano do dia). */
aiRouter.post('/plan', async (req, res) => {
  const body = planSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'plano', () => studyPlan(body)));
});

/* ── Modo Professora ──────────────────────────────────────────────── */

/** POST /api/ai/decks — gera slides. */
aiRouter.post('/decks', async (req, res) => {
  const body = deckSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'slides', () => generateDeck(requireDb(), req.uid!, body)));
});

/**
 * POST /api/ai/decks/own — apresentação a partir dos slides da pessoa (PDF/PowerPoint já enviado).
 * Cria na hora (sem IA); se houver uso disponível, a IA organiza o texto e escreve o roteiro em segundo plano.
 */
aiRouter.post('/decks/own', async (req, res) => {
  const { materialId } = ownSlidesSchema.parse(req.body);
  const db = requireDb();
  const { deckId, slides } = await createDeckFromMaterial(db, req.uid!, materialId);
  let ai = false;
  if (isAiConfigured) {
    try {
      const refund = await consumeAiCredit(db, req.uid!, 'slides_proprios');
      ai = true;
      void organizeOwnDeck(db, req.uid!, deckId, slides, refund);
    } catch {
      // limite do dia atingido: a apresentação fica pronta, só sem o roteiro da IA
    }
  }
  if (!ai) await db.collection('users').doc(req.uid!).collection('decks').doc(deckId).update({ aiStatus: 'sem_ia' });
  res.status(201).json({ id: deckId, ai });
});

/** POST /api/ai/decks/:id/organize — nova tentativa do roteiro dos slides próprios (só preenche roteiros vazios). */
aiRouter.post('/decks/:id/organize', async (req, res) => {
  const deckId = id.parse(req.params.id);
  const db = requireDb();
  const snap = await db.collection('users').doc(req.uid!).collection('decks').doc(deckId).get();
  if (!snap.exists) throw new HttpError(404, 'Apresentação não encontrada.');
  if (!snap.get('ownSlides')) throw new HttpError(422, 'Só apresentações com os seus slides têm esta opção.');
  if (snap.get('aiStatus') === 'organizando' && Date.now() - Number(snap.get('jobStartedAt') ?? 0) < 10 * 60_000) {
    throw new HttpError(409, 'A IA já está escrevendo o roteiro.');
  }
  await startWithCredit(req.uid!, 'slides_proprios', async (refund) => {
    void organizeOwnDeck(db, req.uid!, deckId, null, refund);
  });
  res.status(202).json({ ok: true });
});

/** POST /api/ai/teach/evaluate — avalia a fala (ensino oral). */
aiRouter.post('/teach/evaluate', async (req, res) => {
  const body = evaluateSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'avaliacao_oral', () => evaluateTeaching(requireDb(), req.uid!, body)));
});

/** Perguntas e reações da Tayna: rápidas e frequentes, então limitadas por hora (não gastam o limite diário). */
const taynaLimit = (uid: string) => rateLimitOrThrow(`tayna:${uid}`, 120, 3600_000, 'A Tayna precisa de uma pausa: muitas perguntas na última hora.');

aiRouter.post('/tayna/question', async (req, res) => {
  const body = questionSchema.parse(req.body);
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  taynaLimit(req.uid!);
  res.json(await taynaQuestion(requireDb(), req.uid!, body));
});

aiRouter.post('/tayna/answer', async (req, res) => {
  const body = answerSchema.parse(req.body);
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  taynaLimit(req.uid!);
  res.json(await taynaAnswer(body));
});

/** POST /api/ai/teach/check — "Apresentar para a IA": retorno de entendimento do slide + uma pergunta. */
aiRouter.post('/teach/check', async (req, res) => {
  const body = checkSchema.parse(req.body);
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  taynaLimit(req.uid!);
  res.json(await checkUnderstanding(requireDb(), req.uid!, body));
});

/** POST /api/ai/teach/answer — corrige a resposta à pergunta da IA (com a resposta certa). */
aiRouter.post('/teach/answer', async (req, res) => {
  const body = answerSchema.parse(req.body);
  if (!isAiConfigured) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  taynaLimit(req.uid!);
  res.json(await coachAnswer(body));
});

/** POST /api/ai/tayna/feedback — feedback final da sessão com a Tayna. */
aiRouter.post('/tayna/feedback', async (req, res) => {
  const body = feedbackSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'tayna', () => taynaFeedback(requireDb(), req.uid!, body)));
});

/* ── Simulador Jurídico ───────────────────────────────────────────── */

/** POST /api/ai/cases — começa a gerar um caso fictício (responde na hora com o ID). */
aiRouter.post('/cases', async (req, res) => {
  const body = caseSchema.parse(req.body);
  const caseId = await startWithCredit(req.uid!, 'caso', (refund) => startCase(requireDb(), req.uid!, body, refund));
  res.status(202).json({ id: caseId });
});

/** POST /api/ai/simulations/:id/correct — corrige a peça (8 critérios, erros, linha a linha e modelo). */
aiRouter.post('/simulations/:id/correct', async (req, res) => {
  const simId = id.parse(req.params.id);
  await startWithCredit(req.uid!, 'correcao_peca', (refund) => startCorrection(requireDb(), req.uid!, simId, refund));
  res.status(202).json({ ok: true });
});

/** DELETE /api/ai/cases/:id — exclui o caso, o gabarito escondido e as simulações dele. */
aiRouter.delete('/cases/:id', async (req, res) => {
  const caseId = id.parse(req.params.id);
  const db = requireDb();
  const user = db.collection('users').doc(req.uid!);
  const sims = await user.collection('simulations').where('caseId', '==', caseId).get();
  const batch = db.batch();
  sims.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(user.collection('cases').doc(caseId));
  batch.delete(user.collection('caseKeys').doc(caseId));
  await batch.commit();
  res.json({ ok: true, deletedSimulations: sims.size });
});

/* ── Um dia na prática jurídica ───────────────────────────────────── */

/** POST /api/ai/practice — começa a montar a agenda do dia (responde na hora com o ID). */
aiRouter.post('/practice', async (req, res) => {
  const body = practiceSchema.parse(req.body);
  const dayId = await startWithCredit(req.uid!, 'pratica', (refund) => startPracticeDay(requireDb(), req.uid!, body, refund));
  res.status(202).json({ id: dayId });
});

/** POST /api/ai/practice/:id/evaluate — avalia o expediente (as respostas ficam no documento). */
aiRouter.post('/practice/:id/evaluate', async (req, res) => {
  const dayId = id.parse(req.params.id);
  await startWithCredit(req.uid!, 'avaliacao_pratica', (refund) => startPracticeEvaluation(requireDb(), req.uid!, dayId, refund));
  res.status(202).json({ ok: true });
});

/* ── Banco de questões (provas de concurso/OAB) ───────────────────── */

/** POST /api/ai/questions/import — importa as questões de uma prova (PDF oficial ou texto próprio), em segundo plano. */
aiRouter.post('/questions/import', async (req, res) => {
  const body = importSchema.parse(req.body);
  const importId = await startWithCredit(req.uid!, 'importar_prova', (refund) => startQuestionImport(requireDb(), req.uid!, body, refund));
  res.status(202).json({ id: importId });
});

/** POST /api/ai/questions/:id/comment — comentário da IA (por que cada alternativa está certa ou errada). */
aiRouter.post('/questions/:id/comment', async (req, res) => {
  const questionId = id.parse(req.params.id);
  const { replace } = z.object({ replace: z.boolean().default(false) }).parse(req.body ?? {});
  res.json(await withCredit(req.uid!, 'comentario', () => commentQuestion(requireDb(), req.uid!, questionId, replace)));
});
