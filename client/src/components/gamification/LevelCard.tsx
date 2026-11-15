import { Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { XP_RULES, type Gamification } from '@/lib/gamification';
import { MissionList } from './MissionList';

/** Resumo para o Dashboard: nível, XP e missões de hoje. */
export function LevelCard({ g }: { g: Gamification }) {
  const unlocked = g.achievements.filter((a) => a.unlocked).length;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
            <Sparkles className="size-3.5" /> Nível {g.level}
          </p>
          <p className="text-lg font-bold text-primary-text">{g.title}</p>
        </div>
        <Link to="/conquistas" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-muted hover:bg-primary-soft hover:text-text">
          <Trophy className="size-3.5" /> {unlocked}/{g.achievements.length} conquistas
        </Link>
      </div>
      <ProgressBar value={g.progress} label={`XP no nível ${g.level}`} />
      <p className="mt-1 mb-4 text-xs text-text-muted tabular-nums">
        {g.xp.toLocaleString('pt-BR')} XP · faltam {g.xpToNext.toLocaleString('pt-BR')} para o nível {g.level + 1}
      </p>
      <p className="mb-2 text-sm font-semibold text-text">Missões de hoje</p>
      <MissionList missions={g.missions} reward={XP_RULES.mission} />
    </Card>
  );
}
