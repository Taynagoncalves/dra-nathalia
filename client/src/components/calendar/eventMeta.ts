import { BookOpen, CircleDot, GraduationCap, RotateCcw, type LucideIcon } from 'lucide-react';
import type { EventType } from '@/types/models';

/**
 * Identidade de cada tipo: ícone + rótulo (nunca só a cor).
 * As cores vêm das variáveis do tema, então acompanham claro/escuro e a cor principal.
 */
export const EVENT_META: Record<EventType, { label: string; icon: LucideIcon; color: string }> = {
  estudo: { label: 'Estudo', icon: BookOpen, color: 'var(--chart-1)' },
  revisao: { label: 'Revisão', icon: RotateCcw, color: 'var(--chart-3)' },
  prova: { label: 'Prova', icon: GraduationCap, color: 'var(--chart-2)' },
  outro: { label: 'Outro', icon: CircleDot, color: 'var(--text-muted)' },
};

export const EVENT_TYPES = Object.keys(EVENT_META) as EventType[];
