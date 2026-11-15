import { Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { missingFirebaseEnv } from '@/services/firebase/app';

/** Aparece enquanto o client/.env não tiver as credenciais do Firebase. */
export default function SetupRequired() {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-text">
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-text">Falta configurar o Firebase</h1>
            <p className="text-sm text-text-muted">O app já está pronto — só precisa das credenciais.</p>
          </div>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-text">
          <li>
            Copie <code className="rounded bg-primary-soft px-1 text-primary-text">client/.env.example</code> para{' '}
            <code className="rounded bg-primary-soft px-1 text-primary-text">client/.env</code>.
          </li>
          <li>Preencha as variáveis abaixo (o README explica onde pegar cada uma).</li>
          <li>Reinicie o <code className="rounded bg-primary-soft px-1 text-primary-text">npm run dev</code>.</li>
        </ol>

        <div className="rounded-lg border border-border bg-bg p-3">
          <p className="mb-2 text-xs font-medium text-text-muted">Variáveis faltando:</p>
          <ul className="space-y-1 font-mono text-xs text-text">
            {missingFirebaseEnv.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>

        <ButtonLink to="/tema-preview" variant="secondary" className="w-full">
          Enquanto isso, ver a prévia do tema
        </ButtonLink>
      </Card>
    </div>
  );
}
