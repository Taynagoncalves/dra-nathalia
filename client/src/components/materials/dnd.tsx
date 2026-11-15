import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronRight, House } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Folder } from '@/types/models';

/**
 * IDs do arrastar e soltar:
 *   arrastáveis → "folder:ID" | "material:ID"
 *   alvos       → "into:ID" (pasta) | "into:root" (raiz da matéria)
 */
export type DragKind = 'folder' | 'material';
export const dragId = (kind: DragKind, id: string) => `${kind}:${id}`;
export const dropId = (folderId: string | null) => `into:${folderId ?? 'root'}`;

export function parseDrag(id: string): { kind: DragKind; id: string } {
  const [kind, ...rest] = id.split(':');
  return { kind: kind as DragKind, id: rest.join(':') };
}
export function parseDrop(id: string): string | null {
  const target = id.replace(/^into:/, '');
  return target === 'root' ? null : target;
}

/** Pasta: pode ser arrastada E receber itens. */
export function DraggableFolder({ folder, disabled, children }: { folder: Folder; disabled?: boolean; children: (isOver: boolean) => ReactNode }) {
  const drag = useDraggable({ id: dragId('folder', folder.id), disabled });
  const drop = useDroppable({ id: dropId(folder.id) });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      className={cn('touch-manipulation', drag.isDragging && 'opacity-40')}
    >
      {children(drop.isOver && !drag.isDragging)}
    </div>
  );
}

export function DraggableMaterial({ id, disabled, children }: { id: string; disabled?: boolean; children: ReactNode }) {
  const drag = useDraggable({ id: dragId('material', id), disabled });
  return (
    <div ref={drag.setNodeRef} {...drag.listeners} className={cn('h-full touch-manipulation', drag.isDragging && 'opacity-40')}>
      {children}
    </div>
  );
}

function DroppableCrumb({ folderId, label, last, onClick, icon }: { folderId: string | null; label: string; last: boolean; onClick: () => void; icon?: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(folderId), disabled: last });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      aria-current={last ? 'page' : undefined}
      className={cn(
        'flex max-w-48 items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 transition-colors',
        last ? 'font-semibold text-text' : 'text-text-muted hover:bg-primary-soft hover:text-primary-text',
        isOver && 'bg-primary-soft text-primary-text ring-2 ring-primary',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Matéria › Pasta › Subpasta — cada nível também aceita itens arrastados. */
export function ExplorerBreadcrumb({ subjectName, path, onNavigate }: { subjectName: string; path: Folder[]; onNavigate: (folderId: string | null) => void }) {
  return (
    <nav aria-label="Pastas" className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
      <DroppableCrumb folderId={null} label={subjectName} last={path.length === 0} onClick={() => onNavigate(null)} icon={<House className="size-3.5 shrink-0" />} />
      {path.map((f, i) => (
        <Fragment key={f.id}>
          <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          <DroppableCrumb folderId={f.id} label={f.name} last={i === path.length - 1} onClick={() => onNavigate(f.id)} />
        </Fragment>
      ))}
    </nav>
  );
}
