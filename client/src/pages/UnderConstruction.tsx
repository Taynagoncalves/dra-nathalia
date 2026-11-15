import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';

/** Lugar reservado para as telas que serão construídas nas próximas partes da Etapa 1. */
export default function UnderConstruction({ title, part }: { title: string; part: number }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={Hammer}
          title="Em construção"
          description={`Esta tela será construída na Parte ${part} da Etapa 1.`}
        />
      </Card>
    </>
  );
}
