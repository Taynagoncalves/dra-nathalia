import { CheckCircle2, Circle, ExternalLink, ListChecks, Pencil, Play, Plus, RotateCcw, Search, Shuffle, Trash2, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ActionMenuButton } from '@/components/ui/ActionMenu';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useLastResults, useQuestionMutations, useQuestions } from '@/hooks/useQuestions';
import { useAllSubjects, useAllTopics, useProjects } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import {
  DIFFICULTY_LABELS,
  EMPTY_QUESTION_FILTERS,
  filterQuestions,
  QUESTION_TYPE_LABELS,
  shuffle,
  type LastResult,
  type QuestionFilters,
} from '@/lib/questions';
import { isUnfinished, loadSession, newSession } from '@/lib/solveSession';
import type { Difficulty, Question, QuestionType } from '@/types/models';
import { QuestionFormModal } from './QuestionFormModal';

const PAGE = 30;

const RESULT_META: Record<LastResult, { label: string; icon: typeof Circle; className: string }> = {
  acertou: { label: 'Acertou na última', icon: CheckCircle2, className: 'text-success' },
  errou: { label: 'Errou na última', icon: XCircle, className: 'text-error' },
  nunca: { label: 'Nunca resolvida', icon: Circle, className: 'text-text-muted' },
};

/**
 * Banco de questões com filtros, resolução e "refazer as erradas".
 * Com `fixedSubjectId`, vira a aba "Questões" de uma matéria.
 */
