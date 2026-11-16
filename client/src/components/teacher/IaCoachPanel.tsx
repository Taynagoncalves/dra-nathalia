import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Loader2, Mic, MicOff, RefreshCw, Send, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import type { TaynaReaction, UnderstandingCheck } from '@/services/teacher';

/** Um retorno da IA sobre a fala de um slide (e a pergunta que veio junto). */
export interface CheckEntry {
  slideIndex: number;
  /** a fala analisada (para saber se mudou depois) */
  text: string;
  status: 'loading' | 'done' | 'error';
  result?: UnderstandingCheck;
  error?: string;
  answer: string;
  reaction?: TaynaReaction;
  answering?: boolean;
  skipped?: boolean;
}

const LEVEL = {
  bom: { label: 'Entendeu bem', variant: 'success' as const, icon: CheckCircle2 },
  parcial: { label: 'No caminho', variant: 'warning' as const, icon: CircleDashed },
  confuso: { label: 'Há confusão', variant: 'error' as const, icon: AlertTriangle },
};
const VERDICT = {
  boa: { label: 'Resposta certa', className: 'text-success', icon: CheckCircle2 },
  incompleta: { label: 'Resposta incompleta', className: 'text-warning', icon: CircleDashed },
  errada: { label: 'Resposta errada', className: 'text-error', icon: XCircle },
};

interface Props {
  entries: CheckEntry[];
  currentIndex: number;
  slideTitles: string[];
  /** de qual pergunta o microfone está preenchendo a resposta (null = está transcrevendo o slide) */
  answeringBy: number | null;
  micSupported: boolean;
  interim: string;
  canCheckNow: boolean;
  onCheckNow: () => void;
  onRetry: (slideIndex: number) => void;
  onAnswerChange: (slideIndex: number, text: string) => void;
  onToggleAnswerMic: (slideIndex: number) => void;
  onSubmitAnswer: (slideIndex: number) => void;
  onSkip: (slideIndex: number) => void;
}

/**
 * "Apresentar para a IA": a cada slide, a IA diz se você está entendendo
 * (o que está certo, o que corrigir, o que faltou) e faz uma pergunta sobre o
 * que você falou. Não trava a apresentação: os retornos chegam aqui enquanto você segue.
 */
export function IaCoachPanel(p: Props) {
  const ordered = [...p.entries].sort((a, b) => (a.slideIndex === p.currentIndex ? -1 : b.slideIndex === p.currentIndex ? 1 : b.slideIndex - a.slideIndex));
  return (
    <div className="space-y-3">
      <Card className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <Sparkles className="size-4 text-primary-text" /> Como estou indo?
        </p>
        <p className="text-xs text-text-muted">Ao passar de slide, a IA confere o que você falou e faz uma pergunta. Pode seguir apresentando: o retorno aparece aqui.</p>
        <Button size="sm" variant="secondary" onClick={p.onCheckNow} disabled={!p.canCheckNow}>
          <Sparkles className="size-4" /> Conferir este slide agora
        </Button>
      </Card>

      {!ordered.length && <p className="px-1 text-sm text-text-muted">Explique o primeiro slide e avance (ou toque em “Conferir este slide agora”).</p>}

      <ul className="space-y-3" aria-live="polite">
        {ordered.map((e) => (
          <li key={e.slideIndex}>
            <EntryCard e={e} title={p.slideTitles[e.slideIndex] ?? ''} {...p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryCard({ e, title, answeringBy, micSupported, interim, onRetry, onAnswerChange, onToggleAnswerMic, onSubmitAnswer, onSkip }: Props & { e: CheckEntry; title: string }) {
  const head = (
    <p className="mb-1 truncate text-xs font-semibold text-text-muted">
      Slide {e.slideIndex + 1} · {title}
    </p>
  );
  if (e.status === 'loading')
    return (
      <Card className="p-3">
        {head}
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="size-4 animate-spin" /> Analisando a sua explicação… pode seguir apresentando.
        </p>
      </Card>
    );
  if (e.status === 'error' || !e.result)
    return (
      <Card className="p-3">
        {head}
        <p className="text-sm text-error">{e.error ?? 'Não foi possível analisar.'}</p>
        <Button size="sm" variant="ghost" className="mt-1" onClick={() => onRetry(e.slideIndex)}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
      </Card>
    );

  const r = e.result;
  const lv = LEVEL[r.understanding] ?? LEVEL.parcial;
  const listening = answeringBy === e.slideIndex;
  const v = e.reaction ? VERDICT[e.reaction.verdict] : null;

  return (
    <Card className="space-y-3 p-3">
      <div>
        {head}
        <Badge variant={lv.variant}>
          <lv.icon className="mr-1 size-3" /> {lv.label}
        </Badge>
        <p className="mt-1.5 text-sm text-text">{r.message}</p>
      </div>
      {r.correct.length > 0 && (
        <ul className="space-y-1 text-sm">
          {r.correct.map((c, i) => (
            <li key={i} className="flex gap-1.5 text-text">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-label="Certo" /> {c}
            </li>
          ))}
        </ul>
      )}
      {r.fixes.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {r.fixes.map((f, i) => (
            <li key={i} className="rounded-lg border border-error/30 bg-error/5 p-2">
              <p className="text-text-muted">
                <span className="font-medium text-error">Você disse: </span>
                {f.said}
              </p>
              <p className="text-text">
                <span className="font-medium text-success">O certo: </span>
                {f.correction}
              </p>
            </li>
          ))}
        </ul>
      )}
      {r.missing.length > 0 && (
        <div className="text-sm">
          <p className="text-xs font-semibold text-text-muted">Faltou falar</p>
          <ul className="list-disc pl-5 text-text">
            {r.missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pergunta sobre o que você apresentou */}
      <div className="space-y-2 rounded-lg bg-primary-soft/60 p-2.5">
        <p className="flex gap-1.5 text-sm font-medium text-text">
          <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary-text" /> {r.question.question}
        </p>
        {e.reaction && v ? (
          <div className="space-y-1">
            {e.answer && <p className="text-xs text-text-muted">Sua resposta: {e.answer}</p>}
            <p className={cn('flex items-center gap-1 text-sm font-semibold', v.className)}>
              <v.icon className="size-4" /> {v.label}
            </p>
            <p className="text-sm text-text">{e.reaction.reaction}</p>
          </div>
        ) : e.skipped ? (
          <p className="text-xs text-text-muted">Pergunta pulada. Resposta esperada: {r.question.expectedAnswer}</p>
        ) : (
          <>
            <Textarea
              rows={3}
              value={listening && interim ? `${e.answer} ${interim}`.trim() : e.answer}
              onChange={(ev) => onAnswerChange(e.slideIndex, ev.target.value)}
              placeholder="Responda aqui (ou por voz)…"
              aria-label="Sua resposta"
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {micSupported && (
                <Button size="sm" variant={listening ? 'danger' : 'secondary'} onClick={() => onToggleAnswerMic(e.slideIndex)}>
                  {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />} {listening ? 'Parar' : 'Responder por voz'}
                </Button>
              )}
              <Button size="sm" onClick={() => onSubmitAnswer(e.slideIndex)} disabled={!e.answer.trim()} loading={e.answering}>
                <Send className="size-4" /> Enviar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSkip(e.slideIndex)} disabled={e.answering}>
                Pular
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
