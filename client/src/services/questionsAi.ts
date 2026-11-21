import { apiFetch } from './api';

/** Importa as questões de uma prova (PDF oficial enviado como material, ou texto próprio). Roda em segundo plano. */
export const importQuestions = (input: { subjectId: string; materialId?: string; text?: string; answerKeyMaterialId?: string; answerKeyText?: string }) =>
  apiFetch<{ id: string }>('/ai/questions/import', { method: 'POST', json: input });

/** Comentário da IA para uma questão (por que cada alternativa está certa ou errada). */
export const commentQuestionAi = (questionId: string, replace = false) =>
  apiFetch<{ explanation: string; disagrees: boolean }>(`/ai/questions/${questionId}/comment`, { method: 'POST', json: { replace } });
