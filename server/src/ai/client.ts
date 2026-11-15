import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ApiError as GeminiApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { aiProvider, env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Cliente de IA do server (a chave nunca vai para o navegador). Dois provedores:
 *  - "gemini"    → Google Gemini (tem plano gratuito) — padrão
 *  - "anthropic" → Claude (pago)
 * O resto do código chama só `generateStructured` e não depende do provedor.
 */
const gemini = aiProvider === 'gemini' ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! }) : null;
const anthropic = aiProvider === 'anthropic' ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

export function requireAi() {
  if (!aiProvider) {
    throw new HttpError(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY ou ANTHROPIC_API_KEY).');
  }
  return aiProvider;
}

export type Effort = 'low' | 'medium' | 'high';

/** Um bloco de texto da mensagem; `cache` marca contexto grande e repetível (ex.: material). */
export interface ContentPart {
  text: string;
  cache?: boolean;
}

interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  content: ContentPart[];
  effort?: Effort;
  maxTokens?: number;
}

/** Resultado bruto de uma tentativa: texto JSON, ou um motivo para tentar de novo. */
type Attempt = { text: string } | { retry: string };

/* ── Gemini ─────────────────────────────────────────────────────── */

/**
 * JSON Schema a partir do zod, simplificado para a API do Gemini:
 * sem "$schema", sem os limites gigantes que o zod põe em inteiros e com
 * campos anuláveis sempre como anyOf [tipo, null].
 */
export function jsonSchemaOf(schema: z.ZodType) {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema') continue;
      if ((k === 'minimum' || k === 'maximum') && Math.abs(Number(v)) >= Number.MAX_SAFE_INTEGER) continue;
      out[k] = clean(v);
    }
    if (Array.isArray(out.type)) {
      const types = out.type as string[];
      delete out.type;
      return { anyOf: types.map((t) => ({ ...out, type: t })) };
    }
    return out;
  };
  return clean(z.toJSONSchema(schema)) as Record<string, unknown>;
}

/** Se a API recusar o formato estruturado, passamos a descrevê-lo no texto do pedido. */
let geminiSchemaUnsupported = false;

async function callGemini<S extends z.ZodType>(req: StructuredRequest<S>): Promise<Attempt> {
  const schema = jsonSchemaOf(req.schema);
  // Modelo principal + reservas: se um estiver sobrecarregado (503) ou indisponível (404/500), tenta o próximo.
  const models = [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS.split(',').map((m) => m.trim()).filter(Boolean)];
  let model = models[0]!;
  const send = (structured: boolean) =>
    gemini!.models.generateContent({
      model,
      contents: [{ role: 'user', parts: req.content.map((c) => ({ text: c.text })) }],
      config: {
        systemInstruction: structured
          ? req.system
          : `${req.system}\n\nResponda SOMENTE com um JSON válido que siga exatamente este JSON Schema:\n${JSON.stringify(schema)}`,
        responseMimeType: 'application/json',
        ...(structured ? { responseJsonSchema: schema } : {}),
        maxOutputTokens: req.maxTokens ?? 16000,
      },
    });
  const request = async (structured: boolean) => {
    for (let i = 0; ; i++) {
      model = models[i]!;
      try {
        return await send(structured);
      } catch (err) {
        const busy = err instanceof GeminiApiError && [404, 500, 503].includes(err.status);
        if (!busy || i === models.length - 1) throw err;
        console.warn(`Gemini ${model} indisponível (${(err as GeminiApiError).status}); tentando ${models[i + 1]}.`);
      }
    }
  };
  try {
    let res;
    try {
      res = await request(!geminiSchemaUnsupported);
    } catch (err) {
      const schemaRejected = err instanceof GeminiApiError && err.status === 400 && !/api key/i.test(err.message) && !geminiSchemaUnsupported;
      if (!schemaRejected) throw err;
      console.warn('Gemini recusou o formato estruturado; usando o formato descrito no texto:', err.message);
      geminiSchemaUnsupported = true;
      res = await request(false);
    }
    const blocked = res.promptFeedback?.blockReason;
    const finish = res.candidates?.[0]?.finishReason;
    if (blocked || finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST') {
      throw new HttpError(422, 'A IA não aceitou gerar este conteúdo. Tente com outro material ou tema.');
    }
    if (finish === 'MAX_TOKENS') return { retry: 'resposta cortada (muito longa)' };
    return { text: res.text ?? '' };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof GeminiApiError) {
      if (err.status === 429) {
        throw new HttpError(429, 'Limite gratuito da IA atingido por agora. Espere um minuto (ou até amanhã, se for o limite diário) e tente de novo.');
      }
      if (err.status === 400 && /api key/i.test(err.message)) throw new HttpError(503, 'A chave da IA (GEMINI_API_KEY) é inválida.');
      if (err.status === 401 || err.status === 403) throw new HttpError(503, 'A chave da IA (GEMINI_API_KEY) é inválida ou não tem acesso a este modelo.');
      if (err.status === 404) throw new HttpError(503, `Nenhum dos modelos configurados está disponível (${models.join(', ')}). Ajuste GEMINI_MODEL.`);
      if (err.status === 503) throw new HttpError(503, 'A IA gratuita está sobrecarregada agora. Tente de novo em alguns minutos.');
      console.error(`Erro da API do Gemini (${err.status}):`, err.message);
      throw new HttpError(502, 'A IA está indisponível no momento. Tente de novo.');
    }
    throw err;
  }
}

