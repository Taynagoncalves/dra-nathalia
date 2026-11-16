import { useQuery } from '@tanstack/react-query';
import { doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { dateKey } from '@/lib/dates';
import { emptyActivity, gamify, type Activity } from '@/lib/gamification';
import { attemptDay } from '@/lib/stats';
import { getDb } from '@/services/firebase/app';
import { docsWithId, userCol } from '@/services/firebase/db';
import { ensureNotification } from '@/services/firebase/notifications';
import type { Deck, PracticeDay } from '@/types/models';
import { useAttempts, useErrors } from './useQuestions';
import { useSimulations } from './useSimulator';
import { useSessions } from './useStats';
import { useUid } from './useUid';

const tsDay = (t: { toDate?: () => Date } | null | undefined) => dateKey(t?.toDate?.() ?? new Date());

export function usePracticeDays() {
  const uid = useUid();
  return useQuery({
    queryKey: ['practiceDays', uid],
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === 'gerando' || d.status === 'avaliando') ? 5000 : false),
    queryFn: async () => docsWithId<PracticeDay>(await getDocs(query(userCol(uid, 'practiceDays'), orderBy('createdAt', 'desc')))),
  });
}

function useQuizResults() {
  const uid = useUid();
  return useQuery({
    queryKey: ['quizResults', uid],
    queryFn: async () => (await getDocs(userCol(uid, 'quizResults'))).docs.map((d) => d.data() as { score: number; createdAt?: { toDate: () => Date } }),
  });
}

function useDeckDates() {
  const uid = useUid();
  return useQuery({
    queryKey: ['decks', uid],
    queryFn: async () => docsWithId<Deck>(await getDocs(query(userCol(uid, 'decks'), orderBy('createdAt', 'desc')))),
  });
}

/** XP, nível, missões, desafio semanal e conquistas, calculados da atividade. */
export function useGamification() {
  const attempts = useAttempts();
  const sessions = useSessions();
  const errors = useErrors();
  const quizzes = useQuizResults();
  const sims = useSimulations();
  const decks = useDeckDates();
  const days = usePracticeDays();
  const all = [attempts, sessions, errors, quizzes, sims, decks, days];
  const isLoading = all.some((q) => q.isLoading);
  const error = all.find((q) => q.isError)?.error ?? null;
  const today = dateKey();

  const data = useMemo(() => {
    if (isLoading) return null;
    const a: Activity = emptyActivity();
    a.attempts = (attempts.data ?? []).map((x) => ({ day: attemptDay(x), correct: x.isCorrect }));
    a.sessions = (sessions.data ?? []).map((s) => ({ day: s.date, minutes: s.minutes }));
    a.quizzes = (quizzes.data ?? []).map((q) => ({ day: tsDay(q.createdAt), score: q.score }));
    a.simulations = (sims.data ?? [])
      .filter((s) => s.status === 'corrigida')
      .map((s) => ({ day: tsDay(s.submittedAt ?? s.createdAt), score: s.score ?? 0, role: s.role, caseId: s.caseId }));
    a.decks = (decks.data ?? []).map((d) => ({ day: tsDay(d.createdAt) }));
    a.practiceDays = (days.data ?? []).filter((d) => d.status === 'concluido').map((d) => ({ day: tsDay(d.finishedAt ?? d.createdAt), score: d.score ?? 0 }));
    a.errorsResolved = (errors.data ?? []).filter((e) => e.resolved).length;
    return Object.assign(gamify(a, today), { activity: a });
  }, [isLoading, attempts.data, sessions.data, quizzes.data, sims.data, decks.data, days.data, errors.data, today]);

  return { data, isLoading, error };
}

const notifiedKey = (uid: string) => `conquistas-avisadas:${uid}`;

/**
 * Mantém xp/level do perfil em dia e avisa as conquistas novas
 * (toast + notificação no sino, uma vez só: o ID da notificação é fixo).
 */
export function useGamificationSync(g: ReturnType<typeof gamify> | null) {
  const uid = useUid();
  const { profile } = useAuth();
  const synced = useRef<string>('');

  useEffect(() => {
    if (!g) return;
    const sig = `${g.xp}:${g.level}`;
    if (synced.current !== sig && (profile?.xp !== g.xp || profile?.level !== g.level)) {
      synced.current = sig;
      updateDoc(doc(getDb(), 'users', uid), { xp: g.xp, level: g.level }).catch(() => {});
    }

    let notified: string[] = [];
    try {
      notified = JSON.parse(localStorage.getItem(notifiedKey(uid)) ?? '[]');
    } catch {
      /* armazenamento indisponível */
    }
    const fresh = g.achievements.filter((x) => x.unlocked && !notified.includes(x.def.id));
    if (!fresh.length) return;
    (async () => {
      let shown = 0;
      for (const x of fresh) {
        const created = await ensureNotification(uid, `conquista_${x.def.id}`, {
          kind: 'conquista',
          title: `Conquista desbloqueada: ${x.def.title}`,
          body: x.def.description,
          url: '/conquistas',
        }).catch(() => false);
        if (created && shown++ < 2) toast.success(`🏆 Conquista: ${x.def.title}`, { description: x.def.description });
      }
      try {
        localStorage.setItem(notifiedKey(uid), JSON.stringify([...notified, ...fresh.map((x) => x.def.id)]));
      } catch {
        /* sem armazenamento: o ID fixo da notificação evita duplicatas */
      }
    })();
  }, [g, uid, profile?.xp, profile?.level]);
}
