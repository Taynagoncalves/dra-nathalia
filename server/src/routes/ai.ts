import { Router } from 'express';
import { z } from 'zod';
import { aiModelName, aiProvider, isAiConfigured } from '../config/env.js';
import { processMaterial } from '../ai/materials.js';
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
