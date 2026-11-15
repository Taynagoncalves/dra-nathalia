import { BookOpen, ChevronRight, EllipsisVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DeleteProjectDialog } from '@/components/projects/DeleteProjectDialog';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { SubjectFormModal } from '@/components/projects/SubjectFormModal';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SortableList } from '@/components/ui/SortableList';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { PROJECT_TYPE_LABELS } from '@/config/constants';
import { useProgress, useProjects, useSubjectMutations, useSubjects } from '@/hooks/useStudyData';
import type { Subject } from '@/types/models';
import NotFound from '../NotFound';

export default function ProjectDetail() {
  const { projectId = '' } = useParams();
  const projects = useProjects();
  const subjects = useSubjects(projectId);
  const { bySubject, byProject } = useProgress();
  const { reorder, remove } = useSubjectMutations(projectId);

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject>();
  const [deletingSubject, setDeletingSubject] = useState<Subject>();
  const [deletingProject, setDeletingProject] = useState(false);
  const navigate = useNavigate();

  if (projects.isLoading) return <LoadingBlock />;
  if (projects.isError) return <ErrorBlock error={projects.error} onRetry={() => projects.refetch()} />;

  const project = projects.data?.find((p) => p.id === projectId);
  if (!project) return <NotFound />;

  const list = subjects.data ?? [];
  const progress = byProject.get(project.id);

  const openNewSubject = () => {
    setEditingSubject(undefined);
    setSubjectFormOpen(true);
  };

  return (
    <>
      <Breadcrumb items={[{ label: 'Projetos', to: '/projetos' }, { label: project.name }]} />
      <PageHeader
        title={project.name}
        actions={
          <>
            <Button variant="danger" onClick={() => setDeletingProject(true)}>
              <Trash2 className="size-4" /> <span className="hidden sm:inline">Excluir projeto</span>
            </Button>
            <Button variant="secondary" onClick={() => setProjectFormOpen(true)}>
              <Pencil className="size-4" /> Editar projeto
            </Button>
            <Button onClick={openNewSubject}>
              <Plus className="size-4" /> Nova matéria
            </Button>
          </>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <IconTile icon={project.icon} color={project.color} size="lg" />
        <div className="min-w-48 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Badge variant="neutral">{PROJECT_TYPE_LABELS[project.type]}</Badge>
            <span className="text-text-muted">
              {progress?.done ?? 0} de {progress?.topics ?? 0} assuntos concluídos ·{' '}
              <strong className="text-text">{progress?.percent ?? 0}%</strong>
            </span>
          </div>
          <ProgressBar value={progress?.percent ?? 0} label="Progresso do projeto" />
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-text">Matérias</h2>

      {subjects.isLoading ? (
        <LoadingBlock label="Carregando matérias…" />
      ) : subjects.isError ? (
        <ErrorBlock error={subjects.error} onRetry={() => subjects.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nenhuma matéria ainda"
            description="Adicione as matérias deste projeto. Dentro de cada uma você organiza assuntos, materiais e questões."
            action={
              <Button onClick={openNewSubject}>
                <Plus className="size-4" /> Criar primeira matéria
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <SortableList
            items={list}
            onReorder={(ordered) => reorder.mutate(ordered)}
            renderItem={(s, handle) => {
              const p = bySubject.get(s.id);
              return (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 pr-2">
                  {handle}
                  <Link to={`/materias/${s.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <IconTile icon={s.icon} color={s.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text group-hover:text-primary-text">{s.name}</p>
                      <p className="text-xs text-text-muted">
                        {p?.topics ?? 0} {p?.topics === 1 ? 'assunto' : 'assuntos'} · {p?.percent ?? 0}% concluído
                      </p>
                    </div>
                    <ProgressBar value={p?.percent ?? 0} className="hidden w-24 sm:block" label={`Progresso de ${s.name}`} />
                    <ChevronRight className="size-4 text-text-muted" aria-hidden />
                  </Link>
                  <Dropdown
                    trigger={({ toggle, open }) => (
                      <Button variant="ghost" size="icon" className="size-8" onClick={toggle} aria-expanded={open} aria-label={`Ações de ${s.name}`}>
                        <EllipsisVertical className="size-4" />
                      </Button>
                    )}
                  >
                    {(close) => (
                      <>
                        <DropdownItem
                          icon={<Pencil className="size-4" />}
                          onSelect={() => {
                            close();
                            setEditingSubject(s);
                            setSubjectFormOpen(true);
                          }}
                        >
                          Editar
                        </DropdownItem>
                        <DropdownItem
                          danger
                          icon={<Trash2 className="size-4" />}
                          onSelect={() => {
                            close();
                            setDeletingSubject(s);
                          }}
                        >
                          Excluir
                        </DropdownItem>
                      </>
                    )}
                  </Dropdown>
                </div>
              );
            }}
          />
          <p className="mt-3 text-xs text-text-muted">Dica: arraste pela alça ⋮⋮ para mudar a ordem.</p>
        </>
      )}

      <DeleteProjectDialog
        project={deletingProject ? project : null}
        onClose={() => setDeletingProject(false)}
        onDeleted={() => navigate('/projetos', { replace: true })}
      />
      <ProjectFormModal open={projectFormOpen} onClose={() => setProjectFormOpen(false)} project={project} />
      <SubjectFormModal
        open={subjectFormOpen}
        onClose={() => setSubjectFormOpen(false)}
        projectId={project.id}
        subject={editingSubject}
        nextOrder={list.length}
        defaultColor={project.color}
      />
      <ConfirmDialog
        open={!!deletingSubject}
        onClose={() => setDeletingSubject(undefined)}
        title={`Excluir “${deletingSubject?.name}”?`}
        description="A matéria será excluída com assuntos, pastas, materiais (inclusive os arquivos enviados), anotações e questões. O tempo já estudado continua no histórico. Esta ação não pode ser desfeita."
        confirmLabel="Excluir matéria"
        danger
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deletingSubject) return;
          try {
            await remove.mutateAsync(deletingSubject.id);
            toast.success('Matéria excluída.');
            setDeletingSubject(undefined);
          } catch {
            /* toast já exibido */
          }
        }}
      />
    </>
  );
}
