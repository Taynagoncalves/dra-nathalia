import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0 a 100 */
  value: number;
  label?: string;
  className?: string;
  /** cor da barra (padrão: cor principal do tema) */
  tone?: 'primary' | 'success' | 'warning' | 'error';
}

const tones = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', error: 'bg-error' };

export function ProgressBar({ value, label, className, tone = 'primary' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-primary-soft', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-300', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
