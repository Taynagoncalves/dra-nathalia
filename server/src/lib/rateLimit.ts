import { HttpError } from '../middleware/errorHandler.js';

/** Limite simples em memória: no máximo `max` chamadas por `windowMs` para cada chave. */
const buckets = new Map<string, number[]>();

export function rateLimitOrThrow(key: string, max: number, windowMs: number, message = 'Muitas perguntas seguidas. Espere um pouco.') {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, message);
  recent.push(now);
  buckets.set(key, recent);
}
