import { Router } from 'express';
import { z } from 'zod';
import { aiModelName, aiProvider, isAiConfigured } from '../config/env.js';
import { processMaterial } from '../ai/materials.js';
import { planSchema, studyPlan } from '../ai/plan.js';
import { answerSchema, deckSchema, evaluateSchema, evaluateTeaching, feedbackSchema, generateDeck, questionSchema, taynaAnswer, taynaFeedback, taynaQuestion } from '../ai/teacher.js';
import { caseSchema, correctSimulation, generateCase } from '../ai/simulator.js';
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

/** POST /api/ai/tayna/feedback — feedback final da sessão com a Tayna. */
aiRouter.post('/tayna/feedback', async (req, res) => {
  const body = feedbackSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'tayna', () => taynaFeedback(requireDb(), req.uid!, body)));
});

/* ── Simulador Jurídico ───────────────────────────────────────────── */

/** POST /api/ai/cases — gera um caso fictício com documentos. */
aiRouter.post('/cases', async (req, res) => {
  const body = caseSchema.parse(req.body);
  res.json(await withCredit(req.uid!, 'caso', () => generateCase(requireDb(), req.uid!, body)));
});

/** POST /api/ai/simulations/:id/correct — corrige a peça (8 critérios, erros, linha a linha e modelo). */
aiRouter.post('/simulations/:id/correct', async (req, res) => {
  const simId = id.parse(req.params.id);
  res.json(await withCredit(req.uid!, 'correcao_peca', () => correctSimulation(requireDb(), req.uid!, simId)));
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
