import { BookOpenText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/IconTile';
import { LoadingBlock } from '@/components/ui/States';
import { useAllSubjects, useProjects } from '@/hooks/useStudyData';

/** Entrada do Caderno IA: escolha a matéria (cada matéria tem o seu caderno). */
export default function NotebookHome() {
  const projects = useProjects();
  const subjects = useAllSubjects();
  if (projects.isLoading || subjects.isLoading) return <LoadingBlock />;

  const groups = (projects.data ?? [])
    .filter((p) => !p.archived)
    .map((p) => ({ project: p, subjects: (subjects.data ?? []).filter((s) => s.projectId === p.id) }))
    .filter((g) => g.subjects.length);

  return (
    <>
      <PageHeader
        title="Caderno IA"
        description="Converse com os seus materiais e gere resumo, guia de estudo, perguntas frequentes, linha do tempo e mapa mental — sempre com a fonte e a página."
      />
      {!groups.length ? (
        <Card>
          <EmptyState
            icon={BookOpenText}
            title="Crie uma matéria primeiro"
            description="O Caderno IA usa os materiais de cada matéria (PDFs, Word, PowerPoint e anotações)."
            action={<ButtonLink to="/projetos">Ir para Projetos</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.project.id}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">{g.project.name}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.subjects.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/materias/${s.id}?aba=caderno`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-card"
                    >
                      <IconTile icon={s.icon} color={s.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium text-text">{s.name}</span>
                      <ChevronRight className="size-4 text-text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
