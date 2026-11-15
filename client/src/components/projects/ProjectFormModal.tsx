import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field, Select } from '@/components/ui/Field';
import { PROJECT_TYPE_LABELS } from '@/config/constants';
import { useProjectMutations } from '@/hooks/useStudyData';
import type { Project, ProjectType } from '@/types/models';
import { EntityFormModal } from './EntityFormModal';

const DEFAULT_ICON: Record<ProjectType, string> = {
  faculdade: 'GraduationCap',
  oab: 'Scale',
  concurso: 'Landmark',
  pos: 'Library',
  curso: 'BookOpen',
  pessoal: 'Lightbulb',
  outro: 'Folder',
};

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** sem projeto = criar */
  project?: Project;
  nextOrder?: number;
  onCreated?: (id: string) => void;
}

export function ProjectFormModal({ open, onClose, project, nextOrder = 0, onCreated }: ProjectFormModalProps) {
  const { create, update } = useProjectMutations();
  const [type, setType] = useState<ProjectType>(project?.type ?? 'faculdade');
  useEffect(() => {
    if (open) setType(project?.type ?? 'faculdade');
  }, [open, project]);

  const loading = create.isPending || update.isPending;

  return (
    <EntityFormModal
      open={open}
      onClose={onClose}
      title={project ? 'Editar projeto' : 'Novo projeto'}
      submitLabel={project ? 'Salvar' : 'Criar projeto'}
      namePlaceholder="Ex.: Exame da OAB 2027"
      loading={loading}
      initial={{
        name: project?.name ?? '',
        color: project?.color ?? '#7C3AED',
        icon: project?.icon ?? DEFAULT_ICON[type],
      }}
      extra={
        <Field label="Tipo">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      }
      onSubmit={async (values) => {
        try {
          if (project) {
            await update.mutateAsync({ id: project.id, data: { ...values, type } });
            toast.success('Projeto atualizado.');
          } else {
            const id = await create.mutateAsync({ data: { ...values, type }, order: nextOrder });
            toast.success('Projeto criado.');
            onCreated?.(id);
          }
          onClose();
        } catch {
          /* o toast de erro já foi mostrado pela mutation */
        }
      }}
    />
  );
}
