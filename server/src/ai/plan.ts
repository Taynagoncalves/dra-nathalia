import { z } from 'zod';
import { generateStructured } from './client.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/** "O que devo estudar agora?" com IA: plano do dia a partir do resumo do desempenho. */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const planSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  availableMinutes: z.number().int().min(5).max(600),
  subjects: z
    .array(
      z.object({
        id,
        name: z.string().max(120),
        accuracy: z.number().int().min(0).max(100).nullable(),
        attempts: z.number().int().min(0),
        pendingErrors: z.number().int().min(0),
        minutesLast7Days: z.number().int().min(0),
        dueReviews: z.array(z.string().max(120)).max(20),
        readyMaterials: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(60),
  upcoming: z.array(z.object({ title: z.string().max(150), type: z.string().max(20), date: z.string().max(10) })).max(10),
});

export const PLAN_ACTIONS = ['revisao', 'quiz', 'questoes', 'erros', 'caderno', 'materiais'] as const;

const PlanSchema = z.object({
  headline: z.string(),
  steps: z.array(
    z.object({
      subjectId: z.string(),
      action: z.enum(PLAN_ACTIONS),
      minutes: z.number().int(),
      reason: z.string(),
    }),
  ),
  tip: z.string(),
});

const SYSTEM = `Você é uma orientadora de estudos para alunos de Direito (faculdade, OAB e concursos).

${LEGAL_INTEGRITY}

Monte o plano de estudo de HOJE a partir dos dados do aluno. Regras:
- 2 a 5 passos, cuja soma de minutos caiba no tempo disponível.
- Prioridade: provas próximas (até 14 dias) → revisões vencidas → matérias com acerto baixo → erros pendentes no caderno → matérias pouco estudadas na semana.
- Ações possíveis: "revisao" (revisar assuntos vencidos com um quiz curto), "quiz" (quiz com IA sobre a matéria), "questoes" (resolver questões do banco), "erros" (revisar o caderno de erros), "caderno" (estudar os materiais com o Caderno IA), "materiais" (ler os materiais).
- Só sugira "quiz", "revisao" ou "caderno" se a matéria tiver materiais prontos (readyMaterials > 0); sem material, prefira "questoes" ou "materiais".
- reason: 1 frase concreta citando o dado que motivou (ex.: "acerto de 45% em 20 questões", "prova em 5 dias").
- headline: 1 frase motivadora e específica sobre o dia. tip: 1 dica prática de técnica de estudo.
- Use exatamente os ids de matéria fornecidos.`;

export async function studyPlan(input: z.infer<typeof planSchema>) {
  const ids = new Set(input.subjects.map((s) => s.id));
  const plan = await generateStructured({
    schema: PlanSchema,
    system: SYSTEM,
    effort: 'low',
    maxTokens: 4000,
    content: [{ text: `Dados do aluno (JSON):\n${JSON.stringify(input)}` }],
  });
  return { ...plan, steps: plan.steps.filter((s) => ids.has(s.subjectId)).slice(0, 5) };
}
