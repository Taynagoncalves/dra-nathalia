import { Archive, ArchiveRestore, EllipsisVertical, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { PROJECT_TYPE_LABELS } from '@/config/constants';
import { useProgress, useProjectMutations, useProjects, type Progress } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import type { Project } from '@/types/models';

export default function Projects() {
  const navigate = useNavigate();
  const projects = useProjects();
  const { byProject } = useProgress();
  const { update, remove } = useProjectMutations();

  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project>();
  const [deleting, setDeleting] = useState<Project>();

  const all = projects.data ?? [];
  const visible = all.filter((p) => p.archived === showArchived);
  const archivedCount = all.filter((p) => p.archived).length;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const toggleArchive = async (p: Project) => {
    try {
      await update.mutateAsync({ id: p.id, data: { archived: !p.archived } });
      toast.success(p.archived ? 'Projeto restaurado.' : 'Projeto arquivado.');
    } catch {
      /* toast de erro já exibido */
    }
  };

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Faculdade, OAB, concursos, cursos… cada objetivo de estudo é um projeto."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Novo projeto
          </Button>
        }
      />

      {archivedCount > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1 text-sm">
          {[false, true].map((archived) => (
            <button
              key={String(archived)}
              type="button"
              onClick={() => setShowArchived(archived)}
              aria-pressed={showArchived === archived}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition-colors',
                showArchived === archived ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:text-text',
              )}
            >
              {archived ? `Arquivados (${archivedCount})` : 'Em andamento'}
            </button>
          ))}
        </div>
      )}

      {projects.isLoading ? (
        <LoadingBlock label="Carregando projetos…" />
      ) : projects.isError ? (
        <ErrorBlock error={projects.error} onRetry={() => projects.refetch()} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={showArchived ? 'Nenhum projeto arquivado' : 'Crie seu primeiro projeto'}
            description={
              showArchived
                ? undefined
                : 'Um projeto reúne as matérias de um objetivo — por exemplo, “Exame da OAB” ou “5º semestre”.'
            }
            action={
              !showArchived && (
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> Criar projeto
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id}>
              <ProjectCard
                project={p}
                progress={byProject.get(p.id)}
                onEdit={() => {
                  setEditing(p);
                  setFormOpen(true);
                }}
                onArchive={() => toggleArchive(p)}
                onDelete={() => setDeleting(p)}
              />
            </li>
          ))}
        </ul>
      )}

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        project={editing}
        nextOrder={all.length}
        onCreated={(id) => navigate(`/projetos/${id}`)}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title={`Excluir “${deleting?.name}”?`}
        description="Só é possível excluir projetos sem matérias. Se quiser apenas tirá-lo da lista, use Arquivar."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Projeto excluído.');
            setDeleting(undefined);
          } catch {
            /* toast já exibido */
          }
        }}
      />
    </>
  );
}

interface ProjectCardProps {
  project: Project;
  progress?: Progress;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ProjectCard({ project, progress, onEdit, onArchive, onDelete }: ProjectCardProps) {
  const subjects = progress?.subjects ?? 0;
  const topics = progress?.topics ?? 0;

  return (
    <Card className="relative flex h-full flex-col gap-4 transition-shadow hover:shadow-card">
      <div className="flex items-start gap-3">
        <IconTile icon={project.icon} color={project.color} />
        <div className="min-w-0 flex-1">
          {/* o link cobre o card inteiro; o menu fica por cima */}
          <Link
            to={`/projetos/${project.id}`}
            className="line-clamp-2 font-semibold text-text after:absolute after:inset-0 after:rounded-xl hover:text-primary-text"
          >
            {project.name}
          </Link>
          <Badge variant="neutral" className="mt-1">
            {PROJECT_TYPE_LABELS[project.type]}
          </Badge>
        </div>
        <div className="relative z-10">
          <Dropdown
            trigger={({ toggle, open }) => (
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-8" onClick={toggle} aria-expanded={open} aria-label={`Ações de ${project.name}`}>
                <EllipsisVertical className="size-4" />
              </Button>
            )}
          >
            {(close) => (
              <>
                <DropdownItem icon={<Pencil className="size-4" />} onSelect={() => (close(), onEdit())}>
                  Editar
                </DropdownItem>
                <DropdownItem
                  icon={project.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  onSelect={() => (close(), onArchive())}
                >
                  {project.archived ? 'Restaurar' : 'Arquivar'}
                </DropdownItem>
                <DropdownItem danger icon={<Trash2 className="size-4" />} onSelect={() => (close(), onDelete())}>
                  Excluir
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex justify-between text-xs text-text-muted">
          <span>
            {subjects} {subjects === 1 ? 'matéria' : 'matérias'} · {topics} {topics === 1 ? 'assunto' : 'assuntos'}
          </span>
          <span className="font-medium text-text">{progress?.percent ?? 0}%</span>
        </div>
        <ProgressBar value={progress?.percent ?? 0} label={`Progresso de ${project.name}`} />
      </div>
    </Card>
  );
}
