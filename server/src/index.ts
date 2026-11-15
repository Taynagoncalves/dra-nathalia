import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env, isCloudinaryConfigured } from './config/env.js';
import { isFirebaseAdminConfigured } from './lib/firebaseAdmin.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { cloudinaryRouter } from './routes/cloudinary.js';
import { foldersRouter } from './routes/folders.js';
import { subjectsRouter } from './routes/subjects.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
);

// Rota pública: só informa se o server está de pé e o que já foi configurado.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, firebaseAdmin: isFirebaseAdminConfigured, cloudinary: isCloudinaryConfigured });
});

// Daqui para baixo, TODA rota exige o Firebase ID Token.
app.use('/api', requireAuth);
app.use('/api/cloudinary', cloudinaryRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/subjects', subjectsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API em http://localhost:${env.PORT}`);
  console.log(`   Firebase Admin: ${isFirebaseAdminConfigured ? '✅ configurado' : '⚠️  pendente (preencha o .env)'}`);
  console.log(`   Cloudinary:     ${isCloudinaryConfigured ? '✅ configurado' : '⚠️  pendente (preencha o .env)'}`);
});
