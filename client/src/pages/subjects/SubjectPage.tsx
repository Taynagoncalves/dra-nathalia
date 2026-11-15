import { FolderOpen, ListChecks, ListTree, Play } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/IconTile';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useStudyTimer } from '@/contexts/StudyTimerContext';
import { useProjects, useSubject } from '@/hooks/useStudyData';
import NotFound from '../NotFound';
import { MaterialsPanel } from './MaterialsPanel';
import { TopicsPanel } from './TopicsPanel';

type Tab = 'materiais' | 'assuntos' | 'questoes';

export default function SubjectPage() {
  const { subjectId = '' } = useParams();
  const subject = useSubject(subjectId);
  const projects = useProjects();
  const timer = useStudyTimer();
  const [params, setParams] = useSearchParams();
  const tab = (['materiais', 'assuntos', 'questoes'] as const).find((t) => t === params.get('aba')) ?? 'materiais';

  if (subject.isLoading) return <LoadingBlock />;
  if (subject.isError) return <ErrorBlock error={subject.error} onRetry={() => subject.refetch()} />;
  if (!subject.data) return <NotFound />;

  const s = subject.data;
  const project = projects.data?.find((p) => p.id === s.projectId);
  const studyingThis = timer.state?.subjectId === s.id;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projetos', to: '/projetos' },
          ...(project ? [{ label: project.name, to: `/projetos/${project.id}` }] : []),
          { label: s.name },
        ]}
      />
      <PageHeader
        title={s.name}
        actions={
          <Button
            variant={studyingThis ? 'secondary' : 'primary'}
            disabled={!!timer.state && !studyingThis}
            onClick={() => timer.start(s.id, 'Leitura')}
            title={timer.state && !studyingThis ? 'Encerre o timer atual antes de começar outro.' : undefined}
          >
            <Play className="size-4" /> {studyingThis ? 'Estudando agora' : 'Estudar esta matéria'}
          </Button>
        }
        className="mb-4"
      />
      <div className="mb-5 flex items-center gap-3">
        <IconTile icon={s.icon} color={s.color} size="sm" />
        <span className="text-sm text-text-muted">{project ? project.name : 'Matéria'}</span>
      </div>

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={(t) => setParams(t === 'materiais' ? {} : { aba: t }, { replace: true })}
        items={[
          { value: 'materiais', label: 'Materiais', icon: FolderOpen },
          { value: 'assuntos', label: 'Assuntos', icon: ListTree },
          { value: 'questoes', label: 'Questões', icon: ListChecks },
        ]}
      />

      {tab === 'assuntos' && <TopicsPanel subjectId={s.id} />}
      {tab === 'materiais' && <MaterialsPanel subjectId={s.id} subjectName={s.name} />}
      {tab === 'questoes' && (
        <Card>
          <EmptyState icon={ListChecks} title="Questões chegam na Parte 5" description="Banco de questões desta matéria." />
        </Card>
      )}
    </>
  );
}
