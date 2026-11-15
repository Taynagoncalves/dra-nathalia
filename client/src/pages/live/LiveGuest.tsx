import { signInAnonymously, updateProfile } from 'firebase/auth';
import { arrayUnion, doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import { BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap, Loader2, Send, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SlideView } from '@/components/teacher/SlideView';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { getAuthOrThrow, getDb } from '@/services/firebase/app';
import { evaluateLive } from '@/services/teacher';
import type { LiveQuestion, LiveSession } from '@/types/models';

const NAME_KEY = 'ao-vivo-nome';

/**
 * Tela da "Tayna de verdade": quem faz as perguntas entra pelo celular, sem
 * conta, com o código da sessão.
 */
export default function LiveGuest() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState(codeParam?.toUpperCase() ?? '');
  const [name, setName] = useState(() => sessionStorage.getItem(NAME_KEY) ?? '');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<LiveSession | null | undefined>(undefined);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c) || name.trim().length < 2) return;
    setBusy(true);
    try {
      const auth = getAuthOrThrow();
      const u = auth.currentUser ?? (await signInAnonymously(auth)).user;
      if (u.isAnonymous) await updateProfile(u, { displayName: name.trim() });
      await updateDoc(doc(getDb(), 'liveSessions', c), { [`participants.${u.uid}`]: name.trim().slice(0, 40) });
      sessionStorage.setItem(NAME_KEY, name.trim());
      if (c !== codeParam) navigate(`/ao-vivo/${c}`, { replace: true });
      setJoined(true);
    } catch (err) {
      const msg = (err as { code?: string }).code === 'permission-denied' || (err as { code?: string }).code === 'not-found' ? 'Sessão não encontrada ou já encerrada. Confira o código.' : friendlyError(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!joined) return;
    return onSnapshot(
      doc(getDb(), 'liveSessions', code),
      (snap) => setSession(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveSession) : null),
      () => setSession(null),
    );
  }, [joined, code]);

  if (!joined) {
    return (
      <Shell>
        <Card className="mx-auto max-w-sm space-y-4 p-6">
          <div className="text-center">
            <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary text-on-primary">
              <GraduationCap className="size-6" />
            </span>
            <h1 className="text-xl font-bold text-text">Você é a Tayna!</h1>
            <p className="mt-1 text-sm text-text-muted">Assista à apresentação e faça perguntas. Não precisa de conta.</p>
          </div>
          <form onSubmit={join} className="space-y-3">
            <Field label="Código da sessão">
              {(id) => <Input id={id} value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} className="text-center font-mono text-lg tracking-[0.3em] uppercase" placeholder="ABC123" autoComplete="off" />}
            </Field>
            <Field label="Seu nome">{(id) => <Input id={id} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana" />}</Field>
            <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6 || name.trim().length < 2}>
              Entrar
            </Button>
          </form>
          {user && !user.isAnonymous && <p className="text-center text-xs text-text-muted">Você está logada; vai entrar com o seu nome de conta.</p>}
        </Card>
      </Shell>
    );
  }

  if (session === undefined)
    return (
      <Shell>
        <div className="grid place-items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary-text" />
        </div>
      </Shell>
    );
  if (session === null || session.status !== 'ativa')
    return (
      <Shell>
        <Alert variant="info" title="Sessão encerrada" className="mx-auto max-w-md">
          A apresentação terminou. Obrigada por participar!
        </Alert>
      </Shell>
    );

  return (
    <Shell>
      <GuestRoom session={session} code={code} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg px-4 py-4">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-text">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-on-primary">
            <BookOpen className="size-3.5" />
          </span>
          Tayna ao vivo
        </span>
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function GuestRoom({ session, code }: { session: LiveSession; code: string }) {
  const uid = getAuthOrThrow().currentUser?.uid ?? '';
  const myName = session.participants?.[uid] ?? 'Tayna';
  const i = session.currentSlide;
  const slide = session.slides[i];
  const suggestions = session.suggestions?.[String(i)] ?? [];
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [custom, setCustom] = useState('');
  const mine = (session.questions ?? []).filter((q) => q.askedBy === uid);

  const ask = async (text: string, expectedAnswer: string | null) => {
    const q: LiveQuestion = {
      id: crypto.randomUUID().slice(0, 12),
      slideIndex: i,
      text: text.trim().slice(0, 500),
      expectedAnswer,
      askedBy: uid,
      askedByName: myName,
      result: null,
      createdAt: Date.now(),
    };
    try {
      await updateDoc(doc(getDb(), 'liveSessions', code), { questions: arrayUnion(q) });
      toast.success('Pergunta registrada. Faça em voz alta!');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const mark = async (id: string, result: 'certa' | 'errada') => {
    const ref = doc(getDb(), 'liveSessions', code);
    await runTransaction(getDb(), async (tx) => {
      const cur = ((await tx.get(ref)).get('questions') as LiveQuestion[]) ?? [];
      tx.update(ref, { questions: cur.map((q) => (q.id === id ? { ...q, result } : q)) });
    }).catch((err) => toast.error(friendlyError(err)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        <strong className="text-text">{session.deckTitle}</strong> · apresentado por {session.ownerName}
      </p>
      {slide && <SlideView slide={slide} index={i} total={session.slides.length} />}

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary-text" /> Perguntas sugeridas para este slide
        </CardTitle>
        {!suggestions.length ? (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="size-4 animate-spin" /> A IA está preparando sugestões…
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, k) => (
              <li key={k} className="rounded-xl border border-border p-3">
                <p className="text-sm font-medium text-text">{s.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => ask(s.question, s.answer)}>
                    <Send className="size-3.5" /> Vou perguntar esta
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen((o) => (o.has(k) ? (o.delete(k), new Set(o)) : new Set(o).add(k)))}>
                    {open.has(k) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {open.has(k) ? 'Esconder gabarito' : 'Ver gabarito'}
                  </Button>
                </div>
                {open.has(k) && <p className="mt-2 rounded-lg bg-primary-soft p-2 text-sm text-text">{s.answer}</p>}
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) ask(custom, null).then(() => setCustom(''));
          }}
          className="flex gap-2"
        >
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ou escreva a sua pergunta…" maxLength={500} aria-label="Sua pergunta" />
          <Button type="submit" disabled={!custom.trim()} aria-label="Registrar pergunta">
            <Send className="size-4" />
          </Button>
        </form>
      </Card>

      {mine.length > 0 && (
        <Card className="space-y-3">
          <CardTitle className="text-sm">Minhas perguntas</CardTitle>
          <ul className="space-y-3">
            {[...mine].reverse().map((q) => (
              <MyQuestion key={q.id} q={q} code={code} onMark={mark} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MyQuestion({ q, code, onMark }: { q: LiveQuestion; code: string; onMark: (id: string, r: 'certa' | 'errada') => void }) {
  const [heard, setHeard] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <li className="space-y-2 rounded-xl border border-border p-3 text-sm">
      <p className="text-text">
        <span className="text-text-muted">Slide {q.slideIndex + 1} · </span>
        {q.text}
      </p>
      {q.expectedAnswer && (
        <button type="button" onClick={() => setShowAnswer((s) => !s)} className="text-xs text-primary-text hover:underline">
          {showAnswer ? 'Esconder gabarito' : 'Ver gabarito'}
        </button>
      )}
      {showAnswer && q.expectedAnswer && <p className="rounded-lg bg-primary-soft p-2 text-text">{q.expectedAnswer}</p>}
      {q.result ? (
        <p className={cn('flex items-center gap-1.5 font-medium', q.result === 'certa' ? 'text-success' : 'text-error')}>
          {q.result === 'certa' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {q.result === 'certa' ? 'Respondeu certo' : 'Respondeu errado'}
          {q.aiNote && <span className="font-normal text-text-muted"> — {q.aiNote}</span>}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onMark(q.id, 'certa')}>
              <CheckCircle2 className="size-3.5" /> Acertou
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onMark(q.id, 'errada')}>
              <XCircle className="size-3.5" /> Errou
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-text-muted">Pedir para a IA avaliar a resposta</summary>
            <div className="mt-2 space-y-2">
              <Textarea rows={2} value={heard} onChange={(e) => setHeard(e.target.value)} placeholder="Resuma o que ela respondeu…" />
              <Button
                size="sm"
                disabled={!heard.trim()}
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await evaluateLive(code, q.id, heard);
                    toast(r.verdict === 'boa' ? 'A IA considerou a resposta boa!' : 'A IA anotou o que faltou.');
                  } catch (err) {
                    toast.error(friendlyError(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles className="size-3.5" /> Avaliar com IA
              </Button>
            </div>
          </details>
        </>
      )}
    </li>
  );
}
