import { Folder, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { readableTextOn, withAlpha } from '@/lib/color';

interface FolderCardProps {
  name: string;
  /** cor escolhida pelo usuário — igual nos dois temas */
  color: string;
  icon?: LucideIcon;
  itemCount?: number;
  onOpen?: () => void;
  /** botão de ações (⋯) */
  menu?: ReactNode;
  onContextMenu?: (e: MouseEvent) => void;
  /** destaque quando algo está sendo arrastado por cima */
  highlight?: boolean;
  /** gerar quiz com IA desta pasta (e subpastas) */
  onGenerateQuiz?: () => void;
  className?: string;
}

/**
 * Card de pasta. A faixa superior usa a cor da pasta e o texto sobre ela é
 * escolhido automaticamente (claro ou escuro) para ficar legível.
 */
export function FolderCard({
  name,
  color,
  icon: Icon = Folder,
  itemCount,
  onOpen,
  menu,
  onContextMenu,
  highlight,
  className,
  onGenerateQuiz,
}: FolderCardProps) {
  const fg = readableTextOn(color);

  return (
    <div
      onContextMenu={onContextMenu}
      className={cn(
        'group overflow-hidden rounded-xl border bg-surface transition-[box-shadow,transform] hover:shadow-card',
        highlight && 'scale-[1.02] shadow-card ring-2 ring-primary',
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
      <div className="flex items-center justify-between gap-2 py-1.5 pr-1.5 pl-4">
        <span className="text-xs text-text-muted">
          {itemCount === undefined ? 'Pasta' : `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
        </span>
        <div className="flex items-center gap-0.5">
          {onGenerateQuiz && (
            <button
              type="button"
              title="Gerar quiz desta pasta (inclui as subpastas)"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateQuiz();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary-text hover:bg-primary-soft"
            >
              <Sparkles className="size-3.5" aria-hidden /> Quiz
            </button>
          )}
          {menu}
        </div>
      </div>
    </div>
  );
}
