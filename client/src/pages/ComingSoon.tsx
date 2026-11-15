import { Navigate, useParams } from 'react-router-dom';
import { SOON_NAV } from '@/components/layout/navItems';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';

/** Página das funções das próximas etapas (Assistente IA, Quizzes, Modo Professora, Simulador). */
export default function ComingSoon() {
  const { slug } = useParams();
  const item = SOON_NAV.find((i) => i.slug === slug);
  if (!item) return <Navigate to="/" replace />;

  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icon={item.icon}
        title={item.label}
        description={item.description}
        action={
          <div className="flex flex-col items-center gap-4">
            <Badge variant="primary">Chega na {item.stage}</Badge>
            <ButtonLink to="/" variant="secondary">
              Voltar ao dashboard
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
