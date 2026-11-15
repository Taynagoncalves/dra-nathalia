import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  GraduationCap,
  Hand,
  Keyboard,
  Loader2,
  Maximize,
  Mic,
  MicOff,
  NotebookPen,
  Sparkles,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { SlideView } from '@/components/teacher/SlideView';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { speak, stopSpeaking, useSpeechRecognition } from '@/lib/speech';
import { createQuiz } from '@/services/ai';
import { getDb } from '@/services/firebase/app';
import { docWithId, userDoc } from '@/services/firebase/db';
import { createError } from '@/services/firebase/errors';
import {
  answerTayna,
  askTayna,
  createLiveSession,
  endLive,
  evaluateTeaching,
  suggestLive,
  taynaFeedback,
  type TaynaFeedback,
  type TaynaInteraction,
  type TaynaQuestion,
  type TaynaReaction,
  type TeachingEvaluation,
} from '@/services/teacher';
import { ERROR_CATEGORIES, type Deck, type ErrorCategory, type LiveSession, type TaynaLevel, type TaynaPersonality } from '@/types/models';
import NotFound from '../NotFound';

type Mode = 'oral' | 'tayna' | 'aovivo';
interface TaynaConfig {
  level: TaynaLevel;
  moment: 'durante' | 'final';
  personality: TaynaPersonality;
  format: 'voz' | 'texto';
}
interface Asking {
  slideIndex: number | null;
  q: TaynaQuestion | null;
  isFollowUp: boolean;
  answer: string;
  reaction: TaynaReaction | null;
  loading: boolean;
}

const LEVELS: Record<TaynaLevel, string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado', pegadinha: 'Pegadinha', oab: 'OAB', concurso: 'Concurso' };
const PERSONALITIES: Record<TaynaPersonality, string> = {
  curiosa: 'Aluna curiosa (perguntas simples e práticas)',
  rigorosa: 'Examinadora rigorosa',
  advogada_do_diabo: 'Advogada do diabo (contesta os argumentos)',
};
const FINAL_QUESTIONS = 3;

export default function PresentPage() {
  const { deckId = '' } = useParams();
  const [params] = useSearchParams();
  const mode = (['oral', 'tayna', 'aovivo'] as Mode[]).find((m) => m === params.get('modo')) ?? 'oral';
  const uid = useUid();
  const deck = useQuery({ queryKey: ['deck', uid, deckId], queryFn: async () => docWithId<Deck>(await getDoc(userDoc(uid, 'decks', deckId))) });

  if (deck.isLoading) return <LoadingBlock label="Preparando a apresentação…" />;
  if (deck.isError) return <ErrorBlock error={deck.error} />;
  if (!deck.data) return <NotFound />;
  return <Presenter deck={deck.data} mode={mode} />;
}

