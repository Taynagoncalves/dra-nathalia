import type { CaseArea, CaseDifficulty, PracticeCareer } from '@/types/models';
import { apiFetch } from './api';

/** "Um dia na prática jurídica": a agenda e a avaliação vêm do /server. */
export const generatePracticeDay = (input: { career: PracticeCareer; area: CaseArea | 'variado'; difficulty: CaseDifficulty }) =>
  apiFetch<{ id: string }>('/ai/practice', { method: 'POST', json: input });

export const evaluatePracticeDay = (dayId: string) => apiFetch<{ ok: true }>(`/ai/practice/${dayId}/evaluate`, { method: 'POST' });
