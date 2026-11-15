import type { CaseArea, CaseDifficulty, LegalCase, SimCorrection } from '@/types/models';
import { apiFetch } from './api';

/** Simulador Jurídico: geração do caso, correção e exclusão passam pelo /server. */

export const generateCase = (input: { area: CaseArea; difficulty: CaseDifficulty; subjectId?: string | null; theme?: string }) =>
  apiFetch<LegalCase>('/ai/cases', { method: 'POST', json: input });

export const correctSimulation = (simulationId: string) => apiFetch<SimCorrection>(`/ai/simulations/${simulationId}/correct`, { method: 'POST' });

export const deleteCase = (caseId: string) => apiFetch<{ ok: true }>(`/ai/cases/${caseId}`, { method: 'DELETE' });
