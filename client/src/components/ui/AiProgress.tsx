import { BellRing, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

/** Depois disso, a tarefa é considerada perdida (o servidor reiniciou no meio) e pode ser refeita. */
export const STALE_JOB_MS = 10 * 60_000;
export const isStaleJob = (startedAt: number | undefined) => !!startedAt && Date.now() - startedAt > STALE_JOB_MS;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface AiProgressProps {
  title: string;
  /** etapas mostradas conforme o tempo passa (é uma estimativa, não o progresso real) */
  steps: string[];
  /** quando começou (ms), para o tempo continuar certo se a pessoa sair e voltar */
  startedAt?: number;
  /** tempo típico, em segundos, para a barra */
  typicalSec?: number;
}

/**
 * Espera de tarefa longa da IA: tempo decorrido, etapas e o aviso de que dá
 * para sair da página (a pessoa é avisada no sino e no celular quando terminar).
 */
export function AiProgress({ title, steps, startedAt, typicalSec = 60 }: AiProgressProps) {
  const [now, setNow] = useState(Date.now());
  const [start] = useState(() => startedAt ?? Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.round((now - (startedAt ?? start)) / 1000));
  // barra que anda rápido no começo e desacelera, sem nunca chegar a 100%
  const pct = 95 * (1 - Math.exp(-elapsed / typicalSec));
  const step = steps[Math.min(steps.length - 1, Math.floor((elapsed / typicalSec) * steps.length * 0.8))];

  return (
    <Card className="mx-auto mt-6 max-w-lg p-6 text-center sm:p-8">
      <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary-text" aria-hidden />
      <p className="font-semibold text-text">{title}</p>
      <p className="mt-1 text-sm text-text-muted" aria-live="polite">
        {step}
      </p>
      <ProgressBar value={pct} className="mt-4" label="Andamento estimado" />
      <p className="mt-1.5 text-xs text-text-muted tabular-nums">
        {clock(elapsed)}
        {elapsed > typicalSec * 1.5 && ' · a IA gratuita está com fila, mas continua trabalhando'}
      </p>
      <p className="mt-5 flex items-start gap-2 rounded-lg bg-primary-soft/60 p-3 text-left text-sm text-text">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
        Pode sair desta página e continuar estudando: quando ficar pronto, você recebe um aviso aqui no site e no celular.
      </p>
    </Card>
  );
}
