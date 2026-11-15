import { Info, Loader2, MessageSquareText, Send, Sparkles, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { useNotebookChat } from '@/hooks/useNotebook';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { askNotebook, clearNotebookChat } from '@/services/ai';
import type { NotebookMessage } from '@/types/models';
import { CitationChip } from './Citation';

const QUICK_ACTIONS = [
  { label: 'Explicar de forma simples', prompt: 'Explique de forma simples, como para quem está começando, o ponto principal destes materiais.' },
  { label: 'Resumir', prompt: 'Faça um resumo objetivo dos pontos mais importantes.' },
  { label: 'Comparar institutos', prompt: 'Compare os principais institutos/conceitos tratados nos materiais, mostrando semelhanças e diferenças.' },
  { label: 'Exemplo prático', prompt: 'Dê um exemplo prático (caso concreto) que ilustre o conteúdo principal.' },
  { label: 'Explicar artigo de lei', prompt: 'Explique os artigos de lei citados nos materiais, um a um, em linguagem simples.' },
];

/** Texto da resposta: parágrafos, listas com "- " e marcadores [n] viram citações clicáveis. */
function RichAnswer({ message, subjectId }: { message: NotebookMessage; subjectId: string }) {
  const cites = new Map((message.citations ?? []).map((c) => [c.n, c]));
  const inline = (text: string): ReactNode[] =>
    text.split(/(\[\d+(?:,\s*\d+)*\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      const nums = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
      if (nums) {
        return (
          <Fragment key={i}>
            {nums[1]!.split(/,\s*/).map((n) => (
              <CitationChip key={n} n={n} citation={cites.get(Number(n))} subjectId={subjectId} />
            ))}
          </Fragment>
        );
      }
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      return bold ? <strong key={i}>{bold[1]}</strong> : <Fragment key={i}>{part}</Fragment>;
    });

  const blocks = message.text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-text">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

interface ChatPanelProps {
  subjectId: string;
  /** fontes marcadas (vazio = todas) */
  materialIds: string[];
  disabled?: boolean;
}

/** Chat com os materiais (respostas com citações e sugestões de próximas perguntas). */
export function ChatPanel({ subjectId, materialIds, disabled }: ChatPanelProps) {
  const { messages, loading } = useNotebookChat(subjectId);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setPending(message);
    setInput('');
    try {
      await askNotebook(subjectId, materialIds, message);
    } catch (err) {
      setInput(message);
      toast.error(friendlyError(err, 'Não foi possível responder agora.'));
    } finally {
      setPending(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const last = messages.at(-1);

  return (
    <div className="flex h-full min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-6 animate-spin text-primary-text" />
          </div>
        ) : messages.length === 0 && !pending ? (
          <EmptyState
            icon={MessageSquareText}
            title="Converse com os seus materiais"
            description="Pergunte qualquer coisa: a resposta vem dos seus PDFs e anotações, com a fonte e a página de cada informação."
          />
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm whitespace-pre-line text-on-primary">{m.text}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="min-w-0 max-w-[92%] space-y-2 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3">
                  <RichAnswer message={m} subjectId={subjectId} />
                  {m.generalKnowledge && (
                    <p className="flex items-start gap-1.5 text-xs text-warning">
                      <Info className="mt-0.5 size-3.5 shrink-0" /> Parte desta resposta não veio dos seus materiais. Confira na legislação.
                    </p>
                  )}
                </div>
              </div>
            ),
          )
        )}
        {pending && (
          <>
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm whitespace-pre-line text-on-primary opacity-80">{pending}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="size-4 animate-spin" /> Lendo os materiais…
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* Sugestões e ações rápidas */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(last?.role === 'assistant' && last.followUps?.length ? last.followUps : QUICK_ACTIONS.map((q) => q.label)).map((label) => (
          <button
            key={label}
            type="button"
            disabled={!!pending || disabled}
            onClick={() => send(QUICK_ACTIONS.find((q) => q.label === label)?.prompt ?? label)}
            className="rounded-full border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-text disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={4000}
          disabled={disabled}
          placeholder={disabled ? 'Adicione fontes para conversar…' : 'Pergunte sobre os seus materiais… (Enter envia, Shift+Enter quebra linha)'}
          aria-label="Pergunta"
          className={cn(
            'min-h-11 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted',
            'focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:opacity-60',
          )}
        />
        <Button type="submit" size="icon" className="size-11" disabled={!input.trim() || !!pending || disabled} aria-label="Enviar">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
      {messages.length > 0 && (
        <button
          type="button"
          onClick={() => clearNotebookChat(subjectId).catch((err) => toast.error(friendlyError(err)))}
          className="mt-2 inline-flex items-center gap-1 self-start text-xs text-text-muted hover:text-error"
        >
          <Trash2 className="size-3" /> Limpar conversa
        </button>
      )}
    </div>
  );
}
