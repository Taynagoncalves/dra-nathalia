import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { runReminders } from '../jobs/reminders.js';
import { requireDb } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const cronRouter = Router();

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * POST /api/cron/lembretes  (cabeçalho x-cron-secret)
 * Chamado de hora em hora por um agendador externo (GitHub Actions). Isso também
 * "acorda" o server gratuito do Render, que dorme quando fica sem uso.
 */
cronRouter.post('/lembretes', async (req, res) => {
  if (!env.CRON_SECRET) throw new HttpError(503, 'CRON_SECRET não configurado.');
  const given = String(req.headers['x-cron-secret'] ?? '');
  if (!sameSecret(given, env.CRON_SECRET)) throw new HttpError(401, 'Não autorizado.');
  res.json(await runReminders(requireDb()));
});
