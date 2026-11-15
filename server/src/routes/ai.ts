import { Router } from 'express';
import { z } from 'zod';
import { env, isAiConfigured } from '../config/env.js';
import { processMaterial } from '../ai/materials.js';
import { finishQuiz, finishSchema, gradeAnswer, quizRequestSchema, startQuiz } from '../ai/quiz.js';
import { aiUsageToday, consumeAiCredit } from '../ai/usage.js';
import { requireDb } from '../lib/firestoreAdmin.js';

export const aiRouter = Router();

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');

/** GET /api/ai/status — a IA está configurada? quanto do limite diário já foi usado? */
aiRouter.get('/status', async (req, res) => {
  const usage = await aiUsageToday(requireDb(), req.uid!);
  res.json({ configured: isAiConfigured, model: env.AI_MODEL, ...usage });
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
    return res.status(503).json({ error: 'A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).' });
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
