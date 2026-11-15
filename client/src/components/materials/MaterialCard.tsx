import { Sparkles, Star } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { ActionMenuButton, type Action } from '@/components/ui/ActionMenu';
import { Badge, SoonBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { readableTextOn } from '@/lib/color';
import type { Material } from '@/types/models';
import { faviconOf, formatBytes, KIND_META, thumbnailOf } from './kinds';

interface MaterialItemProps {
  material: Material;
  onOpen: () => void;
  onToggleFavorite: () => void;
  actions: Action[];
  onContextMenu: (e: MouseEvent) => void;
  /** caminho da pasta (mostrado nos resultados da busca) */
  location?: string;
  topicName?: string;
}

/** Ícone do tipo (ou favicon do link) num quadrado colorido. */
export function KindIcon({ material, size = 'md' }: { material: Material; size?: 'sm' | 'md' | 'lg' }) {
  const meta = KIND_META[material.kind];
  const Icon = meta.icon;
  const favicon = material.kind === 'link' ? faviconOf(material.linkUrl) : null;
  const [faviconFailed, setFaviconFailed] = useState(false);
  const box = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-14 rounded-2xl' }[size];
  const icon = { sm: 'size-4', md: 'size-5', lg: 'size-7' }[size];

  if (favicon && !faviconFailed) {
    return (
      <span className={cn('grid shrink-0 place-items-center border border-border bg-bg', box)}>
        <img src={favicon} alt="" className={icon} onError={() => setFaviconFailed(true)} />
      </span>
    );
  }
  return (
    <span className={cn('grid shrink-0 place-items-center', box)} style={{ backgroundColor: meta.color, color: readableTextOn(meta.color) }}>
      <Icon className={icon} aria-hidden />
    </span>
  );
}

function FavoriteButton({ active, onToggle, name }: { active: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={active}
      aria-label={active ? `Desfavoritar ${name}` : `Favoritar ${name}`}
      className={cn(
        'rounded-md p-1 transition-colors hover:bg-primary-soft',
        active ? 'text-warning' : 'text-text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      <Star className={cn('size-4', active && 'fill-current')} />
    </button>
  );
}

function QuizSoon() {
  return (
    <span title="Gerar quiz (Etapa 2)" className="inline-flex items-center gap-1 text-xs text-text-muted opacity-70">
      <Sparkles className="size-3.5" aria-hidden />
      <SoonBadge />
    </span>
  );
}

const date = (m: Material) => m.updatedAt?.toDate?.().toLocaleDateString('pt-BR') ?? '';

/** Card do modo grade. */
export function MaterialCard({ material, onOpen, onToggleFavorite, actions, onContextMenu, location, topicName }: MaterialItemProps) {
  const thumb = thumbnailOf(material);
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = KIND_META[material.kind];
  const canQuiz = material.kind === 'pdf' || material.kind === 'word' || material.kind === 'note';

  return (
    <div onContextMenu={onContextMenu} className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-card">
      <button type="button" onClick={onOpen} className="relative block aspect-[16/10] w-full overflow-hidden bg-bg" aria-label={`Abrir ${material.title}`}>
        {thumb && !thumbFailed ? (
          <img src={thumb} alt="" loading="lazy" className="size-full object-cover" onError={() => setThumbFailed(true)} />
        ) : (
          <span className="grid size-full place-items-center">
            <KindIcon material={material} size="lg" />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start gap-1">
          <button type="button" onClick={onOpen} className="line-clamp-2 flex-1 text-left text-sm font-medium text-text hover:text-primary-text">
            {material.title}
          </button>
          <FavoriteButton active={material.favorite} onToggle={onToggleFavorite} name={material.title} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="neutral">{meta.label}</Badge>
          {topicName && <Badge variant="primary">{topicName}</Badge>}
          {material.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="neutral">
              #{t}
            </Badge>
          ))}
        </div>
        {location && <p className="truncate text-xs text-text-muted">em {location}</p>}
        <div className="mt-auto flex items-center justify-between pt-1">
          {canQuiz ? <QuizSoon /> : <span className="text-xs text-text-muted">{date(material)}</span>}
          <ActionMenuButton actions={actions} label={`Ações de ${material.title}`} className="-mr-1.5" />
        </div>
      </div>
    </div>
  );
}

/** Linha do modo lista. */
export function MaterialRow({ material, onOpen, onToggleFavorite, actions, onContextMenu, location, topicName }: MaterialItemProps) {
  const meta = KIND_META[material.kind];
  return (
    <div onContextMenu={onContextMenu} className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 hover:shadow-card">
      <KindIcon material={material} size="sm" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-text hover:text-primary-text">{material.title}</span>
        <span className="block truncate text-xs text-text-muted">
          {meta.label}
          {material.cloudinary && ` · ${formatBytes(material.cloudinary.bytes)}`}
          {topicName && ` · ${topicName}`}
          {location && ` · em ${location}`}
        </span>
      </button>
      <span className="hidden text-xs text-text-muted md:block">{date(material)}</span>
      <FavoriteButton active={material.favorite} onToggle={onToggleFavorite} name={material.title} />
      <ActionMenuButton actions={actions} label={`Ações de ${material.title}`} />
    </div>
  );
}
