import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env, isCloudinaryConfigured, isPushConfigured } from './config/env.js';
import { runReminders } from './jobs/reminders.js';
import { adminDb, isFirebaseAdminConfigured } from './lib/firebaseAdmin.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { cloudinaryRouter } from './routes/cloudinary.js';
import { cronRouter } from './routes/cron.js';
import { foldersRouter } from './routes/folders.js';
import { projectsRouter } from './routes/projects.js';
import { pushRouter } from './routes/push.js';
import { subjectsRouter } from './routes/subjects.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
);

// Rotas públicas
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    firebaseAdmin: isFirebaseAdminConfigured,
    cloudinary: isCloudinaryConfigured,
    push: isPushConfigured,
    cron: Boolean(env.CRON_SECRET),
  });
});
// Agendador externo (protegido pelo CRON_SECRET, não pelo login)
app.use('/api/cron', cronRouter);

// Daqui para baixo, TODA rota exige o Firebase ID Token.
app.use('/api', requireAuth);
app.use('/api/cloudinary', cloudinaryRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/push', pushRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API em http://localhost:${env.PORT}`);
  console.log(`   Firebase Admin: ${isFirebaseAdminConfigured ? '✅ configurado' : '⚠️  pendente (preencha o .env)'}`);
  console.log(`   Cloudinary:     ${isCloudinaryConfigured ? '✅ configurado' : '⚠️  pendente (preencha o .env)'}`);
  console.log(`   Notificações:   ${isPushConfigured ? '✅ configurado' : '⚠️  pendente (VAPID no .env)'}`);
});

// Enquanto o server estiver acordado, também roda os lembretes a cada 30 min
// (o agendador externo garante que rode mesmo quando ele estiver dormindo).
if (adminDb) {
  const tick = () =>
    runReminders(adminDb!)
      .then((s) => (s.eventReminders || s.streakReminders) && console.log('🔔 Lembretes enviados:', s))
      .catch((err) => console.error('Falha nos lembretes:', err));
  setTimeout(tick, 60_000);
  setInterval(tick, 30 * 60_000);
}