function Presenter({ deck, mode }: { deck: Deck; mode: Mode }) {
  const navigate = useNavigate();
  const total = deck.slides.length;
  const [index, setIndex] = useState(0);
  const [transcripts, setTranscripts] = useState<string[]>(() => deck.slides.map(() => ''));
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<'config' | 'presenting' | 'finishing' | 'done'>(mode === 'tayna' ? 'config' : 'presenting');
  const [config, setConfig] = useState<TaynaConfig>({ level: 'intermediario', moment: 'durante', personality: 'curiosa', format: 'voz' });
  const [asking, setAsking] = useState<Asking | null>(null);
  const [interactions, setInteractions] = useState<TaynaInteraction[]>([]);
  const [askedSlides, setAskedSlides] = useState<Set<number>>(new Set());
  const [evaluation, setEvaluation] = useState<TeachingEvaluation | null>(null);
  const [feedback, setFeedback] = useState<TaynaFeedback | null>(null);
  const [finalLeft, setFinalLeft] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  // Fala → texto: vai para o slide atual, ou para a resposta à Tayna quando ela perguntou
  const target = useRef<{ kind: 'slide'; i: number } | { kind: 'answer' }>({ kind: 'slide', i: 0 });
  target.current = asking?.q && !asking.reaction ? { kind: 'answer' } : { kind: 'slide', i: index };
  const mic = useSpeechRecognition((text) => {
    const t = target.current;
    if (t.kind === 'answer') setAsking((a) => (a ? { ...a, answer: `${a.answer} ${text}`.trim() } : a));
    else setTranscripts((list) => list.map((x, j) => (j === t.i ? `${x} ${text}`.trim() : x)));
  });

  const transcriptList = () => transcripts.map((text, slideIndex) => ({ slideIndex, text })).filter((t) => t.text.trim());
  const say = (text: string) => (config.format === 'voz' && mode === 'tayna' ? speak(text) : Promise.resolve());

  /* ── Tayna ─────────────────────────────────────────────────────── */
  const askedQuestions = () => interactions.map((x) => x.question);

  const startQuestion = async (slideIndex: number | null) => {
    setAsking({ slideIndex, q: null, isFollowUp: false, answer: '', reaction: null, loading: true });
    try {
      const q = await askTayna({
        deckId: deck.id,
        slideIndex,
        transcript: slideIndex === null ? transcripts.join('\n') : transcripts[slideIndex] ?? '',
        level: config.level,
        personality: config.personality,
        asked: askedQuestions(),
      });
      setAsking({ slideIndex, q, isFollowUp: false, answer: '', reaction: null, loading: false });
      say(`Tenho uma pergunta. ${q.question}`);
    } catch (err) {
      toast.error(friendlyError(err, 'A Tayna não conseguiu perguntar agora.'));
      setAsking(null);
    }
  };

  const submitAnswer = async (skip = false) => {
    if (!asking?.q) return;
    if (skip) {
      setInteractions((l) => [...l, { slideIndex: asking.slideIndex, question: asking.q!.question, answer: '', verdict: 'sem_resposta', note: 'Pulou a pergunta.' }]);
      return continueAfterTayna();
    }
    setAsking({ ...asking, loading: true });
    try {
      const r = await answerTayna({
        deckId: deck.id,
        slideIndex: asking.slideIndex,
        question: asking.q.question,
        expectedAnswer: asking.q.expectedAnswer,
        answer: asking.answer,
        personality: config.personality,
        isFollowUp: asking.isFollowUp,
      });
      setInteractions((l) => [...l, { slideIndex: asking.slideIndex, question: asking.q!.question, answer: asking.answer, verdict: r.verdict, note: r.note }]);
      setAsking({ ...asking, reaction: r, loading: false });
      await say(r.followUp ? `${r.reaction} ${r.followUp}` : r.reaction);
    } catch (err) {
      toast.error(friendlyError(err));
      setAsking({ ...asking, loading: false });
    }
  };

  const followUp = () => {
    if (!asking?.reaction?.followUp || !asking.q) return;
    setAsking({ slideIndex: asking.slideIndex, q: { ...asking.q, question: asking.reaction.followUp }, isFollowUp: true, answer: '', reaction: null, loading: false });
  };

  const continueAfterTayna = () => {
    stopSpeaking();
    setAsking(null);
    if (finalLeft > 0) {
      const left = finalLeft - 1;
      setFinalLeft(left);
      if (left > 0) return startQuestion(null);
      return finish();
    }
    if (index < total - 1) setIndex((i) => i + 1);
    else finish();
  };

  /* ── Navegação ─────────────────────────────────────────────────── */
  const next = () => {
    if (mode === 'tayna' && config.moment === 'durante' && !askedSlides.has(index)) {
      setAskedSlides((s) => new Set(s).add(index));
      return startQuestion(index);
    }
    if (index < total - 1) setIndex((i) => i + 1);
    else endPresentation();
  };

  const endPresentation = () => {
    if (mode === 'tayna' && config.moment === 'final' && finalLeft === 0 && !interactions.length) {
      setFinalLeft(FINAL_QUESTIONS);
      return startQuestion(null);
    }
    finish();
  };

  const finish = async () => {
    mic.stop();
    stopSpeaking();
    setPhase('finishing');
    try {
      if (mode === 'oral') setEvaluation(await evaluateTeaching(deck.id, transcriptList()));
      if (mode === 'tayna') setFeedback(await taynaFeedback(deck.id, interactions, transcriptList()));
      setPhase('done');
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível gerar o feedback.'));
      setPhase('presenting');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || asking || phase !== 'presenting') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => stopSpeaking(), []);

  /* ── Telas ─────────────────────────────────────────────────────── */
  if (phase === 'config') return <TaynaConfigView config={config} onChange={setConfig} onStart={() => setPhase('presenting')} onBack={() => navigate(`/professora/${deck.id}`)} />;
  if (phase === 'finishing')
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="size-8 animate-spin text-primary-text" />
        <p className="text-sm text-text">{mode === 'tayna' ? 'A Tayna está escrevendo o seu feedback…' : 'A IA está avaliando a sua explicação…'}</p>
      </Card>
    );
  if (phase === 'done' && evaluation) return <EvaluationView deck={deck} evaluation={evaluation} />;
  if (phase === 'done' && feedback) return <TaynaFeedbackView deck={deck} feedback={feedback} interactions={interactions} />;

  const slide = deck.slides[index]!;
  return (
    <div className="mx-auto max-w-6xl space-y-4" ref={stageRef}>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink to={`/professora/${deck.id}`} variant="ghost" size="sm">
          <ArrowLeft className="size-4" /> Sair
        </ButtonLink>
        <h1 className="min-w-0 flex-1 truncate font-semibold text-text">{deck.title}</h1>
        <Badge variant="primary">{mode === 'oral' ? 'Ensino oral' : mode === 'tayna' ? 'Modo Tayna' : 'Ao vivo'}</Badge>
        <Button variant="ghost" size="icon" onClick={() => stageRef.current?.requestFullscreen?.()} aria-label="Tela cheia">
          <Maximize className="size-4" />
        </Button>
      </div>
      <ProgressBar value={((index + 1) / total) * 100} label="Progresso da apresentação" />

      <div className={cn('grid gap-4', mode === 'aovivo' ? 'lg:grid-cols-[1fr_20rem]' : 'lg:grid-cols-[1fr_22rem]')}>
        <div className="space-y-3">
          <SlideView slide={slide} index={index} total={total} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || !!asking}>
              <ArrowLeft className="size-4" /> Anterior
            </Button>
            <Button onClick={next} disabled={!!asking}>
              {index < total - 1 ? (
                <>
                  Próximo <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <Square className="size-4" /> Encerrar
                </>
              )}
            </Button>
            <span className="ml-auto text-xs text-text-muted">Setas ← → também navegam</span>
          </div>
        </div>

        <div className="space-y-3">
          {mode === 'aovivo' ? (
            <LivePanel deck={deck} index={index} />
          ) : (
            <>
              {/* Microfone e transcrição */}
              <Card className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  {mic.supported && !typing ? (
                    <Button variant={mic.listening ? 'danger' : 'primary'} size="sm" onClick={mic.listening ? mic.stop : mic.start}>
                      {mic.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />} {mic.listening ? 'Parar microfone' : 'Ligar microfone'}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setTyping((t) => !t)}>
                    <Keyboard className="size-4" /> {typing ? 'Usar voz' : 'Digitar'}
                  </Button>
                  {mic.listening && <span className="ml-auto size-2.5 animate-pulse rounded-full bg-error" aria-label="Gravando" />}
                </div>
                {mic.error && <p className="text-xs text-warning">{mic.error}</p>}
                {!mic.supported && <p className="text-xs text-text-muted">Este navegador não transcreve a fala: digite o que explicaria.</p>}
                <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">O que você disse neste slide</p>
                {typing || !mic.supported ? (
                  <Textarea rows={5} value={transcripts[index]} onChange={(e) => setTranscripts((l) => l.map((x, j) => (j === index ? e.target.value : x)))} placeholder="Explique o slide com suas palavras…" />
                ) : (
                  <p className="max-h-48 min-h-20 overflow-y-auto rounded-lg bg-bg p-2 text-sm text-text">
                    {transcripts[index] || <span className="text-text-muted">Ligue o microfone e explique o slide em voz alta.</span>}
                    {mic.interim && target.current.kind === 'slide' && <span className="text-text-muted"> {mic.interim}</span>}
                  </p>
                )}
              </Card>

              {/* Tayna */}
              {mode === 'tayna' && <TaynaPanel asking={asking} format={config.format} interim={mic.interim} onAnswerChange={(answer) => setAsking((a) => (a ? { ...a, answer } : a))} onSubmit={() => submitAnswer()} onSkip={() => submitAnswer(true)} onFollowUp={followUp} onContinue={continueAfterTayna} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Configuração da Tayna ───────────────────────────────────────── */

function TaynaConfigView({ config, onChange, onStart, onBack }: { config: TaynaConfig; onChange: (c: TaynaConfig) => void; onStart: () => void; onBack: () => void }) {
  const set = <K extends keyof TaynaConfig>(k: K, v: TaynaConfig[K]) => onChange({ ...config, [k]: v });
  return (
    <Card className="mx-auto max-w-xl space-y-5 p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-text">
          <GraduationCap className="size-6" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-text">Faça perguntas para mim — Tayna</h1>
          <p className="text-sm text-text-muted">Apresente os slides; a Tayna assiste e pergunta.</p>
        </div>
      </div>
      <Field label="Nível">
        {(id) => (
          <Select id={id} value={config.level} onChange={(e) => set('level', e.target.value as TaynaLevel)}>
            {Object.entries(LEVELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Personalidade">
        {(id) => (
          <Select id={id} value={config.personality} onChange={(e) => set('personality', e.target.value as TaynaPersonality)}>
            {Object.entries(PERSONALITIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quando ela pergunta">
          {(id) => (
            <Select id={id} value={config.moment} onChange={(e) => set('moment', e.target.value as TaynaConfig['moment'])}>
              <option value="durante">Durante (ao fim de cada slide)</option>
              <option value="final">Só no final</option>
            </Select>
          )}
        </Field>
        <Field label="Formato">
          {(id) => (
            <Select id={id} value={config.format} onChange={(e) => set('format', e.target.value as TaynaConfig['format'])}>
              <option value="voz">Voz (ela fala)</option>
              <option value="texto">Texto</option>
            </Select>
          )}
        </Field>
      </div>
      <Alert variant="info">Dica: use fone de ouvido para o microfone não captar a voz da Tayna.</Alert>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onStart}>
          <Hand className="size-4" /> Começar
        </Button>
      </div>
    </Card>
  );
}

function TaynaPanel({
  asking,
  format,
  interim,
  onAnswerChange,
  onSubmit,
  onSkip,
  onFollowUp,
  onContinue,
}: {
  asking: Asking | null;
  format: 'voz' | 'texto';
  interim: string;
  onAnswerChange: (a: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onFollowUp: () => void;
  onContinue: () => void;
}) {
  if (!asking)
    return (
      <Card className="flex items-center gap-3 p-3 text-sm text-text-muted">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <GraduationCap className="size-4.5" />
        </span>
        A Tayna está assistindo…
      </Card>
    );
  return (
    <Card className="space-y-3 border-primary p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-on-primary">
          <Hand className="size-4" />
        </span>
        Tayna levantou a mão
        {format === 'voz' && asking.q && (
          <button type="button" onClick={() => speak(asking.reaction ? asking.reaction.reaction : asking.q!.question)} className="ml-auto text-text-muted hover:text-text" aria-label="Ouvir de novo">
            <Volume2 className="size-4" />
          </button>
        )}
      </p>
      {asking.loading && !asking.q ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="size-4 animate-spin" /> Pensando numa pergunta…
        </p>
      ) : (
        asking.q && (
          <>
            <p className="rounded-xl bg-primary-soft p-3 text-sm text-text">{asking.q.question}</p>
            {!asking.reaction ? (
              <>
                <Textarea rows={3} value={asking.answer} onChange={(e) => onAnswerChange(e.target.value)} placeholder="Responda falando (microfone ligado) ou digite…" aria-label="Sua resposta" />
                {interim && <p className="text-xs text-text-muted">{interim}</p>}
                <div className="flex justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    Pular
                  </Button>
                  <Button size="sm" onClick={onSubmit} disabled={!asking.answer.trim()} loading={asking.loading}>
                    Responder
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className={cn('rounded-xl border p-3 text-sm', asking.reaction.verdict === 'boa' ? 'border-success/40 text-text' : 'border-border text-text')}>
                  “{asking.reaction.reaction}”
                  {asking.reaction.followUp && <span className="mt-1 block font-medium">{asking.reaction.followUp}</span>}
                </p>
                <div className="flex justify-end gap-2">
                  {asking.reaction.followUp ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={onContinue}>
                        Seguir
                      </Button>
                      <Button size="sm" onClick={onFollowUp}>
                        Responder
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={onContinue}>
                      Continuar <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )
      )}
    </Card>
  );
}

/* ── Ao vivo (lado de quem apresenta) ────────────────────────────── */

function LivePanel({ deck, index }: { deck: Deck; index: number }) {
  const [code, setCode] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [ended, setEnded] = useState(false);
  const started = useRef(false);
  const suggested = useRef(new Set<number>());

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createLiveSession(deck.id)
      .then(({ code }) => setCode(code))
      .catch((err) => toast.error(friendlyError(err, 'Não foi possível criar a sessão ao vivo.')));
  }, [deck.id]);

  useEffect(() => {
    if (!code) return;
    return onSnapshot(doc(getDb(), 'liveSessions', code), (snap) => setSession(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveSession) : null));
  }, [code]);

  const syncSlide = useCallback(
    (i: number) => {
      if (!code || ended) return;
      updateDoc(doc(getDb(), 'liveSessions', code), { currentSlide: i }).catch(() => {});
      if (!suggested.current.has(i)) {
        suggested.current.add(i);
        suggestLive(code, i).catch(() => suggested.current.delete(i));
      }
    },
    [code, ended],
  );
  useEffect(() => syncSlide(index), [index, syncSlide]);

  if (!code)
    return (
      <Card className="flex items-center gap-2 p-3 text-sm text-text-muted">
        <Loader2 className="size-4 animate-spin" /> Criando a sessão…
      </Card>
    );

  const link = `${window.location.origin}/ao-vivo/${code}`;
  const questions = session?.questions ?? [];
  const people = Object.values(session?.participants ?? {});

  return (
    <div className="space-y-3">
      <Card className="space-y-2 p-3 text-center">
        <p className="text-xs text-text-muted">Peça para a outra pessoa abrir no celular:</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary-text">{code}</p>
        <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copiado!'))} className="inline-flex items-center gap-1 text-xs text-primary-text hover:underline">
          <Copy className="size-3" /> {link.replace(/^https?:\/\//, '')}
        </button>
        <p className="text-xs text-text-muted">{people.length ? `Na sala: ${people.join(', ')}` : 'Ninguém entrou ainda.'}</p>
      </Card>
      <Card className="space-y-2 p-3">
        <CardTitle className="text-sm">Perguntas ({questions.length})</CardTitle>
        {!questions.length ? (
          <p className="text-xs text-text-muted">As perguntas feitas pelo celular aparecem aqui.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {[...questions].reverse().map((q) => (
              <li key={q.id} className="rounded-lg border border-border p-2 text-sm">
                <p className="text-text">{q.text}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                  {q.askedByName} · slide {q.slideIndex + 1}
                  {q.result === 'certa' && <CheckCircle2 className="ml-auto size-4 text-success" aria-label="Certa" />}
                  {q.result === 'errada' && <XCircle className="ml-auto size-4 text-error" aria-label="Errada" />}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!ended ? (
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            await endLive(code).catch(() => {});
            setEnded(true);
            toast.success('Sessão encerrada.');
          }}
        >
          <Square className="size-4" /> Encerrar sessão ao vivo
        </Button>
      ) : (
        <LiveSummary deck={deck} questions={questions} />
      )}
    </div>
  );
}

function LiveSummary({ deck, questions }: { deck: Deck; questions: LiveSession['questions'] }) {
  const uid = useUid();
  const wrong = questions.filter((q) => q.result === 'errada');
  const [saved, setSaved] = useState(false);
  return (
    <Card className="space-y-2 p-3 text-sm">
      <p className="font-semibold text-text">
        Resultado: {questions.filter((q) => q.result === 'certa').length} certas · {wrong.length} erradas · {questions.filter((q) => !q.result).length} sem avaliação
      </p>
      {wrong.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          disabled={saved}
          onClick={async () => {
            for (const q of wrong) {
              await createError(uid, { questionId: null, subjectId: deck.subjectId, topicId: deck.topicId ?? null, category: 'Confundiu conceitos', note: `Tayna de verdade — ${q.text}${q.aiNote ? `\nO que faltou: ${q.aiNote}` : ''}` }).catch(() => {});
            }
            setSaved(true);
            toast.success('Erros registrados no caderno.');
          }}
        >
          <NotebookPen className="size-4" /> {saved ? 'Registrados ✓' : 'Registrar as erradas no caderno'}
        </Button>
      )}
    </Card>
  );
}

/* ── Feedbacks ───────────────────────────────────────────────────── */

function FollowUpActions({ deck, toReview, mistakes }: { deck: Deck; toReview: string[]; mistakes: string[] }) {
  const navigate = useNavigate();
  const uid = useUid();
  const [category, setCategory] = useState<ErrorCategory>('Confundiu conceitos');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Card className="flex flex-wrap items-end gap-3">
      {toReview.length > 0 && (
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { quizId } = await createQuiz(
                { type: 'tema', subjectId: deck.subjectId, theme: toReview.join('; ').slice(0, 290) },
                { count: 5, types: ['multipla', 'certo_errado'], difficulty: 'medio', mode: 'treino', focus: 'geral' },
              );
              navigate(`/quizzes/${quizId}`);
            } catch (err) {
              toast.error(friendlyError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles className="size-4" /> Gerar quiz sobre o que errei
        </Button>
      )}
      {mistakes.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Motivo dos erros" className="min-w-56">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as ErrorCategory)} className="h-9">
                {ERROR_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            variant="secondary"
            disabled={saved}
            onClick={async () => {
              for (const m of mistakes) await createError(uid, { questionId: null, subjectId: deck.subjectId, topicId: deck.topicId ?? null, category, note: m }).catch(() => {});
              setSaved(true);
              toast.success(`${mistakes.length} erro(s) registrados no caderno.`);
            }}
          >
            <NotebookPen className="size-4" /> {saved ? 'Registrados ✓' : `Registrar ${mistakes.length} erro(s) no caderno`}
          </Button>
        </div>
      )}
    </Card>
  );
}

const List = ({ title, items, tone }: { title: string; items: string[]; tone?: 'success' | 'error' | 'warning' }) =>
  items.length ? (
    <Card>
      <CardTitle className={cn('mb-2 text-sm', tone === 'success' && 'text-success', tone === 'error' && 'text-error', tone === 'warning' && 'text-warning')}>{title}</CardTitle>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </Card>
  ) : null;

function EvaluationView({ deck, evaluation }: { deck: Deck; evaluation: TeachingEvaluation }) {
  const scores = [
    { label: 'Conceitos corretos', value: evaluation.scores.accuracy },
    { label: 'Cobertura', value: evaluation.scores.coverage },
    { label: 'Clareza', value: evaluation.scores.clarity },
    { label: 'Coerência', value: evaluation.scores.coherence },
  ];
  const mistakes = evaluation.perSlide.flatMap((p) => [
    ...p.errors.map((e) => `Ensino oral — slide ${p.slideIndex + 1} (${deck.slides[p.slideIndex]?.title ?? ''}): ${e}`),
    ...p.omissions.map((o) => `Ensino oral — slide ${p.slideIndex + 1}: faltou ${o}`),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-text">Avaliação da sua explicação</h1>
      <Card className="space-y-3">
        {scores.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-text">{s.label}</span>
              <span className="font-semibold text-text">{s.value}/10</span>
            </div>
            <ProgressBar value={s.value * 10} tone={s.value >= 7 ? 'success' : s.value >= 5 ? 'warning' : 'error'} label={s.label} />
          </div>
        ))}
        <p className="pt-2 text-sm text-text">{evaluation.summary}</p>
      </Card>
      <List title="Pontos fortes" items={evaluation.strengths} tone="success" />
      <section className="space-y-2">
        <h2 className="font-semibold text-text">Slide a slide</h2>
        {evaluation.perSlide.map((p) => (
          <Card key={p.slideIndex} className="space-y-1.5 p-4 text-sm">
            <p className="font-medium text-text">
              {p.slideIndex + 1}. {deck.slides[p.slideIndex]?.title}
            </p>
            {p.correct.map((c, i) => (
              <p key={`c${i}`} className="flex gap-1.5 text-text">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {c}
              </p>
            ))}
            {p.errors.map((c, i) => (
              <p key={`e${i}`} className="flex gap-1.5 text-text">
                <XCircle className="mt-0.5 size-4 shrink-0 text-error" /> {c}
              </p>
            ))}
            {p.omissions.map((c, i) => (
              <p key={`o${i}`} className="flex gap-1.5 text-text-muted">
                <span className="mt-0.5 shrink-0 text-warning">⊘</span> Faltou: {c}
              </p>
            ))}
          </Card>
        ))}
      </section>
      <List title="O que revisar" items={evaluation.toReview} tone="warning" />
      <FollowUpActions deck={deck} toReview={evaluation.toReview} mistakes={mistakes} />
    </div>
  );
}

function TaynaFeedbackView({ deck, feedback, interactions }: { deck: Deck; feedback: TaynaFeedback; interactions: TaynaInteraction[] }) {
  const mistakes = interactions
    .filter((x) => x.verdict === 'errada' || x.verdict === 'incompleta')
    .map((x) => `Modo Tayna — pergunta: ${x.question}\nMinha resposta: ${x.answer || '(sem resposta)'}\nO que faltou: ${x.note}`);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-text">
          <GraduationCap className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text">Feedback da Tayna</h1>
          <p className="text-sm text-text-muted">{interactions.length} pergunta(s) na sessão</p>
        </div>
      </div>
      <Card>
        <p className="text-sm text-text">“{feedback.summary}”</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Respondeu bem" items={feedback.wellAnswered} tone="success" />
        <List title="Respondeu mal" items={feedback.poorlyAnswered} tone="error" />
        <List title="Explicou com segurança" items={feedback.confident} tone="success" />
        <List title="Conceitos que você pulou" items={feedback.skippedConcepts} tone="warning" />
      </div>
      <List title="O que revisar" items={feedback.toReview} tone="warning" />
      <FollowUpActions deck={deck} toReview={feedback.toReview} mistakes={mistakes} />
    </div>
  );
}
