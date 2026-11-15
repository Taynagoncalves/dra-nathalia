import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/** Número de destaque (KPI): rótulo, valor grande e um complemento. */
export function StatTile({ icon: Icon, label, value, hint, className }: StatTileProps) {
  return (
    <Card className={cn('flex items-start gap-3 p-4', className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-2xl leading-tight font-bold tabular-nums text-text">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
