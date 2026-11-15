import type { SimRole } from '@/types/models';
import { addDaysToKey } from './dates';
import { ROLE_LABELS, ROLES } from './simulator';

/**
 * Recomendações personalizadas (Etapa 5): próximos passos entre todas as
 * funções do site, a partir do que a pessoa fez (e do que ainda não fez).
 */

export type RecIcon = 'prova' | 'erros' | 'fraca' | 'simulador' | 'pratica' | 'professora' | 'quiz' | 'sequencia' | 'rascunho' | 'missao';

export interface PersonalRec {
  id: string;
  icon: RecIcon;
  title: string;
  reason: string;
  link: string;
  priority: number;
}

export interface RecInput {
  today: string;
  exams: { title: string; date: string }[];
  /** % de acerto por matéria (só com 3+ questões) */
  weakest: { subjectId: string; name: string; pct: number } | null;
  pendingErrors: { subjectId: string; name: string; count: number } | null;
  simulationRoles: SimRole[];
  simulationDraftId: string | null;
  practiceInProgressId: string | null;
  practiceDone: number;
  decks: number;
  lastQuizDay: string | null;
  studiedToday: boolean;
  streak: number;
  missionsLeft: { title: string; link: string }[];
}

export function personalRecs(i: RecInput, max = 4): PersonalRec[] {
  const out: PersonalRec[] = [];
  const add = (r: PersonalRec) => out.push(r);

  const exam = [...i.exams].filter((e) => e.date >= i.today).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (exam) {
    const days = Math.round((Date.parse(exam.date) - Date.parse(i.today)) / 86_400_000);
    if (days <= 14)
      add({
        id: 'prova',
        icon: 'prova',
        title: days <= 3 ? `Revisão final: ${exam.title}` : `Monte o cronograma para ${exam.title}`,
        reason: days === 0 ? 'A prova é hoje. Boa prova!' : `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}.`,
        link: days <= 3 ? '/erros' : '/calendario',
        priority: 100 - days,
      });
  }
  if (i.streak >= 2 && !i.studiedToday)
    add({ id: 'sequencia', icon: 'sequencia', title: `Não perca a sequência de ${i.streak} dias`, reason: 'Você ainda não estudou hoje. Um estudo rápido de 5 minutos já conta.', link: '/', priority: 90 });
  if (i.simulationDraftId)
    add({ id: 'rascunho', icon: 'rascunho', title: 'Termine a sua peça no Simulador', reason: 'Você tem uma peça em rascunho esperando a correção.', link: `/simulador/pecas/${i.simulationDraftId}`, priority: 80 });
  if (i.practiceInProgressId)
    add({ id: 'pratica_andamento', icon: 'pratica', title: 'Feche o expediente em andamento', reason: 'Há um dia na prática jurídica com tarefas por responder.', link: `/pratica/${i.practiceInProgressId}`, priority: 78 });
  if (i.pendingErrors && i.pendingErrors.count >= 3)
    add({
      id: 'erros',
      icon: 'erros',
      title: `Revise os erros de ${i.pendingErrors.name}`,
      reason: `${i.pendingErrors.count} erros sem resolver. Um quiz dos seus erros ajuda a fixar.`,
      link: '/erros',
      priority: 70 + Math.min(10, i.pendingErrors.count),
    });
  if (i.weakest && i.weakest.pct < 60)
    add({
      id: 'fraca',
      icon: 'fraca',
      title: `Explique ${i.weakest.name} para a Tayna`,
      reason: `Seu acerto lá é ${i.weakest.pct}%. Ensinar em voz alta mostra onde estão as lacunas.`,
      link: '/professora',
      priority: 65,
    });
  if (!i.lastQuizDay || i.lastQuizDay < addDaysToKey(i.today, -7))
    add({ id: 'quiz', icon: 'quiz', title: 'Faça um quiz com IA', reason: i.lastQuizDay ? 'Faz mais de uma semana desde o último quiz.' : 'Gere questões a partir dos seus próprios materiais.', link: '/quizzes', priority: 50 });
  const missing = ROLES.filter((r) => !i.simulationRoles.includes(r));
  if (missing.length && !i.simulationDraftId)
    add({
      id: 'simulador',
      icon: 'simulador',
      title: i.simulationRoles.length ? `Experimente o papel de ${ROLE_LABELS[missing[0]!]}` : 'Pratique um caso no Simulador Jurídico',
      reason: i.simulationRoles.length ? 'Você ainda não fez nenhuma peça nesse papel.' : 'A Roleta sorteia o seu papel e a IA corrige a peça por 8 critérios.',
      link: '/simulador',
      priority: 45,
    });
  if (!i.practiceDone && !i.practiceInProgressId)
    add({ id: 'pratica', icon: 'pratica', title: 'Viva um dia na prática jurídica', reason: 'Cinco tarefas reais de um expediente, avaliadas no fim do dia.', link: '/pratica', priority: 40 });
  if (!i.decks)
    add({ id: 'professora', icon: 'professora', title: 'Crie a sua primeira apresentação', reason: 'No Modo Professora você ensina o conteúdo e a Tayna faz perguntas.', link: '/professora', priority: 35 });
  i.missionsLeft.forEach((m, n) => add({ id: `missao_${n}`, icon: 'missao', title: m.title, reason: 'Missão de hoje: vale XP extra.', link: m.link, priority: 30 - n }));

  return out.sort((a, b) => b.priority - a.priority).slice(0, max);
}
