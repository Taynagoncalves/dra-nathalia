/** Regras dos lembretes (funções puras; o site usa as mesmas em client/src/lib/reminders.ts). */

export const STAGES = [0, 1, 3, 7] as const;
export type Stage = (typeof STAGES)[number];

/** Em qual etapa de lembrete o evento está (faltando `days` dias). */
export function stageFor(days: number): Stage | null {
  if (days < 0 || days > 7) return null;
  if (days === 0) return 0;
  if (days === 1) return 1;
  return days <= 3 ? 3 : 7;
}

const TYPE_LABEL: Record<string, string> = { prova: 'Prova', revisao: 'Revisão', estudo: 'Estudo', outro: 'Lembrete' };

export function reminderText(e: { title: string; type: string; date: string; time?: string | null }, days: number) {
  const label = TYPE_LABEL[e.type] ?? 'Lembrete';
  const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
  const at = e.time ? ` às ${e.time}` : '';
  const dm = `${e.date.slice(8, 10)}/${e.date.slice(5, 7)}`;
  const tip = e.type === 'prova' ? (days === 0 ? ' Boa prova! 🍀' : ' Revise seu caderno de erros.') : '';
  return {
    title: `${label} ${when}${days === 0 ? at : ''}`,
    body: `${e.title}${days === 0 ? '' : ` — ${dm}${at}`}.${tip}`,
  };
}

