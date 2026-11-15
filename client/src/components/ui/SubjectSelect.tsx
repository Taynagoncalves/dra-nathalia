import { useAllSubjects, useProjects } from '@/hooks/useStudyData';
import { Select } from './Field';

interface SubjectSelectProps {
  id?: string;
  value: string;
  onChange: (subjectId: string) => void;
  /** texto da opção vazia (ex.: "Todas as matérias"); sem ele, não há opção vazia */
  emptyLabel?: string;
  /** limita às matérias de um projeto */
  projectId?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

/** <select> de matérias agrupadas por projeto (projetos arquivados ficam de fora). */
export function SubjectSelect({ id, value, onChange, emptyLabel, projectId, className, ...aria }: SubjectSelectProps) {
  const projects = useProjects();
  const subjects = useAllSubjects();

  const groups = (projects.data ?? [])
    .filter((p) => (!p.archived || p.id === projectId) && (!projectId || p.id === projectId))
    .map((p) => ({ project: p, subjects: (subjects.data ?? []).filter((s) => s.projectId === p.id) }))
    .filter((g) => g.subjects.length);

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...aria}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {groups.map((g) => (
        <optgroup key={g.project.id} label={g.project.name}>
          {g.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
