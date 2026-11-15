import { describe, expect, it } from 'vitest';
import { reminderText, stageFor } from './reminders';

describe('lembretes do calendário', () => {
  it('etapas: 7 dias → 3 dias → 1 dia → no dia', () => {
    expect([7, 6, 4, 3, 2, 1, 0].map(stageFor)).toEqual([7, 7, 7, 3, 3, 1, 0]);
    expect(stageFor(8)).toBeNull();
    expect(stageFor(-1)).toBeNull();
  });

  it('textos', () => {
    const prova = { title: '1ª fase OAB', type: 'prova', date: '2026-11-22', time: '13:00' };
    expect(reminderText(prova, 7)).toEqual({ title: 'Prova em 7 dias', body: '1ª fase OAB — 22/11 às 13:00. Revise seu caderno de erros.' });
    expect(reminderText(prova, 0).title).toBe('Prova hoje às 13:00');
    expect(reminderText({ title: 'Civil', type: 'revisao', date: '2026-11-16' }, 1)).toEqual({ title: 'Revisão amanhã', body: 'Civil — 16/11.' });
  });
});
