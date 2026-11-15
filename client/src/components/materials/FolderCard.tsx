import { Folder, MoreHorizontal, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SoonBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { readableTextOn, withAlpha } from '@/lib/color';

interface FolderCardProps {
  name: string;
  /** cor escolhida pelo usuário — igual nos dois temas */
  color: string;
  icon?: LucideIcon;
  itemCount?: number;
  onOpen?: () => void;
  onMenu?: () => void;
  className?: string;
}

/**
 * Card de pasta. A faixa superior usa a cor da pasta e o texto sobre ela é
 * escolhido automaticamente (claro ou escuro) para ficar legível.
 */
export function FolderCard({ name, color, icon: Icon = Folder, itemCount, onOpen, onMenu, className }: FolderCardProps) {
  const fg = readableTextOn(color);

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-card',
        className,
      )}
      style={{ borderColor: withAlpha(color, 0.45) }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        style={{ backgroundColor: color, color: fg }}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="truncate font-semibold">{name}</span>
      </button>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="text-xs text-text-muted">
          {itemCount === undefined ? 'Pasta' : `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            title="Gerar quiz (Etapa 2)"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-muted opacity-70"
          >
            <Sparkles className="size-3.5" aria-hidden />
            <SoonBadge />
          </button>
          <button
            type="button"
            onClick={onMenu}
            aria-label={`Ações da pasta ${name}`}
            className="rounded-md p-1 text-text-muted hover:bg-primary-soft hover:text-text"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
