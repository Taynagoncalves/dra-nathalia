import { Sparkles, AlertTriangle, CheckCircle2, NotebookPen, Pencil, Plus, RotateCcw, Target, Trash2, Undo2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorFormModal } from '@/components/errors/ErrorFormModal';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionMenuButton } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useErrorMutations, useErrors, useQuestions } from '@/hooks/useQuestions';
import { useAllSubjects, useAllTopics } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { attentionList, categoryCounts } from '@/lib/errorStats';
import { answerLabel } from '@/lib/questions';
import { newSession } from '@/lib/solveSession';
import { ERROR_CATEGORIES, type ErrorCategory, type ErrorEntry } from '@/types/models';

type Status = 'pendentes' | 'resolvidos' | 'todos';

export default function ErrorNotebookPage() {
  const navigate = useNavigate();
  const errors = useErrors();
  const questions = useQuestions();
  const subjects = useAllSubjects();
  const topics = useAllTopics();
  const { update, remove } = useErrorMutations();

  const [params] = useSearchParams();
  // ?materia=ID vem do dashboard ("Ver erros" / estudo rápido)
  const [subjectId, setSubjectId] = useState(params.get('materia') ?? '');
  const [topicId, setTopicId] = useState('');
  const [category, setCategory] = useState<ErrorCategory | ''>('');
  const [status, setStatus] = useState<Status>('pendentes');
  const [form, setForm] = useState<{ entry?: ErrorEntry } | null>(null);
  const [deleting, setDeleting] = useState<ErrorEntry | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const all = useMemo(() => errors.data ?? [], [errors.data]);
  const questionById = useMemo(() => new Map((questions.data ?? []).map((q) => [q.id, q])), [questions.data]);
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data]);
  const topicById = useMemo(() => new Map((topics.data ?? []).map((t) => [t.id, t])), [topics.data]);

  // Escopo (matéria/assunto) vale para o gráfico e os destaques; categoria e status, só para a lista.
  const scoped = useMemo(
    () => all.filter((e) => (!subjectId || e.subjectId === subjectId) && (!topicId || e.topicId === topicId)),
    [all, subjectId, topicId],
  );
  const list = scoped.filter(
    (e) =>
      (!category || e.category === category) &&
      (status === 'todos' || (status === 'resolvidos' ? e.resolved : !e.resolved)),
  );
  const counts = useMemo(() => categoryCounts(scoped), [scoped]);
  const attention = useMemo(() => attentionList(scoped), [scoped]);
  const pending = scoped.filter((e) => !e.resolved).length;
  const topicOptions = (topics.data ?? []).filter((t) => t.subjectId === subjectId);

  const attentionName = (key: { topicId: string | null; subjectId: string }) =>
    key.topicId ? (topicById.get(key.topicId)?.name ?? 'Assunto excluído') : (subjectById.get(key.subjectId)?.name ?? 'Matéria');

  const redo = (questionIds: string[], title: string) => {
    newSession(questionIds, title, '/erros');
    navigate('/questoes/resolver');
  };
  const redoablePending = [...new Set(list.filter((e) => !e.resolved && e.questionId && questionById.has(e.questionId)).map((e) => e.questionId!))];

  const toggleResolved = (e: ErrorEntry) =>
    update.mutate(
      { id: e.id, data: { resolved: !e.resolved } },
      { onSuccess: () => toast.success(e.resolved ? 'Erro reaberto.' : 'Marcado como resolvido.') },
    );

  if (errors.isLoading) return <LoadingBlock label="Abrindo o caderno de erros…" />;
  if (errors.isError) return <ErrorBlock error={errors.error} onRetry={() => errors.refetch()} />;

  const top = counts[0];

  return (
    <>
      <PageHeader
        title="Caderno de Erros"
        description="Cada erro é uma pista do que revisar. Registre o motivo e volte nele até resolver."
        actions={
          <>
            <Button variant="secondary" onClick={() => setQuizOpen(true)} disabled={!all.some((e) => !e.resolved)}>
              <Sparkles className="size-4" /> Quiz dos meus erros
            </Button>
            <Button onClick={() => setForm({})}>
              <Plus className="size-4" /> Novo registro
            </Button>
          </>
        }
      />

      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="Seu caderno ainda está vazio"
            description="Ao errar uma questão, você poderá registrar o motivo aqui. Também dá para registrar erros de simulados e provas à mão."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate('/questoes')}>Ir para Questões</Button>
                <Button variant="secondary" onClick={() => setForm({})}>
                  Novo registro
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Filtros de escopo */}
          <Card className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <SubjectSelect
              value={subjectId}
              emptyLabel="Todas as matérias"
              aria-label="Matéria"
              onChange={(v) => {
                setSubjectId(v);
                setTopicId('');
              }}
            />
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topicOptions.length} aria-label="Assunto">
              <option value="">{subjectId ? 'Todos os assuntos' : 'Assunto (escolha a matéria)'}</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ErrorCategory | '')} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {ERROR_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <div className="flex rounded-lg border border-border bg-bg p-0.5" role="group" aria-label="Situação">
              {(['pendentes', 'resolvidos', 'todos'] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors',
                    status === s ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {s === 'pendentes' ? 'Não resolvidos' : s === 'resolvidos' ? 'Resolvidos' : 'Todos'}
                </button>
              ))}
            </div>
            {(subjectId || category || status !== 'pendentes') && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() => {
                  setSubjectId('');
                  setTopicId('');
                  setCategory('');
                  setStatus('pendentes');
                }}
              >
                <X className="size-3.5" /> Limpar filtros
              </Button>
            )}
          </Card>

          {/* Destaques */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                <Target className="size-5" />
              </span>
              <div className="min-w-0">
                <CardDescription>Você mais erra por</CardDescription>
                {top ? (
                  <>
                    <CardTitle className="mt-0.5">{top.category}</CardTitle>
                    <p className="mt-1 text-sm text-text-muted">
                      {top.count} {top.count === 1 ? 'vez' : 'vezes'} · {top.percent}% dos erros
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">Nenhum erro neste filtro.</p>
                )}
              </div>
            </Card>
            <Card className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/12 text-warning">
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardDescription>Assuntos que precisam de atenção</CardDescription>
                {attention.length ? (
                  <ul className="mt-1 space-y-1">
                    {attention.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-text">{attentionName(a)}</span>
                        <span className="shrink-0 text-text-muted">
                          {a.unresolved} {a.unresolved === 1 ? 'pendente' : 'pendentes'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-success">Nenhum erro pendente. Mandou bem!</p>
                )}
              </div>
            </Card>
          </div>

          {/* Gráfico: categorias mais frequentes (série única → uma cor só) */}
          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle>Categorias de erro mais frequentes</CardTitle>
              <span className="text-xs text-text-muted">
                {scoped.length} {scoped.length === 1 ? 'erro' : 'erros'} · {pending} não {pending === 1 ? 'resolvido' : 'resolvidos'}
              </span>
            </div>
            {counts.length ? (
              <ul className="space-y-3" aria-label="Erros por categoria">
                {counts.map((c) => (
                  <li key={c.category}>
                    <button
                      type="button"
                      onClick={() => setCategory(category === c.category ? '' : c.category)}
                      aria-pressed={category === c.category}
                      title="Clique para filtrar a lista por esta categoria"
                      className="group block w-full rounded-lg p-1 text-left hover:bg-primary-soft/50"
                    >
                      <span className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className={cn('text-text', category === c.category && 'font-semibold')}>{c.category}</span>
                        <span className="shrink-0 tabular-nums text-text-muted">
                          {c.count} · {c.percent}%
                        </span>
                      </span>
                      <span className="block h-2 w-full rounded-full bg-primary-soft">
                        <span
                          className="block h-full rounded-full bg-primary transition-[width] duration-300"
                          style={{ width: `${Math.max(4, (c.count / counts[0]!.count) * 100)}%` }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Sem dados neste filtro.</p>
            )}
          </Card>

          {/* Lista */}
          <section aria-label="Registros">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text">
                {list.length} {list.length === 1 ? 'registro' : 'registros'}
              </h2>
              {redoablePending.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => redo(redoablePending, 'Refazer questões do caderno de erros')}>
                  <RotateCcw className="size-4" /> Refazer as questões pendentes ({redoablePending.length})
                </Button>
              )}
            </div>

            {list.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CheckCircle2}
                  title={status === 'pendentes' ? 'Nenhum erro pendente aqui' : 'Nenhum registro com esses filtros'}
                />
              </Card>
            ) : (
              <ul className="space-y-2">
                {list.map((e) => {
                  const q = e.questionId ? questionById.get(e.questionId) : undefined;
                  const subject = subjectById.get(e.subjectId);
                  const topic = e.topicId ? topicById.get(e.topicId) : undefined;
                  return (
                    <li key={e.id}>
                      <Card className={cn('flex gap-3 p-4', e.resolved && 'opacity-70')}>
                        <button
                          type="button"
                          onClick={() => toggleResolved(e)}
                          aria-label={e.resolved ? 'Reabrir erro' : 'Marcar como resolvido'}
                          title={e.resolved ? 'Reabrir' : 'Marcar como resolvido'}
                          className={cn('mt-0.5 h-fit rounded-full', e.resolved ? 'text-success' : 'text-text-muted hover:text-success')}
                        >
                          <CheckCircle2 className={cn('size-5', e.resolved && 'fill-success/15')} />
                        </button>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="error">{e.category}</Badge>
                            {subject && <Badge variant="primary">{subject.name}</Badge>}
                            {topic && <Badge variant="neutral">{topic.name}</Badge>}
                            {e.resolved && <Badge variant="success">Resolvido</Badge>}
                          </div>
                          {q ? (
                            <p className="line-clamp-2 text-sm text-text">
                              {q.statement}
                              {q.type !== 'discursiva' && <span className="text-text-muted"> · Gabarito: {answerLabel(q)}</span>}
                            </p>
                          ) : e.questionId ? (
                            <p className="text-xs text-text-muted italic">A questão foi excluída.</p>
                          ) : null}
                          {e.note && (
                            <p className="rounded-lg border-l-2 border-primary bg-bg px-3 py-2 text-sm whitespace-pre-line text-text">{e.note}</p>
                          )}
                          <p className="text-xs text-text-muted">{e.createdAt?.toDate?.().toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                          {q && (
                            <Button variant="ghost" size="sm" onClick={() => redo([q.id], 'Refazer questão')}>
                              <RotateCcw className="size-4" /> <span className="hidden sm:inline">Refazer</span>
                            </Button>
                          )}
                          <ActionMenuButton
                            label="Ações do registro"
                            actions={[
                              {
                                label: e.resolved ? 'Reabrir' : 'Marcar como resolvido',
                                icon: e.resolved ? <Undo2 className="size-4" /> : <CheckCircle2 className="size-4" />,
                                onSelect: () => toggleResolved(e),
                              },
                              ...(q ? [{ label: 'Refazer questão', icon: <RotateCcw className="size-4" />, onSelect: () => redo([q.id], 'Refazer questão') }] : []),
                              { label: 'Editar', icon: <Pencil className="size-4" />, onSelect: () => setForm({ entry: e }) },
                              { label: 'Excluir', icon: <Trash2 className="size-4" />, onSelect: () => setDeleting(e), danger: true, separator: true },
                            ]}
                          />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <QuizConfigModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        defaultKind="errors"
        defaultSubjectId={subjectId || attention[0]?.subjectId || all.find((e) => !e.resolved)?.subjectId}
      />
      <ErrorFormModal open={!!form} onClose={() => setForm(null)} entry={form?.entry} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Excluir este registro?"
        description="Prefira “Marcar como resolvido” — assim o histórico continua contando nas estatísticas."
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => toast.success('Registro excluído.') });
          setDeleting(null);
        }}
      />
    </>
  );
}
