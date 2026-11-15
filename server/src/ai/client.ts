import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { env, isAiConfigured } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Cliente do Claude (API da Anthropic). Só existe no server: a chave
 * ANTHROPIC_API_KEY nunca vai para o navegador.
 */
const client = isAiConfigured ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

export function requireAi(): Anthropic {
  if (!client) throw new HttpError(503, 'A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).');
  return client;
}

export type Effort = 'low' | 'medium' | 'high';

interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  /** blocos de conteúdo da mensagem do usuário (contexto + pedido) */
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort?: Effort;
  maxTokens?: number;
}

/**
 * Pede uma resposta em JSON que segue `schema` (saídas estruturadas) e valida
 * com zod. Se vier inválida, tenta mais UMA vez antes de desistir.
 *
 * - Modelo: AI_MODEL (padrão claude-opus-5-5), com pensamento adaptativo.
 * - Fallback automático do servidor: se o modelo recusar por política de
 *   segurança, a própria API repete o pedido num modelo alternativo.
 * - Streaming + finalMessage(): evita timeout em respostas longas.
 */
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  const ai = requireAi();
  let lastError = 'resposta inválida';

  for (let attempt = 1; attempt <= 2; attempt++) {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await ai.beta.messages
        .stream({
          model: env.AI_MODEL,
          max_tokens: req.maxTokens ?? 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: req.effort ?? 'medium', format: zodOutputFormat(req.schema) },
          // O prompt de sistema é fixo: fica em cache entre pedidos parecidos.
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: req.content }],
        })
        .finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        throw new HttpError(429, 'A IA está ocupada agora. Tente de novo em alguns instantes.');
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new HttpError(503, 'A chave da IA (ANTHROPIC_API_KEY) é inválida.');
      }
      if (err instanceof Anthropic.BadRequestError) {
        console.error('Pedido inválido para a IA:', err.message);
        throw new HttpError(502, 'A IA não conseguiu processar este pedido.');
      }
      if (err instanceof Anthropic.APIError) {
        console.error(`Erro da API da IA (${err.status}):`, err.message);
        throw new HttpError(502, 'A IA está indisponível no momento. Tente de novo.');
      }
      throw err;
    }

    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'A IA não aceitou gerar este conteúdo. Tente com outro material ou tema.');
    }
    if (message.stop_reason === 'max_tokens') {
      lastError = 'resposta cortada (muito longa)';
      continue;
    }

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    try {
      const parsed = req.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message.slice(0, 300);
    } catch {
      lastError = 'JSON malformado';
    }
    console.warn(`Resposta da IA inválida (tentativa ${attempt}):`, lastError);
  }

  throw new HttpError(502, 'A IA devolveu uma resposta inválida duas vezes. Tente de novo.');
}
