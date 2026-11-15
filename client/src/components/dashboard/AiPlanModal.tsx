import { BookOpenText, Clock, FolderOpen, Lightbulb, ListChecks, NotebookPen, RotateCcw, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { useAllTopics } from '@/hooks/useStudyData';
import { addDaysToKey, formatMinutes } from '@/lib/dates';
import { friendlyError } from '@/lib/firebaseErrors';
import { newSession } from '@/lib/solveSession';
import { accuracyBy } from '@/lib/stats';
import { createQuiz, getStudyPlan, type PlanAction, type StudyPlan } from '@/services/ai';
import { useDashboardData } from './useDashboardData';

const ACTION: Record<PlanAction, { label: string; icon: LucideIcon }> = {
  revisao: { label: 'Revisar com quiz', icon: RotateCcw },
  quiz: { label: 'Gerar quiz', icon: Sparkles },
  questoes: { label: 'Resolver questões', icon: ListChecks },
  erros: { label: 'Ver caderno de erros', icon: NotebookPen },
  caderno: { label: 'Abrir Caderno IA', icon: BookOpenText },
  materiais: { label: 'Ler materiais', icon: FolderOpen },
};

/** Plano do dia montado pela IA a partir do seu desempenho. */
export function AiPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const data = useDashboardData();
  const topics = useAllTopics();
  const upcoming = useUpcomingEvents(10);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [quizSubject, setQuizSubject] = useState<string | null>(null);

  const subjectById = new Map(data.activeSubjects.map((s) => [s.id, s]));
  const topicName = (id: string) => topics.data?.find((t) => t.id === id)?.name ?? '';

  const build = async () => {
    setLoading(true);
    try {
      const attempts = data.attempts.data ?? [];
      const acc = accuracyBy(attempts, (a) => a.subjectId);
      const from = addDaysToKey(data.today, -6);
      const minutes = new Map<string, number>();
      for (const s of data.sessions.data ?? []) if (s.date >= from) minutes.set(s.subjectId, (minutes.get(s.subjectId) ?? 0) + s.minutes);
      const due = data.reviews.filter((r) => r.status !== 'em_breve');
      const result = await getStudyPlan({
        today: data.today,
        availableMinutes: Math.max(15, profile?.settings?.dailyGoalMinutes || 60),
        subjects: data.activeSubjects.slice(0, 60).map((s) => ({
          id: s.id,
          name: s.name,
          accuracy: acc.get(s.id)?.pct ?? null,
          attempts: acc.get(s.id)?.total ?? 0,
          pendingErrors: data.pendingErrors(s.id).length,
          minutesLast7Days: minutes.get(s.id) ?? 0,
          dueReviews: due.filter((r) => r.subjectId === s.id).map((r) => topicName(r.topicId)).filter(Boolean).slice(0, 10),
          readyMaterials: data.readyMaterials.get(s.id) ?? 0,
        })),
        upcoming: (upcoming.data ?? []).map((e) => ({ title: e.title, type: e.type, date: e.date })),
      });
      setPlan(result);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível montar o plano agora.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !plan && !loading && data.activeSubjects.length) build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.activeSubjects.length]);

  const run = async (i: number, subjectId: string, action: PlanAction) => {
    if (action === 'quiz') return setQuizSubject(subjectId);
    if (action === 'erros') return (onClose(), navigate(`/erros?materia=${subjectId}`));
    if (action === 'caderno') return (onClose(), navigate(`/materias/${subjectId}?aba=caderno`));
    if (action === 'materiais') return (onClose(), navigate(`/materias/${subjectId}`));
    if (action === 'questoes') {
      const qs = data.suggestedQuestions(subjectId, 10);
      onClose();
      if (!qs.length) return navigate(`/materias/${subjectId}?aba=questoes`);
      newSession(qs.map((q) => q.id), 'Plano do dia: questões', '/');
      return navigate('/questoes/resolver');
    }
    // revisão: quiz curto do assunto vencido mais urgente
    setBusyStep(i);
    try {
      const topic = data.reviews.find((r) => r.subjectId === subjectId && r.status !== 'em_breve');
      const { quizId } = await createQuiz(
        { type: 'subject', subjectId, topicId: topic?.topicId ?? null },
        { count: 5, types: ['multipla', 'certo_errado'], difficulty: 'medio', mode: 'treino', focus: 'geral' },
      );
      onClose();
      navigate(`/quizzes/${quizId}`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyStep(null);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Plano do dia com IA" description="Montado a partir do seu desempenho, do caderno de erros, das revisões e das próximas provas." size="lg">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
            <Sparkles className="size-4 animate-pulse text-primary-text" /> Analisando seus estudos…
          </div>
        ) : !plan ? (
          <div className="space-y-3">
            <Alert variant="info">Crie matérias e estude um pouco para a IA conseguir montar seu plano.</Alert>
            <Button onClick={build} disabled={!data.activeSubjects.length}>
              <Sparkles className="size-4" /> Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base font-medium text-text">{plan.headline}</p>
            <ol className="space-y-2">
              {plan.steps.map((s, i) => {
                const subject = subjectById.get(s.subjectId);
                const meta = ACTION[s.action];
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">{i + 1}</span>
                    {subject && <IconTile icon={subject.icon} color={subject.color} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text">
                        {subject?.name} <span className="font-normal text-text-muted">· {meta.label}</span>
                      </p>
                      <p className="text-xs text-text-muted">{s.reason}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="size-3.5" /> {formatMinutes(s.minutes)}
                    </span>
                    <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => run(i, s.subjectId, s.action)} loading={busyStep === i}>
                      <Icon className="size-4" /> Começar
                    </Button>
                  </li>
                );
              })}
            </ol>
            {plan.tip && (
              <p className="flex items-start gap-2 rounded-xl bg-primary-soft/50 p-3 text-sm text-text">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-text" /> {plan.tip}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={build}>
              <RotateCcw className="size-4" /> Gerar outro plano
            </Button>
          </div>
        )}
      </Modal>
      <QuizConfigModal open={!!quizSubject} onClose={() => (setQuizSubject(null), onClose())} defaultSubjectId={quizSubject ?? undefined} />
    </>
  );
}
