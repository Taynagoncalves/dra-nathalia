import { CheckCircle2, ChevronRight, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, chartColors, gridProps, tooltipProps } from '@/components/charts/chartTheme';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuizConfigModal } from '@/components/quiz/QuizConfigModal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useAiStatus, useQuizList } from '@/hooks/useQuizzes';
import { useAllSubjects } from '@/hooks/useStudyData';

const SOURCE_LABEL: Record<string, string> = {
  material: 'Material',
  folder: 'Pasta',
  subject: 'Matéria',
  errors: 'Caderno de erros',
  tema: 'Tema livre',
  quiz_erros: 'Refazer erros',
};

export default function QuizzesPage() {
  const quizzes = useQuizList();
  const ai = useAiStatus();
  const subjects = useAllSubjects();
  const [newOpen, setNewOpen] = useState(false);
  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name;

  const done = useMemo(
    () =>
      (quizzes.data ?? [])
        .filter((q) => q.result && q.createdAt)
        .slice(0, 20)
        .reverse()
        .map((q) => ({
          label: q.createdAt!.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          nota: q.result!.score,
          titulo: q.title,
        })),
    [quizzes.data],
  );

  return (
    <>
      <PageHeader
        title="Quizzes com IA"
        description="Questões geradas a partir dos seus materiais, com gabarito comentado e o trecho de origem."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Sparkles className="size-4" /> Novo quiz
          </Button>
        }
      />

      {ai.data && !ai.data.configured && (
        <Alert variant="warning" title="IA ainda não configurada" className="mb-4">
          Falta a chave da IA no servidor (GEMINI_API_KEY — gratuita, em aistudio.google.com). Veja a seção “IA” do README.
        </Alert>
      )}
      <p className="mb-5 text-sm text-text-muted">
        Dica: também dá para gerar quizzes direto de um PDF, de uma pasta (botão ✨ nos cards) ou do Caderno de Erros.
      </p>

      {quizzes.isLoading ? (
        <LoadingBlock label="Carregando quizzes…" />
      ) : quizzes.isError ? (
        <ErrorBlock error={quizzes.error} onRetry={() => quizzes.refetch()} />
      ) : !quizzes.data?.length ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Nenhum quiz ainda"
            description="Escolha uma matéria, um assunto ou um tema e a IA cria as questões para você."
            action={
              <Button onClick={() => setNewOpen(true)}>
                <Sparkles className="size-4" /> Criar meu primeiro quiz
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {done.length >= 2 && (
            <Card>
              <CardTitle>Evolução das notas</CardTitle>
              <CardDescription className="mb-3">Seus últimos quizzes concluídos (% de acertos).</CardDescription>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={done} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...axisProps} domain={[0, 100]} width={40} />
                    <Tooltip {...tooltipProps} cursor={{ stroke: 'var(--border)' }} formatter={(v) => [`${v}%`, 'Nota']} labelFormatter={(_, p) => p?.[0]?.payload?.titulo ?? ''} />
                    <Line type="monotone" dataKey="nota" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4, fill: chartColors.primary }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <section aria-label="Histórico">
            <h2 className="mb-3 text-lg font-semibold text-text">Histórico</h2>
            <ul className="space-y-2">
              {quizzes.data.map((q) => (
                <li key={q.id}>
                  <Link to={`/quizzes/${q.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-card">
                    {q.status === 'gerando' ? (
                      <Loader2 className="size-5 shrink-0 animate-spin text-primary-text" aria-label="Gerando" />
                    ) : q.status === 'erro' ? (
                      <XCircle className="size-5 shrink-0 text-error" aria-label="Falhou" />
                    ) : (
                      <CheckCircle2 className={q.result ? 'size-5 shrink-0 text-success' : 'size-5 shrink-0 text-text-muted'} aria-label={q.result ? 'Concluído' : 'Pronto'} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{q.title}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {subjectName(q.subjectId) ?? 'Matéria'} · {SOURCE_LABEL[q.source?.type] ?? 'Quiz'} · {q.config.count} questões
                        {q.createdAt && ` · ${q.createdAt.toDate().toLocaleDateString('pt-BR')}`}
                      </span>
                    </span>
                    {q.result ? (
                      <Badge variant={q.result.score >= 70 ? 'success' : q.result.score >= 50 ? 'warning' : 'error'}>{q.result.score}%</Badge>
                    ) : q.status === 'pronto' ? (
                      <Badge variant="primary">Fazer</Badge>
                    ) : q.status === 'gerando' ? (
                      <Badge variant="neutral">Gerando…</Badge>
                    ) : (
                      <Badge variant="error">Falhou</Badge>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <QuizConfigModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}
