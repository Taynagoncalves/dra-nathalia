import { LayoutDashboard } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { useAuth } from '@/contexts/AuthContext';

/** Página inicial PROVISÓRIA. O Dashboard completo é a Parte 9. */
export default function Home() {
  const { profile, user } = useAuth();
  const firstName = (profile?.name || user?.displayName || '').split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Olá{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="mt-1 text-text-muted">Login funcionando. O painel completo chega nas próximas partes.</p>
      </div>
      <Card>
        <EmptyState
          icon={LayoutDashboard}
          title="Seu dashboard vai aparecer aqui"
          description="Projetos, metas, sequência de estudos e o botão “O que devo estudar agora?”."
          action={<ButtonLink to="/tema-preview">Ver o tema</ButtonLink>}
        />
      </Card>
    </div>
  );
}
