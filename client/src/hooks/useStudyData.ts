import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type ProjectInput,
} from '@/services/firebase/projects';
import {
  createSubject,
  deleteSubject,
  getSubject,
  listAllSubjects,
  listSubjects,
  reorderSubjects,
  updateSubject,
  type SubjectInput,
} from '@/services/firebase/subjects';
import {
  createTopic,
  deleteTopic,
  listAllTopics,
  listTopics,
  reorderTopics,
  updateTopic,
} from '@/services/firebase/topics';
import type { Project, Subject, Topic } from '@/types/models';
import { useUid } from './useUid';

/** Chaves do cache (TanStack Query). Tudo começa pelo uid. */
export const keys = {
  projects: (uid: string) => ['projects', uid] as const,
  subjectsRoot: (uid: string) => ['subjects', uid] as const,
  subjects: (uid: string, projectId: string) => ['subjects', uid, 'project', projectId] as const,
  allSubjects: (uid: string) => ['subjects', uid, 'all'] as const,
  subject: (uid: string, id: string) => ['subjects', uid, 'one', id] as const,
  topicsRoot: (uid: string) => ['topics', uid] as const,
  topics: (uid: string, subjectId: string) => ['topics', uid, 'subject', subjectId] as const,
  allTopics: (uid: string) => ['topics', uid, 'all'] as const,
};

const onError = (err: unknown) => toast.error(friendlyError(err));

/* ── Projetos ─────────────────────────────────────────────────────── */

export function useProjects() {
  const uid = useUid();
  return useQuery({ queryKey: keys.projects(uid), queryFn: () => listProjects(uid) });
}

export function useProjectMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.projects(uid) });

  return {
    create: useMutation({
      mutationFn: ({ data, order }: { data: ProjectInput; order: number }) => createProject(uid, data, order),
      onSuccess: invalidate,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<ProjectInput & { archived: boolean }> }) =>
        updateProject(uid, id, data),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteProject(uid, id),
      onSuccess: invalidate,
      onError,
    }),
  };
}

/* ── Matérias ─────────────────────────────────────────────────────── */

export function useSubjects(projectId: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: keys.subjects(uid, projectId ?? ''),
    queryFn: () => listSubjects(uid, projectId!),
    enabled: !!projectId,
  });
}

export function useAllSubjects() {
  const uid = useUid();
  return useQuery({ queryKey: keys.allSubjects(uid), queryFn: () => listAllSubjects(uid) });
}

export function useSubject(id: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: keys.subject(uid, id ?? ''),
    queryFn: () => getSubject(uid, id!),
    enabled: !!id,
  });
}

export function useSubjectMutations(projectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.subjectsRoot(uid) });
  const listKey = keys.subjects(uid, projectId);

  return {
    create: useMutation({
      mutationFn: ({ data, order }: { data: SubjectInput; order: number }) =>
        createSubject(uid, projectId, data, order),
      onSuccess: invalidate,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<SubjectInput> }) => updateSubject(uid, id, data),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteSubject(id),
      onSuccess: () => {
        invalidate();
        qc.invalidateQueries({ queryKey: keys.topicsRoot(uid) });
      },
      onError,
    }),
    /** Reordenação otimista: a lista muda na hora e volta se o Firestore falhar. */
    reorder: useMutation({
      mutationFn: (ordered: Subject[]) => reorderSubjects(uid, ordered.map((s) => s.id)),
      onMutate: async (ordered) => {
        await qc.cancelQueries({ queryKey: listKey });
        const previous = qc.getQueryData<Subject[]>(listKey);
        qc.setQueryData(listKey, ordered.map((s, i) => ({ ...s, order: i })));
        return { previous };
      },
      onError: (err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
        onError(err);
      },
      onSettled: invalidate,
    }),
  };
}

/* ── Assuntos ─────────────────────────────────────────────────────── */

export function useTopics(subjectId: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: keys.topics(uid, subjectId ?? ''),
    queryFn: () => listTopics(uid, subjectId!),
    enabled: !!subjectId,
  });
}

export function useAllTopics() {
  const uid = useUid();
  return useQuery({ queryKey: keys.allTopics(uid), queryFn: () => listAllTopics(uid) });
}

export function useTopicMutations(subjectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const listKey = keys.topics(uid, subjectId);
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.topicsRoot(uid) });

  /** Aplica uma mudança na lista em cache na hora (otimista). */
  const optimistic = async (change: (list: Topic[]) => Topic[]) => {
    await qc.cancelQueries({ queryKey: listKey });
    const previous = qc.getQueryData<Topic[]>(listKey);
    if (previous) qc.setQueryData(listKey, change(previous));
    return { previous };
  };
  const rollback = (err: unknown, _v: unknown, ctx?: { previous?: Topic[] }) => {
    if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
    onError(err);
  };

  return {
    create: useMutation({
      mutationFn: ({ name, order }: { name: string; order: number }) => createTopic(uid, subjectId, name, order),
      onSuccess: invalidate,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Topic, 'name' | 'status'>> }) =>
        updateTopic(uid, id, data),
      onMutate: ({ id, data }) => optimistic((list) => list.map((t) => (t.id === id ? { ...t, ...data } : t))),
      onError: rollback,
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteTopic(uid, id),
      onMutate: (id) => optimistic((list) => list.filter((t) => t.id !== id)),
      onError: rollback,
      onSettled: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (ordered: Topic[]) => reorderTopics(uid, ordered.map((t) => t.id)),
      onMutate: (ordered) => optimistic(() => ordered.map((t, i) => ({ ...t, order: i }))),
      onError: rollback,
      onSettled: invalidate,
    }),
  };
}

/* ── Progresso ────────────────────────────────────────────────────── */

export interface Progress {
  subjects: number;
  topics: number;
  done: number;
  /** 0–100 (assuntos concluídos ÷ total) */
  percent: number;
}

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

/** Progresso por projeto e por matéria, calculado a partir dos assuntos concluídos. */
export function useProgress() {
  const subjects = useAllSubjects();
  const topics = useAllTopics();

  const bySubject = new Map<string, Progress>();
  const byProject = new Map<string, Progress>();

  for (const s of subjects.data ?? []) {
    bySubject.set(s.id, { subjects: 1, topics: 0, done: 0, percent: 0 });
  }
  for (const t of topics.data ?? []) {
    const p = bySubject.get(t.subjectId);
    if (!p) continue;
    p.topics += 1;
    if (t.status === 'concluido') p.done += 1;
  }
  for (const s of subjects.data ?? []) {
    const sp = bySubject.get(s.id)!;
    sp.percent = percent(sp.done, sp.topics);
    const pp = byProject.get(s.projectId) ?? { subjects: 0, topics: 0, done: 0, percent: 0 };
    pp.subjects += 1;
    pp.topics += sp.topics;
    pp.done += sp.done;
    pp.percent = percent(pp.done, pp.topics);
    byProject.set(s.projectId, pp);
  }

  return { bySubject, byProject, isLoading: subjects.isLoading || topics.isLoading };
}

export type { Project, Subject, Topic };
