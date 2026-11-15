import type { ErrorCategory, QuizConfig, QuizSource } from '@/types/models';
import { apiFetch } from './api';

/** Chamadas de IA. Tudo passa pelo /server (a chave da IA nunca fica no navegador). */

export interface AiStatusInfo {
  configured: boolean;
  model: string;
  used: number;
  limit: number;
}

export const getAiStatus = () => apiFetch<AiStatusInfo>('/ai/status');

/** Extrai o texto do material para a IA (status: processando → pronto/erro). */
export const processMaterialForAi = (materialId: string) =>
  apiFetch<{ status: string; error?: string }>(`/ai/materials/${materialId}/process`, { method: 'POST' });

/** Começa a gerar o quiz; o progresso é acompanhado pelo documento do quiz no Firestore. */
export const createQuiz = (source: QuizSource, config: QuizConfig) =>
  apiFetch<{ quizId: string }>('/ai/quizzes', { method: 'POST', json: { source, config } });

export interface FinishAnswer {
  index: number;
  answer: string;
  correct: boolean;
  contested: boolean;
}

export interface FinishResponse {
  resultId: string;
  score: number;
  total: number;
  correct: number;
  timeSpentSec: number;
  weakTopics: string[];
  byTopic: { topic: string; correct: number; total: number }[];
  feedback: string;
  contested: number[];
  /** categoria do caderno de erros sugerida pela IA para cada questão errada */
  suggestions: { index: number; category: ErrorCategory }[];
}

export const finishQuiz = (quizId: string, answers: FinishAnswer[], timeSpentSec: number) =>
  apiFetch<FinishResponse>(`/ai/quizzes/${quizId}/finish`, { method: 'POST', json: { answers, timeSpentSec } });

export interface GradeResponse {
  score: number;
  verdict: 'correta' | 'parcial' | 'incorreta';
  good: string[];
  missing: string[];
  feedback: string;
  correct: boolean;
}

export const gradeDiscursive = (quizId: string, index: number, answer: string) =>
  apiFetch<GradeResponse>('/ai/grade', { method: 'POST', json: { quizId, index, answer } });
