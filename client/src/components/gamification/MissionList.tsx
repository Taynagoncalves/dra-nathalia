import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';
import type { MissionProgress } from '@/lib/gamification';

const fmt = (m: MissionProgress) => {
  const id = m.def.id;
  if (id === 'quiz80') return m.value ? `melhor: ${m.value}%` : 'nenhum quiz hoje';
  if (id.startsWith('estudo') || id === 'h5') return `${Math.round(m.value)} de ${m.def.target} min`;
  return `${Math.min(m.value, m.def.target)} de ${m.def.target}`;
};

/** Lista de missões (diárias ou o desafio semanal) com progresso. */
export function MissionList({ missions, reward }: { missions: MissionProgress[]; reward: number }) {
  return (
    <ul className="space-y-3">
      {missions.map((m) => (
        <li key={m.def.id}>
          <Link to={m.def.link} className="-m-1 block rounded-lg p-1 hover:bg-primary-soft/40">
            <div className="flex items-center gap-2 text-sm">
              {m.done ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Concluída" /> : <Circle className="size-4 shrink-0 text-text-muted" aria-label="Pendente" />}
              <span className={cn('flex-1', m.done ? 'text-text-muted line-through' : 'text-text')}>{m.def.title}</span>
              <span className={cn('text-xs font-semibold', m.done ? 'text-success' : 'text-primary-text')}>+{reward} XP</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 pl-6">
              <ProgressBar value={m.pct} tone={m.done ? 'success' : 'primary'} className="h-1.5" label={m.def.title} />
              <span className="shrink-0 text-xs text-text-muted tabular-nums">{fmt(m)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
