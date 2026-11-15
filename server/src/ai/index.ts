/**
 * Módulo de IA — ETAPA 2.
 *
 * Todas as funções de IA da plataforma (quizzes, assistente, resumos, correção,
 * Modo Professora, Simulador) passam por aqui. A chave ANTHROPIC_API_KEY fica só
 * no .env do server. As respostas estruturadas serão validadas com zod, com uma
 * nova tentativa se o JSON vier inválido.
 */

const notYet = (name: string) => (): never => {
  throw new Error(`${name}: disponível na Etapa 2.`);
};

export const generateQuiz = notYet('generateQuiz');
export const askAssistant = notYet('askAssistant');
export const summarize = notYet('summarize');
export const gradeAnswer = notYet('gradeAnswer');
