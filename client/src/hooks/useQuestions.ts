import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import { lastResults } from '@/lib/questions';
import { createAttempt, listAttempts, type AttemptInput } from '@/services/firebase/attempts';
import { createError, deleteError, listErrors, updateError, type ErrorInput } from '@/services/firebase/errors';
import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
  type QuestionInput,
} from '@/services/firebase/questions';
import type { ErrorEntry, Question } from '@/types/models';
import { useUid } from './useUid';

export const questionKeys = {
  questions: (uid: string) => ['questions', uid] as const,
  attempts: (uid: string) => ['attempts', uid] as const,
  errors: (uid: string) => ['errors', uid] as const,
};

const onError = (err: unknown) => toast.error(friendlyError(err));

export function useQuestions() {
  const uid = useUid();
  return useQuery({ queryKey: questionKeys.questions(uid), queryFn: () => listQuestions(uid) });
}

export function useAttempts() {
  const uid = useUid();
  return useQuery({ queryKey: questionKeys.attempts(uid), queryFn: () => listAttempts(uid) });
}

/** Resultado da última tentativa de cada questão. */
export function useLastResults() {
  const attempts = useAttempts();
  return useMemo(() => lastResults(attempts.data ?? []), [attempts.data]);
}

export function useErrors() {
  const uid = useUid();
  return useQuery({ queryKey: questionKeys.errors(uid), queryFn: () => listErrors(uid) });
}

export function useQuestionMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const key = questionKeys.questions(uid);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (data: QuestionInput) => createQuestion(uid, data), onSuccess: refresh, onError }),
    update: useMutation({
      mutationFn: (v: { id: string; data: Partial<QuestionInput> }) => updateQuestion(uid, v.id, v.data),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteQuestion(uid, id),
      onMutate: async (id) => {
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<Question[]>(key);
        qc.setQueryData<Question[]>(key, (l) => l?.filter((q) => q.id !== id));
        return { previous };
      },
      onError: (err, _id, ctx) => {
        if (ctx?.previous) qc.setQueryData(key, ctx.previous);
        onError(err);
      },
      onSettled: refresh,
    }),
  };
}

export function useAttemptMutation() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AttemptInput) => createAttempt(uid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.attempts(uid) }),
    onError,
  });
}

export function useErrorMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const key = questionKeys.errors(uid);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const optimistic = async (change: (l: ErrorEntry[]) => ErrorEntry[]) => {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<ErrorEntry[]>(key);
    if (previous) qc.setQueryData(key, change(previous));
    return { previous };
  };
  const rollback = (err: unknown, _v: unknown, ctx?: { previous?: ErrorEntry[] }) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    onError(err);
  };

  return {
    create: useMutation({ mutationFn: (data: ErrorInput) => createError(uid, data), onSuccess: refresh, onError }),
    update: useMutation({
      mutationFn: (v: { id: string; data: Partial<Pick<ErrorEntry, 'category' | 'note' | 'resolved'>> }) =>
        updateError(uid, v.id, v.data),
      onMutate: (v) => optimistic((l) => l.map((e) => (e.id === v.id ? { ...e, ...v.data } : e))),
      onError: rollback,
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteError(uid, id),
      onMutate: (id) => optimistic((l) => l.filter((e) => e.id !== id)),
      onError: rollback,
      onSettled: refresh,
    }),
  };
}
