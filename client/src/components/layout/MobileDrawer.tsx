import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { SidebarContent } from './SidebarContent';

/** Menu lateral do celular (desliza da esquerda). */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-50 md:hidden', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div
        className={cn('absolute inset-0 bg-black/50 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={cn(
          'absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-card',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar menu" className="absolute top-3 right-3">
          <X className="size-5" />
        </Button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </div>
  );
}
