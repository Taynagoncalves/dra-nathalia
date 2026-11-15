import { AlertTriangle } from 'lucide-react';
import { friendlyError } from '@/lib/firebaseErrors';
import { Button } from './Button';
import { Spinner } from './Feedback';

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-6" />
      </span>
      <p className="text-sm text-text">{friendlyError(error, 'Não foi possível carregar os dados.')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
