import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useProgress, useProjectMutations } from '@/hooks/useStudyData';
import type { Project } from '@/types/models';

interface DeleteProjectDialogProps {
  project: Project | null;
  onClose: () => void;
  onDeleted?: () => void;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');

/**
 * Excluir projeto com tudo dentro. Se tiver matérias, pede para digitar o nome
 * do projeto — a exclusão apaga materiais, arquivos e questões e não tem volta.
 */
export function DeleteProjectDialog({ project, onClose, onDeleted }: DeleteProjectDialogProps) {
  const { remove } = useProjectMutations();
  const { byProject } = useProgress();
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [project]);

  if (!project) return null;
  const subjects = byProject.get(project.id)?.subjects ?? 0;
  const topics = byProject.get(project.id)?.topics ?? 0;
  const needsTyping = subjects > 0;
  const canDelete = !needsTyping || norm(typed) === norm(project.name);

  const confirm = async () => {
    try {
      const r = await remove.mutateAsync(project.id);
      toast.success(`Projeto “${project.name}” excluído.`);
      if (r && !r.filesOk) toast.warning('Alguns arquivos não puderam ser apagados do Cloudinary.');
      onClose();
      onDeleted?.();
    } catch {
      /* toast já exibido */
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Excluir “${project.name}”?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!canDelete} loading={remove.isPending}>
            Excluir projeto
          </Button>
        </>
      }
    >
      {needsTyping ? (
        <div className="space-y-4">
          <Alert variant="error" title="Isto apaga tudo do projeto e não pode ser desfeito">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                {subjects} {subjects === 1 ? 'matéria' : 'matérias'} e {topics} {topics === 1 ? 'assunto' : 'assuntos'}
              </li>
              <li>todas as pastas, materiais e arquivos enviados</li>
              <li>anotações, questões e o caderno de erros dessas matérias</li>
            </ul>
          </Alert>
          <p className="text-sm text-text-muted">
            O tempo já estudado continua no seu histórico. Se quiser só tirar o projeto da lista, use <strong className="text-text">Arquivar</strong>.
          </p>
          <Field label={`Para confirmar, digite o nome do projeto: ${project.name}`}>
            {(id) => <Input id={id} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} placeholder={project.name} />}
          </Field>
        </div>
      ) : (
        <p className="text-sm text-text-muted">O projeto não tem matérias. Esta ação não pode ser desfeita.</p>
      )}
    </Modal>
  );
}
