/**
 * Módulo de IA. TODAS as funções de IA da plataforma passam por aqui.
 * A chave ANTHROPIC_API_KEY fica só no .env do server.
 */
export { generateStructured, requireAi } from './client.js';
export { processMaterial, loadSourceDocs, formatSourceDocs } from './materials.js';
export { generateQuiz, startQuiz, gradeAnswer, finishQuiz } from './quiz.js';
export { consumeAiCredit, aiUsageToday } from './usage.js';

const notYet = (name: string) => (): never => {
  throw new Error(`${name}: chega na próxima parte da Etapa 2.`);
};

/** Próximas partes: assistente de estudos (chat) e resumos. */
export const askAssistant = notYet('askAssistant');
export const summarize = notYet('summarize');
