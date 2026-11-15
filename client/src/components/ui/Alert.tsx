import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'success' | 'error' | 'warning' | 'info';

const styles: Record<Variant, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success/30 bg-success/10 [--tone:var(--success)]', icon: CheckCircle2 },
  error: { box: 'border-error/30 bg-error/10 [--tone:var(--error)]', icon: XCircle },
  warning: { box: 'border-warning/30 bg-warning/10 [--tone:var(--warning)]', icon: AlertTriangle },
  info: { box: 'border-info/30 bg-info/10 [--tone:var(--info)]', icon: Info },
};

interface AlertProps {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const { box, icon: Icon } = styles[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3.5 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-(--tone)" aria-hidden />
      <div className="space-y-0.5">
        {title && <p className="font-semibold text-(--tone)">{title}</p>}
        {children && <div className="text-text">{children}</div>}
      </div>
    </div>
  );
}
