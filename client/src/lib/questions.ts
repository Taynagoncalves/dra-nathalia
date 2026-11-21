import type { Attempt, Difficulty, Question, QuestionType } from '@/types/models';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multipla: 'Múltipla escolha',
  certo_errado: 'Certo ou errado',
  discursiva: 'Discursiva',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

/**
 * Formato das respostas:
 * - múltipla:      índice da alternativa ('0'…'4')
 * - certo/errado:  'certo' | 'errado'
 * - discursiva:    texto livre; o acerto é a autoavaliação do usuário
 */
export function isCorrectAnswer(q: Pick<Question, 'type' | 'correctAnswer'>, answer: string): boolean {
  if (q.type === 'discursiva') return false; // decidido pelo usuário ao comparar com o gabarito
  return answer === q.correctAnswer;
}

/** Texto do gabarito para exibir: "C", "Certo" ou a resposta-modelo. */
export function answerLabel(q: Pick<Question, 'type' | 'correctAnswer'>, answer = q.correctAnswer): string {
  if (q.type === 'multipla') return LETTERS[Number(answer)] ?? '?';
  if (q.type === 'certo_errado') return answer === 'certo' ? 'Certo' : 'Errado';
  return answer;
}

export type LastResult = 'acertou' | 'errou' | 'nunca';

/** Resultado da tentativa mais recente de cada questão. */
export function lastResults(attempts: Attempt[]): Map<string, { result: LastResult; at: number }> {
  const map = new Map<string, { result: LastResult; at: number }>();
  for (const a of attempts) {
    const at = a.createdAt?.toMillis?.() ?? Date.now();
    const prev = map.get(a.questionId);
    if (!prev || at > prev.at) map.set(a.questionId, { result: a.isCorrect ? 'acertou' : 'errou', at });
  }
  return map;
}

export interface QuestionFilters {
  projectId: string;
  subjectId: string;
  topicId: string;
  difficulty: Difficulty | '';
  type: QuestionType | '';
  status: LastResult | '';
  search: string;
}

export const EMPTY_QUESTION_FILTERS: QuestionFilters = {
  projectId: '',
  subjectId: '',
  topicId: '',
  difficulty: '',
  type: '',
  status: '',
  search: '',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterQuestions(
  questions: Question[],
  f: QuestionFilters,
  subjectProject: Map<string, string>,
  last: Map<string, { result: LastResult }>,
): Question[] {
  const q = norm(f.search.trim());
  return questions.filter(
    (x) =>
      (!f.projectId || subjectProject.get(x.subjectId) === f.projectId) &&
      (!f.subjectId || x.subjectId === f.subjectId) &&
      (!f.topicId || x.topicId === f.topicId) &&
      (!f.difficulty || x.difficulty === f.difficulty) &&
      (!f.type || x.type === f.type) &&
      (!f.status || (last.get(x.id)?.result ?? 'nunca') === f.status) &&
      (!q || norm(x.statement).includes(q)),
  );
}

/** Embaralha (Fisher–Yates) sem alterar a lista original. */
export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
