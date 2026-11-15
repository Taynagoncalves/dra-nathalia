import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import type { DeleteFolderMode } from '@/services/firebase/folders';

interface DeleteFolderDialogProps {
  open: boolean;
  onClose: () => void;
  folderName: string;
  /** subpastas e materiais em qualquer nível */
  counts: { folders: number; materials: number; files: number };
  parentName: string;
  loading?: boolean;
  onConfirm: (mode: DeleteFolderMode) => void;
}

export function DeleteFolderDialog({ open, onClose, folderName, counts, parentName, loading, onConfirm }: DeleteFolderDialogProps) {
  const isEmpty = counts.folders === 0 && counts.materials === 0;
  const [mode, setMode] = useState<DeleteFolderMode>('moveUp');
  useEffect(() => {
    if (open) setMode('moveUp');
  }, [open]);

  const parts = [
    counts.folders && `${counts.folders} ${counts.folders === 1 ? 'subpasta' : 'subpastas'}`,
    counts.materials && `${counts.materials} ${counts.materials === 1 ? 'material' : 'materiais'}`,
  ].filter(Boolean);

  const options: { value: DeleteFolderMode; title: string; text: string }[] = [
    { value: 'moveUp', title: `Mover o conteúdo para “${parentName}”`, text: 'Só a pasta é excluída; nada se perde.' },
    {
      value: 'cascade',
      title: 'Excluir tudo',
      text: `Exclui a pasta e tudo dentro dela${counts.files ? `, inclusive ${counts.files} arquivo(s) enviados` : ''}. Não dá para desfazer.`,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Excluir “${folderName}”?`}
      description={isEmpty ? 'A pasta está vazia.' : `Ela contém ${parts.join(' e ')}. O que fazer com o conteúdo?`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => onConfirm(isEmpty ? 'cascade' : mode)} loading={loading}>
            {isEmpty || mode === 'moveUp' ? 'Excluir pasta' : 'Excluir tudo'}
          </Button>
        </>
      }
    >
      {!isEmpty && (
        <div role="radiogroup" className="space-y-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                mode === o.value
                  ? o.value === 'cascade'
                    ? 'border-error bg-error/5'
                    : 'border-primary bg-primary-soft'
                  : 'border-border hover:bg-primary-soft/50',
              )}
            >
              <input
                type="radio"
                name="delete-mode"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
                className="mt-1 accent-(--primary)"
              />
              <span>
                <span className={cn('block text-sm font-medium', o.value === 'cascade' ? 'text-error' : 'text-text')}>{o.title}</span>
                <span className="block text-xs text-text-muted">{o.text}</span>
              </span>
            </label>
          ))}
          {mode === 'cascade' && counts.files > 0 && (
            <Alert variant="warning">Os arquivos também serão apagados do Cloudinary.</Alert>
          )}
        </div>
      )}
    </Modal>
  );
}
