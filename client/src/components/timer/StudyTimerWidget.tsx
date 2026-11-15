import { Pause, Play, Square, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useStudyTimer } from '@/contexts/StudyTimerContext';
import { useAllSubjects } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { StartTimerModal } from './StartTimerModal';
import { StopTimerModal } from './StopTimerModal';

/** Timer no topo do site: "Estudar" quando parado; relógio + pausar/encerrar quando ativo. */
export function StudyTimerWidget() {
  const timer = useStudyTimer();
  const subjects = useAllSubjects();
  const [startOpen, setStartOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [, tick] = useState(0);

  // Atualiza o relógio a cada segundo (só este componente re-renderiza).
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer.running]);

  const subject = subjects.data?.find((s) => s.id === timer.state?.subjectId);

  // Mostra o tempo na aba do navegador enquanto estuda.
  const clock = formatClock(timer.elapsedMs());
  useEffect(() => {
    if (!timer.state) return;
    const original = document.title;
    document.title = `${timer.running ? '⏱' : '⏸'} ${clock} · Estudos`;
    return () => {
      document.title = original;
    };
  }, [timer.state, timer.running, clock]);

  if (!timer.state) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setStartOpen(true)}>
          <Timer className="size-4" /> Estudar
        </Button>
        <StartTimerModal open={startOpen} onClose={() => setStartOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 rounded-full border bg-surface py-1 pr-1 pl-3',
          timer.running ? 'border-primary/50' : 'border-border',
        )}
      >
        <span
          className={cn('size-2 shrink-0 rounded-full', timer.running && 'animate-pulse')}
          style={{ backgroundColor: subject?.color ?? 'var(--primary)' }}
          aria-hidden
        />
        <span className="hidden max-w-36 truncate text-xs text-text-muted lg:inline">{subject?.name ?? 'Matéria'}</span>
        <span className="ml-1 font-mono text-sm font-semibold tabular-nums text-text" aria-live="off">
          {clock}
        </span>
        {timer.running ? (
          <Button variant="ghost" size="icon" className="size-7" onClick={timer.pause} aria-label="Pausar timer">
            <Pause className="size-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-7" onClick={timer.resume} aria-label="Continuar timer">
            <Play className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:text-error"
          onClick={() => {
            timer.pause();
            setStopOpen(true);
          }}
          aria-label="Encerrar e salvar"
        >
          <Square className="size-3.5" />
        </Button>
      </div>
      <StopTimerModal open={stopOpen} onClose={() => setStopOpen(false)} subjectName={subject?.name} />
    </>
  );
}
