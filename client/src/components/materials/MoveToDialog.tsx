import { ChevronRight, Folder as FolderIcon, House } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { iconByName } from '@/config/icons';
import { cn } from '@/lib/cn';
import { childrenMap } from '@/lib/folderTree';
import type { Folder } from '@/types/models';

interface MoveToDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  folders: Folder[];
  /** pasta onde o item está hoje */
  currentFolderId: string | null;
  /** pastas que não podem ser destino (a própria pasta movida e as filhas dela) */
  disabledIds?: Set<string>;
  subjectName: string;
  loading?: boolean;
  onConfirm: (targetFolderId: string | null) => void;
}

/** Alternativa ao arrastar (essencial no celular): escolhe a pasta de destino numa árvore. */
export function MoveToDialog({
  open,
  onClose,
  itemName,
  folders,
  currentFolderId,
  disabledIds,
  subjectName,
  loading,
  onConfirm,
}: MoveToDialogProps) {
  const [target, setTarget] = useState<string | null>(currentFolderId);
  const tree = useMemo(() => childrenMap(folders), [folders]);
  useEffect(() => {
    if (open) setTarget(currentFolderId);
  }, [open, currentFolderId]);

  const sortByName = (list: Folder[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const renderLevel = (parentId: string, depth: number) =>
    sortByName(tree.get(parentId) ?? []).map((f) => {
      const disabled = disabledIds?.has(f.id);
      const Icon = iconByName(f.icon, FolderIcon);
      return (
        <li key={f.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget(f.id)}
            aria-pressed={target === f.id}
            style={{ paddingLeft: 12 + depth * 18 }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm transition-colors',
              target === f.id ? 'bg-primary-soft font-medium text-primary-text' : 'text-text hover:bg-primary-soft',
              disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
            )}
          >
            {depth > 0 && <ChevronRight className="size-3 text-text-muted" aria-hidden />}
            <Icon className="size-4 shrink-0" style={{ color: f.color }} aria-hidden />
            <span className="truncate">{f.name}</span>
            {f.id === currentFolderId && <span className="ml-auto text-xs text-text-muted">atual</span>}
          </button>
          {!disabled && <ul>{renderLevel(f.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mover para…"
      description={`Escolha onde colocar “${itemName}”.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(target)} disabled={target === currentFolderId} loading={loading}>
            Mover aqui
          </Button>
        </>
      }
    >
      <ul className="max-h-[50dvh] space-y-0.5 overflow-y-auto rounded-xl border border-border bg-bg p-1.5">
        <li>
          <button
            type="button"
            onClick={() => setTarget(null)}
            aria-pressed={target === null}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              target === null ? 'bg-primary-soft font-medium text-primary-text' : 'text-text hover:bg-primary-soft',
            )}
          >
            <House className="size-4" aria-hidden />
            {subjectName} <span className="text-text-muted">(raiz)</span>
            {currentFolderId === null && <span className="ml-auto text-xs text-text-muted">atual</span>}
          </button>
        </li>
        {renderLevel('', 1)}
      </ul>
    </Modal>
  );
}
