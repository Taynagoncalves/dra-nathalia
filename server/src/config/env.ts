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

  // IA. As chaves ficam SÓ aqui no server.
  // Provedor: "gemini" (Google, tem plano gratuito) ou "anthropic" (Claude, pago).
  // Sem AI_PROVIDER, usa o que tiver chave (Gemini primeiro).
  AI_PROVIDER: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['gemini', 'anthropic']).optional()),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default('gemini-flash-latest'),
  ANTHROPIC_API_KEY: optional,
  AI_MODEL: z.string().default('claude-opus-5-5'),
  /** gerações de IA por usuário por dia (controle de custo) */
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

/** Provedor de IA em uso (ou null se nenhuma chave estiver configurada). */
export const aiProvider: 'gemini' | 'anthropic' | null =
  env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY
    ? 'anthropic'
    : env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY
      ? 'gemini'
      : env.GEMINI_API_KEY
        ? 'gemini'
        : env.ANTHROPIC_API_KEY
          ? 'anthropic'
          : null;

export const isAiConfigured = aiProvider !== null;

/** Nome do modelo em uso (para o status e os logs). */
export const aiModelName = aiProvider === 'gemini' ? env.GEMINI_MODEL : aiProvider === 'anthropic' ? env.AI_MODEL : null;

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