/* ── Claude (Anthropic) ─────────────────────────────────────────── */

async function callAnthropic<S extends z.ZodType>(req: StructuredRequest<S>): Promise<Attempt> {
  try {
    const message = await anthropic!.beta.messages
      .stream({
        model: env.AI_MODEL,
        max_tokens: req.maxTokens ?? 16000,
        // fallback do servidor: se o modelo recusar por política, a API tenta outro modelo
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: req.effort ?? 'medium', format: zodOutputFormat(req.schema) },
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: req.content.map((c) => ({ type: 'text' as const, text: c.text, ...(c.cache ? { cache_control: { type: 'ephemeral' as const } } : {}) })),
          },
        ],
      })
      .finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new HttpError(422, 'A IA não aceitou gerar este conteúdo. Tente com outro material ou tema.');
    }
    if (message.stop_reason === 'max_tokens') return { retry: 'resposta cortada (muito longa)' };
    return {
      text: message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(''),
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'A IA está ocupada agora. Tente de novo em alguns instantes.');
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(503, 'A chave da IA (ANTHROPIC_API_KEY) é inválida.');
    if (err instanceof Anthropic.BadRequestError) {
      console.error('Pedido inválido para a IA:', err.message);
      throw new HttpError(502, 'A IA não conseguiu processar este pedido.');
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Erro da API do Claude (${err.status}):`, err.message);
      throw new HttpError(502, 'A IA está indisponível no momento. Tente de novo.');
    }
    throw err;
  }
}

/* ── Função comum ───────────────────────────────────────────────── */

/**
 * Pede uma resposta em JSON que segue `schema` e valida com zod.
 * Se vier inválida (ou cortada), tenta mais UMA vez antes de desistir.
 */
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  const provider = requireAi();
  let lastError = 'resposta inválida';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = provider === 'gemini' ? await callGemini(req) : await callAnthropic(req);
    if ('retry' in result) {
      lastError = result.retry;
      continue;
    }
    try {
      const parsed = req.schema.safeParse(JSON.parse(result.text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message.slice(0, 300);
    } catch {
      lastError = 'JSON malformado';
    }
    console.warn(`Resposta da IA inválida (tentativa ${attempt}):`, lastError);
  }

  throw new HttpError(502, 'A IA devolveu uma resposta inválida duas vezes. Tente de novo.');
}
