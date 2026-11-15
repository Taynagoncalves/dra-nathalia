import { ChevronDown, FileSignature, FileText, Gavel, Mail, MessageCircle, Receipt, ScrollText, ShieldAlert, Stethoscope, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { DOC_KIND_LABELS } from '@/lib/simulator';
import type { CaseDocKind, CaseDocument } from '@/types/models';

const ICONS: Record<CaseDocKind, LucideIcon> = {
  contrato: FileSignature,
  conversa: MessageCircle,
  comprovante: Receipt,
  decisao: Gavel,
  notificacao: ScrollText,
  email: Mail,
  boletim: ShieldAlert,
  laudo: Stethoscope,
  peticao: FileText,
  outro: FileText,
};

/** "Nome (dd/mm hh:mm): mensagem" → balão de conversa. */
const CHAT_LINE = /^(.{1,60}?)\s*\(([^)]{1,40})\)\s*:\s*(.+)$/;

function ChatContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const first = lines.map((l) => CHAT_LINE.exec(l)?.[1]).find(Boolean);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const m = CHAT_LINE.exec(l);
        if (!m) return <p key={i} className="text-center text-xs text-text-muted">{l}</p>;
        const mine = m[1] === first;
        return (
          <div key={i} className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-bl-sm bg-surface-elevated border border-border' : 'rounded-br-sm bg-primary-soft')}>
              <p className="text-xs font-semibold text-primary-text">
                {m[1]} <span className="font-normal text-text-muted">· {m[2]}</span>
              </p>
              <p className="whitespace-pre-wrap text-text">{m[3]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CaseDocumentCard({ doc, index, defaultOpen = false }: { doc: CaseDocument; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = ICONS[doc.kind] ?? FileText;
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">
            Doc. {index + 1} — {doc.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <Badge variant="neutral">{DOC_KIND_LABELS[doc.kind] ?? 'Documento'}</Badge>
            {doc.date}
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {doc.kind === 'conversa' ? (
            <ChatContent content={doc.content} />
          ) : (
            <div className={cn('whitespace-pre-wrap text-sm leading-relaxed text-text', ['contrato', 'decisao', 'peticao', 'laudo'].includes(doc.kind) && 'font-serif')}>{doc.content}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function CaseDocuments({ documents, className }: { documents: CaseDocument[]; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {documents.map((d, i) => (
        <CaseDocumentCard key={i} doc={d} index={i} />
      ))}
    </div>
  );
}
