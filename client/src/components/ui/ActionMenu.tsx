import { EllipsisVertical } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Dropdown, DropdownItem } from './Dropdown';

export interface Action {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** selo à direita (ex.: "Em breve") */
  badge?: ReactNode;
  /** linha separadora antes deste item */
  separator?: boolean;
}

function ActionList({ actions, close }: { actions: Action[]; close: () => void }) {
  return (
    <>
      {actions.map((a, i) => (
        <div key={i}>
          {a.separator && <div className="my-1 h-px bg-border" />}
          {a.disabled ? (
            <div className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted opacity-70" aria-disabled>
              {a.icon}
              <span className="flex-1">{a.label}</span>
              {a.badge}
            </div>
          ) : (
            <DropdownItem
              danger={a.danger}
              icon={a.icon}
              onSelect={() => {
                close();
                a.onSelect();
              }}
            >
              <span className="flex items-center justify-between gap-2">
                {a.label}
                {a.badge}
              </span>
            </DropdownItem>
          )}
        </div>
      ))}
    </>
  );
}

/** Botão "⋯" com a lista de ações. */
export function ActionMenuButton({ actions, label, className }: { actions: Action[]; label: string; className?: string }) {
  return (
    <Dropdown
      className="min-w-52"
      trigger={({ toggle, open }) => (
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-expanded={open}
          aria-label={label}
        >
          <EllipsisVertical className="size-4" />
        </Button>
      )}
    >
      {(close) => <ActionList actions={actions} close={close} />}
    </Dropdown>
  );
}

export interface ContextMenuState {
  x: number;
  y: number;
  actions: Action[];
}

/** Menu de contexto (clique direito) na posição do mouse, sem sair da tela. */
export function ContextMenu({ menu, onClose }: { menu: ContextMenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(menu.x, window.innerWidth - width - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e.type === 'mousedown' && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 min-w-52 rounded-xl border border-border bg-surface-elevated p-1 shadow-card"
    >
      <ActionList actions={menu.actions} close={onClose} />
    </div>,
    document.body,
  );
}
