import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types/models';
import { eventsByDay, isOverdue, monthGrid, toKey, weekDays } from './calendar';

describe('grades do calendário', () => {
  it('mês começa no domingo e tem semanas completas', () => {
    const days = monthGrid(new Date(2026, 10, 15)); // novembro de 2026 (1º é domingo)
    expect(days.length % 7).toBe(0);
    expect(days[0]!.getDay()).toBe(0);
    expect(toKey(days[0]!)).toBe('2026-11-01');
    expect(toKey(days.at(-1)!)).toBe('2026-12-05');
  });
  it('semana tem 7 dias de domingo a sábado', () => {
    const days = weekDays(new Date(2026, 10, 18));
    expect(days.map(toKey)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
  });
});

describe('eventos', () => {
  const ev = (id: string, date: string, time: string | null, title = id) => ({ id, date, time, title, done: false }) as CalendarEvent;
  it('agrupa por dia: sem horário primeiro, depois por horário', () => {
    const map = eventsByDay([ev('b', '2026-11-15', '14:00'), ev('a', '2026-11-15', null), ev('c', '2026-11-15', '08:30')]);
    expect(map.get('2026-11-15')!.map((e) => e.id)).toEqual(['a', 'c', 'b']);
  });
  it('atrasado só se passou e não está feito', () => {
    expect(isOverdue({ date: '2026-11-14', done: false }, '2026-11-15')).toBe(true);
    expect(isOverdue({ date: '2026-11-14', done: true }, '2026-11-15')).toBe(false);
    expect(isOverdue({ date: '2026-11-15', done: false }, '2026-11-15')).toBe(false);
  });
});
