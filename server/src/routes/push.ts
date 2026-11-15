import { Router } from 'express';
import { z } from 'zod';
import { env, isPushConfigured } from '../config/env.js';
import { requireDb } from '../lib/firestoreAdmin.js';
import { removeSubscription, saveSubscription, sendToUser } from '../lib/push.js';
import { HttpError } from '../middleware/errorHandler.js';

export const pushRouter = Router();

pushRouter.use((_req, _res, next) => {
  if (!isPushConfigured) return next(new HttpError(503, 'Notificações não estão configuradas no servidor (VAPID).'));
  next();
});

/** Chave pública VAPID (o navegador precisa dela para se inscrever). */
pushRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
});

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
});

/** POST /api/push/subscribe — guarda a inscrição deste aparelho. */
pushRouter.post('/subscribe', async (req, res) => {
  const sub = subscriptionSchema.parse(req.body?.subscription);
  await saveSubscription(requireDb(), req.uid!, { endpoint: sub.endpoint, keys: sub.keys }, String(req.headers['user-agent'] ?? ''));
  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const endpoint = z.string().min(1).parse(req.body?.endpoint);
  await removeSubscription(requireDb(), req.uid!, endpoint);
  res.json({ ok: true });
});

/** Notificação de teste para todos os aparelhos do usuário. */
pushRouter.post('/test', async (req, res) => {
  const delivered = await sendToUser(requireDb(), req.uid!, {
    title: 'Notificações ativadas ✓',
    body: 'Você vai receber lembretes de provas, revisões e estudos aqui.',
    url: '/perfil',
    tag: 'teste',
  });
  if (!delivered) throw new HttpError(404, 'Nenhum aparelho inscrito recebeu a notificação. Ative de novo neste aparelho.');
  res.json({ delivered });
});
