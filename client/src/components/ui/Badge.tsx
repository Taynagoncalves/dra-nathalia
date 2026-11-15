import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'neutral' | 'success' | 'error' | 'warning' | 'info';

const variants: Record<Variant, string> = {
  primary: 'bg-primary-soft text-primary-text',
  neutral: 'bg-surface text-text-muted border border-border',
  success: 'bg-success/12 text-success',
  error: 'bg-error/12 text-error',
  warning: 'bg-warning/12 text-warning',
  info: 'bg-info/12 text-info',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Selo das funções das próximas etapas. */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="primary" className={className}>
      Em breve
    </Badge>
  );
}
