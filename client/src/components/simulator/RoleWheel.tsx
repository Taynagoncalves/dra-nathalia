import { Dices, Gavel, Scale, ShieldHalf, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { drawRole, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '@/lib/simulator';
import type { SimRole } from '@/types/models';

const ICONS: Record<SimRole, LucideIcon> = { autor: Scale, reu: ShieldHalf, magistrado: Gavel };
/** centro de cada fatia, em graus a partir do topo (sentido horário) */
const CENTER: Record<SimRole, number> = { autor: 60, reu: 180, magistrado: 300 };

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface RoleWheelProps {
  /** papéis já feitos neste caso (a roleta sorteia entre os que faltam) */
  done: SimRole[];
  /** chamado depois que a roleta para */
  onResult: (role: SimRole) => void;
  busy?: boolean;
}

/** Roleta Jurídica: sorteio animado entre Autor, Réu e Magistrado (sem escolha do usuário). */
export function RoleWheel({ done, onResult, busy }: RoleWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SimRole | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const duration = reducedMotion() ? 400 : 3800;

  const spin = () => {
    if (spinning || busy) return;
    const role = drawRole(done);
    const jitter = (Math.random() - 0.5) * 70; // não para sempre no meio da fatia
    const current = ((rotation % 360) + 360) % 360;
    const target = (360 - CENTER[role] + jitter + 360) % 360;
    const delta = (target - current + 360) % 360;
    setResult(null);
    setSpinning(true);
    setRotation(rotation + 360 * 5 + delta);
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(role);
      onResult(role);
    }, duration + 150);
  };

  const pending = ROLES.filter((r) => !done.includes(r));

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-64 sm:size-72">
        {/* ponteiro */}
        <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2" aria-hidden>
          <div className="h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-text drop-shadow" />
        </div>
        <div
          className="size-full rounded-full border-4 border-surface shadow-card ring-1 ring-border"
          style={{
            background: 'conic-gradient(var(--chart-1) 0deg 120deg, var(--chart-2) 120deg 240deg, var(--chart-3) 240deg 360deg)',
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : 'none',
          }}
          aria-hidden
        >
          {ROLES.map((r) => {
            const Icon = ICONS[r];
            return (
              <div key={r} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${CENTER[r]}deg)` }}>
                <span
                  className={cn(
                    'mt-7 flex flex-col items-center gap-1 rounded-lg bg-surface/95 px-2.5 py-1.5 text-xs font-semibold text-text shadow-sm',
                    done.includes(r) && pending.length > 0 && 'opacity-60',
                  )}
                >
                  <Icon className="size-4 text-primary-text" />
                  {ROLE_LABELS[r]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-surface bg-primary text-on-primary shadow" aria-hidden>
          <Dices className="size-6" />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {spinning ? 'Sorteando o seu papel…' : result ? `Papel sorteado: ${ROLE_LABELS[result]}.` : ''}
      </p>

      {result ? (
        <div className="text-center">
          <p className="text-sm text-text-muted">O seu papel é</p>
          <p className="text-2xl font-bold text-primary-text">{ROLE_LABELS[result]}</p>
          <p className="text-sm text-text-muted">{ROLE_DESCRIPTIONS[result]}</p>
        </div>
      ) : (
        <Button size="lg" onClick={spin} loading={spinning || busy} disabled={spinning || busy}>
          <Dices className="size-5" /> {spinning ? 'Girando…' : 'Girar a roleta'}
        </Button>
      )}
      {!result && done.length > 0 && pending.length > 0 && (
        <p className="text-center text-xs text-text-muted">Você já fez este caso como {done.map((r) => ROLE_LABELS[r]).join(' e ')}. A roleta sorteia entre os papéis que faltam.</p>
      )}
    </div>
  );
}
