import type { Deck, DeckTemplate, TaynaLevel, TaynaPersonality } from '@/types/models';
import { apiFetch } from './api';

/** Modo Professora: slides, avaliação da fala e a Tayna (tudo pelo /server). */

export const generateDeck = (input: { subjectId: string; topicId?: string | null; materialIds: string[]; template: DeckTemplate; count: number; theme?: string }) =>
  apiFetch<Deck>('/ai/decks', { method: 'POST', json: input });

export interface Transcript {
  slideIndex: number;
  text: string;
}

export interface TeachingEvaluation {
  scores: { accuracy: number; coverage: number; clarity: number; coherence: number };
  summary: string;
  perSlide: { slideIndex: number; correct: string[]; errors: string[]; omissions: string[] }[];
  strengths: string[];
  toReview: string[];
}

export const evaluateTeaching = (deckId: string, transcripts: Transcript[]) =>
  apiFetch<TeachingEvaluation>('/ai/teach/evaluate', { method: 'POST', json: { deckId, transcripts } });

export interface TaynaQuestion {
  question: string;
  expectedAnswer: string;
  concept: string;
}

export const askTayna = (input: { deckId: string; slideIndex: number | null; transcript: string; level: TaynaLevel; personality: TaynaPersonality; asked: string[] }) =>
  apiFetch<TaynaQuestion>('/ai/tayna/question', { method: 'POST', json: input });

export interface TaynaReaction {
  verdict: 'boa' | 'incompleta' | 'errada';
  reaction: string;
  followUp: string | null;
  note: string;
}

export const answerTayna = (input: {
  deckId: string;
  slideIndex: number | null;
  question: string;
  expectedAnswer: string;
  answer: string;
  personality: TaynaPersonality;
  isFollowUp: boolean;
}) => apiFetch<TaynaReaction>('/ai/tayna/answer', { method: 'POST', json: input });

export interface TaynaInteraction {
  slideIndex: number | null;
  question: string;
  answer: string;
  verdict: 'boa' | 'incompleta' | 'errada' | 'sem_resposta';
  note: string;
}

export interface TaynaFeedback {
  summary: string;
  wellAnswered: string[];
  poorlyAnswered: string[];
  confident: string[];
  skippedConcepts: string[];
  toReview: string[];
}

export const taynaFeedback = (deckId: string, interactions: TaynaInteraction[], transcripts: Transcript[]) =>
  apiFetch<TaynaFeedback>('/ai/tayna/feedback', { method: 'POST', json: { deckId, interactions, transcripts } });

/* ── Ao vivo ─────────────────────────────────────────────────────── */

export const createLiveSession = (deckId: string) => apiFetch<{ code: string }>('/live', { method: 'POST', json: { deckId } });
export const suggestLive = (code: string, slideIndex: number, level: TaynaLevel = 'intermediario') =>
  apiFetch('/live/' + code + '/suggest', { method: 'POST', json: { slideIndex, level } });
export const evaluateLive = (code: string, questionId: string, answer: string) =>
  apiFetch<TaynaReaction>('/live/' + code + '/evaluate', { method: 'POST', json: { questionId, answer } });
export const endLive = (code: string) => apiFetch('/live/' + code + '/end', { method: 'POST' });
