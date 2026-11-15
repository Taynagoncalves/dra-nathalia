import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface DropdownProps {
  /** botão que abre o menu; recebe o estado e o toggle */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Menu suspenso. Abre numa camada própria (portal), então não é cortado por cards
 * com overflow; sobe quando não há espaço embaixo. Fecha ao clicar fora, Esc ou rolar.
 */
export function Dropdown({ trigger, children, align = 'end', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const gap = 6;
    let top = a.bottom + gap;
    if (top + m.height > window.innerHeight - 8 && a.top - gap - m.height > 8) top = a.top - gap - m.height;
    let left = align === 'end' ? a.right - m.width : a.left;
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', () => setOpen(false), { once: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setPos(null);
  };

  return (
    <div ref={anchorRef} className="relative inline-flex">
      {trigger({ open, toggle: () => (open ? close() : setOpen(true)) })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
            className={cn(
              'fixed z-50 min-w-44 rounded-xl border border-border bg-surface-elevated p-1 shadow-card',
              className,
            )}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface DropdownItemProps {
  onSelect: () => void;
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
}

export function DropdownItem({ onSelect, icon, children, active, danger }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        danger ? 'text-error hover:bg-error/10' : 'text-text hover:bg-primary-soft',
        active && 'bg-primary-soft font-medium text-primary-text',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}
