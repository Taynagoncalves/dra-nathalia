import { CheckCircle2, ChevronDown, RotateCcw, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { UploadItem } from '@/hooks/useUploadQueue';
import { cn } from '@/lib/cn';
import { formatBytes } from './kinds';

interface UploadQueuePanelProps {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
}

/** Painel fixo (canto inferior) com o progresso de cada arquivo. */
export function UploadQueuePanel({ items, onCancel, onRetry, onClear }: UploadQueuePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (!items.length) return null;

  const done = items.filter((i) => i.status === 'concluido').length;
  const pending = items.filter((i) => i.status === 'na_fila' || i.status === 'enviando').length;
  const failed = items.filter((i) => i.status === 'erro').length;

  return (
    <div className="fixed right-3 bottom-20 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-card md:right-6 md:bottom-6">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <p className="flex-1 text-sm font-semibold text-text" aria-live="polite">
          {pending ? `Enviando ${pending} arquivo(s)…` : `${done} enviado(s)${failed ? `, ${failed} com erro` : ''}`}
        </p>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir' : 'Recolher'}>
          <ChevronDown className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
        {!pending && (
          <Button variant="ghost" size="icon" className="size-7" onClick={onClear} aria-label="Fechar painel de envios">
            <X className="size-4" />
          </Button>
        )}
      </div>
      {!collapsed && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {items.map((i) => (
            <li key={i.id} className="space-y-1.5 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-text" title={i.file.name}>
                  {i.file.name}
                </span>
                <span className="shrink-0 text-xs text-text-muted">{formatBytes(i.file.size)}</span>
                {i.status === 'concluido' && <CheckCircle2 className="size-4 text-success" aria-label="Concluído" />}
                {i.status === 'erro' && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => onRetry(i.id)} aria-label="Tentar de novo">
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {(i.status === 'na_fila' || i.status === 'enviando') && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => onCancel(i.id)} aria-label={`Cancelar ${i.file.name}`}>
                    <X className="size-3.5" />
                  </Button>
                )}
                {i.status === 'cancelado' && <XCircle className="size-4 text-text-muted" aria-label="Cancelado" />}
              </div>
              {(i.status === 'enviando' || i.status === 'na_fila') && (
                <ProgressBar value={i.progress} label={`Envio de ${i.file.name}`} />
              )}
              {i.status === 'erro' && <p className="text-xs text-error">{i.error}</p>}
              {i.status === 'cancelado' && <p className="text-xs text-text-muted">Cancelado</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