export function QuestionBank({ fixedSubjectId }: { fixedSubjectId?: string }) {
  const navigate = useNavigate();
  const questions = useQuestions();
  const last = useLastResults();
  const subjects = useAllSubjects();
  const topics = useAllTopics();
  const projects = useProjects();
  const { remove } = useQuestionMutations();

  const [filters, setFilters] = useState<QuestionFilters>({ ...EMPTY_QUESTION_FILTERS, subjectId: fixedSubjectId ?? '' });
  const [shuffled, setShuffled] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState<{ question?: Question } | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const pending = loadSession();

  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data]);
  const subjectProject = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s.projectId])), [subjects.data]);
  const topicById = useMemo(() => new Map((topics.data ?? []).map((t) => [t.id, t])), [topics.data]);

  const all = questions.data ?? [];
  const filtered = useMemo(() => filterQuestions(all, filters, subjectProject, last), [all, filters, subjectProject, last]);
  const wrong = useMemo(
    () => filterQuestions(all, { ...filters, status: 'errou' }, subjectProject, last),
    [all, filters, subjectProject, last],
  );
  const topicOptions = (topics.data ?? []).filter((t) => t.subjectId === filters.subjectId);
  const set = <K extends keyof QuestionFilters>(k: K, v: QuestionFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setLimit(PAGE);
  };
  const activeFilters = Object.entries(filters).some(([k, v]) => v && !(k === 'subjectId' && fixedSubjectId));
  const returnTo = fixedSubjectId ? `/materias/${fixedSubjectId}?aba=questoes` : '/questoes';

  const start = (list: Question[], title: string) => {
    if (!list.length) return;
    const ids = (shuffled ? shuffle(list) : list).map((q) => q.id);
    newSession(ids, title, returnTo);
    navigate('/questoes/resolver');
  };

  if (questions.isLoading) return <LoadingBlock label="Carregando questões…" />;
  if (questions.isError) return <ErrorBlock error={questions.error} onRetry={() => questions.refetch()} />;

  return (
    <div className="space-y-4">
      {isUnfinished(pending) && (
        <Alert variant="info" title="Resolução em andamento">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {pending!.title}: {pending!.results.length} de {pending!.ids.length} respondidas.
            </span>
            <Button size="sm" onClick={() => navigate('/questoes/resolver')}>
              Continuar
            </Button>
          </div>
        </Alert>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setForm({})}>
          <Plus className="size-4" /> Nova questão
        </Button>
        <Button variant="secondary" disabled={!filtered.length} onClick={() => start(filtered, activeFilters ? 'Questões filtradas' : 'Todas as questões')}>
          <Play className="size-4" /> Resolver {filtered.length ? `(${filtered.length})` : ''}
        </Button>
        <Button variant="secondary" disabled={!wrong.length} onClick={() => start(wrong, 'Refazer as erradas')}>
          <RotateCcw className="size-4" /> Refazer erradas {wrong.length ? `(${wrong.length})` : ''}
        </Button>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-text-muted">
          <input type="checkbox" checked={shuffled} onChange={(e) => setShuffled(e.target.checked)} className="accent-(--primary)" />
          <Shuffle className="size-4" /> Embaralhar
        </label>
      </div>

      {/* Filtros */}
      <Card className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="Buscar no enunciado…" aria-label="Buscar questões" className="pl-9" />
        </div>
        {!fixedSubjectId && (
          <>
            <Select value={filters.projectId} onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value, subjectId: '', topicId: '' }))} aria-label="Projeto">
              <option value="">Todos os projetos</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <SubjectSelect
              value={filters.subjectId}
              projectId={filters.projectId || undefined}
              emptyLabel="Todas as matérias"
              aria-label="Matéria"
              onChange={(v) => setFilters((f) => ({ ...f, subjectId: v, topicId: '' }))}
            />
          </>
        )}
        <Select value={filters.topicId} onChange={(e) => set('topicId', e.target.value)} disabled={!topicOptions.length} aria-label="Assunto">
          <option value="">{filters.subjectId ? 'Todos os assuntos' : 'Assunto (escolha a matéria)'}</option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select value={filters.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty | '')} aria-label="Dificuldade">
          <option value="">Qualquer dificuldade</option>
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </Select>
        <Select value={filters.type} onChange={(e) => set('type', e.target.value as QuestionType | '')} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => set('status', e.target.value as LastResult | '')} aria-label="Situação">
          <option value="">Qualquer situação</option>
          {(Object.keys(RESULT_META) as LastResult[]).map((r) => (
            <option key={r} value={r}>
              {RESULT_META[r].label}
            </option>
          ))}
        </Select>
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => setFilters({ ...EMPTY_QUESTION_FILTERS, subjectId: fixedSubjectId ?? '' })}
          >
            <X className="size-3.5" /> Limpar filtros
          </Button>
        )}
      </Card>

      {/* Lista */}
      {all.length === 0 || (fixedSubjectId && !filtered.length && !activeFilters) ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Nenhuma questão ainda"
            description="Cadastre questões com gabarito e comentário. Ao resolver, cada resposta fica registrada no seu desempenho."
            action={
              <Button onClick={() => setForm({})}>
                <Plus className="size-4" /> Criar primeira questão
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Nenhuma questão com esses filtros" />
        </Card>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            {filtered.length} {filtered.length === 1 ? 'questão' : 'questões'}
          </p>
          <ul className="space-y-2">
            {filtered.slice(0, limit).map((q) => {
              const result = RESULT_META[last.get(q.id)?.result ?? 'nunca'];
              const ResultIcon = result.icon;
              const subject = subjectById.get(q.subjectId);
              const topic = q.topicId ? topicById.get(q.topicId) : undefined;
              return (
                <li key={q.id}>
                  <Card className="flex gap-3 p-4">
                    <ResultIcon className={cn('mt-0.5 size-5 shrink-0', result.className)} aria-label={result.label} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="line-clamp-3 text-sm whitespace-pre-line text-text">{q.statement}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        {!fixedSubjectId && subject && <Badge variant="primary">{subject.name}</Badge>}
                        {topic && <Badge variant="neutral">{topic.name}</Badge>}
                        <Badge variant="neutral">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                        <Badge variant={q.difficulty === 'dificil' ? 'warning' : 'neutral'}>{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                        {q.externalUrl && (
                          <a href={q.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-text hover:underline">
                            <ExternalLink className="size-3" /> link
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Resolver esta questão" onClick={() => start([q], 'Questão avulsa')}>
                        <Play className="size-4" />
                      </Button>
                      <ActionMenuButton
                        label="Ações da questão"
                        actions={[
                          { label: 'Resolver', icon: <Play className="size-4" />, onSelect: () => start([q], 'Questão avulsa') },
                          { label: 'Editar', icon: <Pencil className="size-4" />, onSelect: () => setForm({ question: q }) },
                          { label: 'Excluir', icon: <Trash2 className="size-4" />, onSelect: () => setDeleting(q), danger: true, separator: true },
                        ]}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          {filtered.length > limit && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Mostrar mais ({filtered.length - limit})
              </Button>
            </div>
          )}
        </>
      )}

      <QuestionFormModal
        open={!!form}
        onClose={() => setForm(null)}
        question={form?.question}
        defaultSubjectId={fixedSubjectId ?? (filters.subjectId || undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Excluir esta questão?"
        description="As tentativas já feitas continuam contando no seu desempenho."
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => toast.success('Questão excluída.') });
          setDeleting(null);
        }}
      />
    </div>
  );
}
