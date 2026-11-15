import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarEvent, EventType } from '@/types/models';

/** Semana começando no domingo, como nos calendários brasileiros. */
export const WEEK_STARTS_ON = 0 as const;

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromKey = (key: string) => parseISO(key);

/** Dias exibidos na visão mensal (semanas completas, de domingo a sábado). */
export function monthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start, end });
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Eventos agrupados por dia; no dia, primeiro os sem horário, depois por horário. */
export function eventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  for (const list of map.values()) {
    list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'pt-BR'));
  }
  return map;
}

/** Atrasado = já passou e não foi marcado como feito. */
export const isOverdue = (e: Pick<CalendarEvent, 'date' | 'done'>, todayKey: string) => !e.done && e.date < todayKey;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  estudo: 'Estudo',
  revisao: 'Revisão',
  prova: 'Prova',
  outro: 'Outro',
};
