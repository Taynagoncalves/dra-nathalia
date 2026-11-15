import { ArrowLeft, BookMarked, CalendarRange, FileText, HelpCircle, Loader2, Network, Trash2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useDeleteNotebookItem, useNotebookItems, notebookItemsKey } from '@/hooks/useNotebook';
import { useUid } from '@/hooks/useUid';
import { useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@/lib/firebaseErrors';
import { generateStudioItem } from '@/services/ai';
import type { NotebookItem, StudioContent, StudioKind } from '@/types/models';
import { FaqView, GuiaView, MindMapView, ResumoView, TimelineView } from './StudioViews';

export const STUDIO: Record<StudioKind, { label: string; text: string; icon: LucideIcon }> = {
  resumo: { label: 'Resumo', text: 'Panorama e pontos-chave', icon: FileText },
  guia: { label: 'Guia de estudo', text: 'Objetivos, termos-chave e autoavaliação', icon: BookMarked },
  faq: { label: 'Perguntas frequentes', text: 'Dúvidas comuns com respostas', icon: HelpCircle },
  linha_do_tempo: { label: 'Linha do tempo', text: 'Marcos, prazos e etapas em ordem', icon: CalendarRange },
  mapa_mental: { label: 'Mapa mental', text: 'Conceitos em ramos clicáveis', icon: Network },
};
const KINDS = Object.keys(STUDIO) as StudioKind[];

function StudioContentView({ item, subjectId }: { item: NotebookItem; subjectId: string }) {
  const c = item.content as never;
  switch (item.kind) {
    case 'resumo':
      return <ResumoView c={c as StudioContent['resumo']} subjectId={subjectId} />;
    case 'guia':
      return <GuiaView c={c as StudioContent['guia']} subjectId={subjectId} />;
    case 'faq':
      return <FaqView c={c as StudioContent['faq']} subjectId={subjectId} />;
    case 'linha_do_tempo':
      return <TimelineView c={c as StudioContent['linha_do_tempo']} subjectId={subjectId} />;
    case 'mapa_mental':
      return <MindMapView c={c as StudioContent['mapa_mental']} subjectId={subjectId} />;
  }
}

/** Estúdio do Caderno IA: gera e guarda resumo, guia, FAQ, linha do tempo e mapa mental. */
export function StudioPanel({ subjectId, materialIds, disabled }: { subjectId: string; materialIds: string[]; disabled?: boolean }) {
  const uid = useUid();
  const qc = useQueryClient();
  const items = useNotebookItems(subjectId);
  const remove = useDeleteNotebookItem(subjectId);
  const [generating, setGenerating] = useState<StudioKind | null>(null);
  const [open, setOpen] = useState<NotebookItem | null>(null);
  const [deleting, setDeleting] = useState<NotebookItem | null>(null);

  const generate = async (kind: StudioKind) => {
    setGenerating(kind);
    try {
      const item = await generateStudioItem(subjectId, materialIds, kind);
      await qc.invalidateQueries({ queryKey: notebookItemsKey(uid, subjectId) });
      setOpen(item);
      toast.success(`${STUDIO[kind].label} pronto!`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível gerar agora.'));
    } finally {
      setGenerating(null);
    }
  };

  if (open) {
    const meta = STUDIO[open.kind];
    const Icon = meta.icon;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
            <ArrowLeft className="size-4" /> Estúdio
          </Button>
          <Badge variant="primary">
            <Icon className="size-3" /> {meta.label}
          </Badge>
        </div>
        <h2 className="text-xl font-bold text-text">{open.title}</h2>
        {open.truncated && <Alert variant="info">As fontes são grandes: a IA usou trechos espalhados por todas elas.</Alert>}
        <StudioContentView item={open} subjectId={subjectId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {KINDS.map((k) => {
          const { label, text, icon: Icon } = STUDIO[k];
          const busy = generating === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => generate(k)}
              disabled={!!generating || disabled}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/40 disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text">{busy ? 'Gerando…' : label}</span>
                <span className="block text-xs text-text-muted">{text}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="Gerados">
        <h3 className="mb-2 text-sm font-semibold text-text">Gerados</h3>
        {items.isLoading ? (
          <Loader2 className="size-5 animate-spin text-primary-text" />
        ) : !items.data?.length ? (
          <p className="text-sm text-text-muted">Nada gerado ainda. Escolha um formato acima.</p>
        ) : (
          <ul className="space-y-2">
            {items.data.map((it) => {
              const meta = STUDIO[it.kind];
              const Icon = meta.icon;
              return (
                <li key={it.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pl-3">
                  <Icon className="size-4 shrink-0 text-primary-text" aria-hidden />
                  <button type="button" onClick={() => setOpen(it)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-text hover:text-primary-text">{it.title}</span>
                    <span className="block text-xs text-text-muted">
                      {meta.label}
                      {it.createdAt && ` · ${it.createdAt.toDate().toLocaleDateString('pt-BR')}`}
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" className="size-8 hover:text-error" onClick={() => setDeleting(it)} aria-label={`Excluir ${it.title}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Excluir “${deleting?.title}”?`}
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deleting) remove(deleting.id).catch((err) => toast.error(friendlyError(err)));
          setDeleting(null);
        }}
      />
    </div>
  );
}
