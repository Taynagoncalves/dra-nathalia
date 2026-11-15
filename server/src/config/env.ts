import 'dotenv/config';
import { z } from 'zod';

/** Trata string vazia do .env como "não definido". */
const optional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().optional(),
);

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  FIREBASE_SERVICE_ACCOUNT_PATH: optional,
  FIREBASE_SERVICE_ACCOUNT_JSON: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),

  ANTHROPIC_API_KEY: optional,
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(30),

  // Notificações (Web Push) — gere com: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default('https://dra-nathalia.onrender.com'),
  // Segredo do agendador que chama POST /api/cron/lembretes
  CRON_SECRET: optional,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isPushConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
