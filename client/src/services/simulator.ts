import type { CaseArea, CaseDifficulty } from '@/types/models';
import { apiFetch } from './api';

/** Simulador Jurídico: geração do caso, correção e exclusão passam pelo /server. */

export const generateCase = (input: { area: CaseArea; difficulty: CaseDifficulty; subjectId?: string | null; theme?: string }) =>
  apiFetch<{ id: string }>('/ai/cases', { method: 'POST', json: input });

/** Começa a correção (em segundo plano); acompanhe pelo documento da simulação. */
export const correctSimulation = (simulationId: string) => apiFetch<{ ok: true }>(`/ai/simulations/${simulationId}/correct`, { method: 'POST' });

export const deleteCase = (caseId: string) => apiFetch<{ ok: true }>(`/ai/cases/${caseId}`, { method: 'DELETE' });
