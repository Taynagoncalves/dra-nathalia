import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço pode estar errado ou a página foi removida."
        action={<ButtonLink to="/">Voltar ao início</ButtonLink>}
      />
    </div>
  );
}
