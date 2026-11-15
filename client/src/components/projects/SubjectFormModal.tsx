import { toast } from 'sonner';
import { useSubjectMutations } from '@/hooks/useStudyData';
import type { Subject } from '@/types/models';
import { EntityFormModal } from './EntityFormModal';

interface SubjectFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** sem matéria = criar */
  subject?: Subject;
  nextOrder?: number;
  defaultColor?: string;
}

export function SubjectFormModal({ open, onClose, projectId, subject, nextOrder = 0, defaultColor }: SubjectFormModalProps) {
  const { create, update } = useSubjectMutations(projectId);

  return (
    <EntityFormModal
      open={open}
      onClose={onClose}
      title={subject ? 'Editar matéria' : 'Nova matéria'}
      submitLabel={subject ? 'Salvar' : 'Criar matéria'}
      namePlaceholder="Ex.: Direito Civil"
      loading={create.isPending || update.isPending}
      initial={{
        name: subject?.name ?? '',
        color: subject?.color ?? defaultColor ?? '#7C3AED',
        icon: subject?.icon ?? 'BookOpen',
      }}
      onSubmit={async (values) => {
        try {
          if (subject) {
            await update.mutateAsync({ id: subject.id, data: values });
            toast.success('Matéria atualizada.');
          } else {
            await create.mutateAsync({ data: values, order: nextOrder });
            toast.success('Matéria criada.');
          }
          onClose();
        } catch {
          /* toast de erro já exibido */
        }
      }}
    />
  );
}
