import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/**
 * "Comentário da IA" para uma questão do banco (no estilo dos comentários de
 * professores): por que o gabarito é esse e por que cada alternativa está
 * certa ou errada. Salvo no campo explanation da questão.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const Comment = z.object({
  general: z.string(),
  options: z.array(z.object({ letter: z.string(), comment: z.string() })),
  /** a IA discorda do gabarito cadastrado? (questão desatualizada, erro de digitação…) */
  disagrees: z.boolean(),
  disagreeReason: z.string().nullable(),
});

const SYSTEM = `Você é professor(a) de Direito e comenta questões de concurso e OAB para alunos.

${LEGAL_INTEGRITY}

- general: comentário geral (3 a 6 frases) com o fundamento (lei, súmula ou jurisprudência consolidada) e a "pegadinha", se houver.
- options: para múltipla escolha, um comentário curto por alternativa (letter "A".."E"), dizendo por que está certa ou errada. Para certo/errado ou discursiva, options = [].
- Use o gabarito informado como referência. Se você tiver forte razão para achar que ele está errado ou desatualizado (lei alterada, mudança de entendimento), disagrees = true e explique em disagreeReason; senão disagrees = false e disagreeReason = null.`;

export async function commentQuestion(db: Firestore, uid: string, questionId: string, replace: boolean) {
  const ref = userCol(db, uid, 'questions').doc(questionId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Questão não encontrada.');
  const q = snap.data() as { statement: string; type: string; options: string[]; correctAnswer: string; explanation?: string; examBoard?: string | null; examYear?: number | null };
  if (q.explanation?.trim() && !replace) throw new HttpError(409, 'Esta questão já tem comentário.');

  const answer =
    q.type === 'multipla' ? `${LETTERS[Number(q.correctAnswer)] ?? '?'}) ${q.options[Number(q.correctAnswer)] ?? ''}` : q.type === 'certo_errado' ? q.correctAnswer.toUpperCase() : q.correctAnswer;
  const r = await generateStructured({
    schema: Comment,
    system: SYSTEM,
    effort: 'medium',
    maxTokens: 6000,
    content: [
      {
        text: [
          q.examBoard ? `Banca: ${q.examBoard}${q.examYear ? ` (${q.examYear})` : ''}.` : '',
          `Tipo: ${q.type}.`,
          `Enunciado: ${q.statement}`,
          q.type === 'multipla' ? q.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n') : '',
          `Gabarito cadastrado: ${answer}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const lines = [r.general.trim()];
  if (q.type === 'multipla' && r.options.length) lines.push(r.options.map((o) => `${o.letter.trim().toUpperCase().slice(0, 1)}) ${o.comment.trim()}`).join('\n'));
  if (r.disagrees && r.disagreeReason) lines.push(`⚠️ Atenção: a IA desconfia do gabarito. ${r.disagreeReason.trim()} Confira na legislação atualizada.`);
  lines.push('(Comentário gerado por IA — confira a legislação atualizada.)');
  const explanation = lines.join('\n\n');
  await ref.update({ explanation, explanationByAi: true, updatedAt: FieldValue.serverTimestamp() });
  return { explanation, disagrees: r.disagrees };
}
