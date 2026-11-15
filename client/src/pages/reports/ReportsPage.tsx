import { FileSpreadsheet, FileText, NotebookPen, Printer, Sheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportMenu } from '@/components/export/ExportMenu';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification, usePracticeDays } from '@/hooks/useGamification';
import { useAttempts, useErrors } from '@/hooks/useQuestions';
import { useSimulations } from '@/hooks/useSimulator';
import { useSessions } from '@/hooks/useStats';
import { useAllSubjects } from '@/hooks/useStudyData';
import { useUid } from '@/hooks/useUid';
import { addDaysToKey, dateKey, formatMinutes } from '@/lib/dates';
import { downloadFile, downloadWord, escapeHtml, printAsPdf, toCsv } from '@/lib/exporters';
import { friendlyError } from '@/lib/firebaseErrors';
import { ROLE_LABELS, simStats } from '@/lib/simulator';
import { accuracyBy, attemptDay, minutesBy, overallAccuracy } from '@/lib/stats';
import { collectNotesHtml } from '@/services/firebase/exportNotes';

const tsDate = (t: { toDate?: () => Date } | null | undefined) => (t?.toDate ? t.toDate().toLocaleDateString('pt-BR') : '');
const table = (head: string[], rows: (string | number)[][]) =>
  rows.length
    ? `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    : '<p><em>Sem dados ainda.</em></p>';

/** Relatórios e exportação: relatório de desempenho (PDF/Word), planilhas CSV e anotações. */
export default function ReportsPage() {
  const uid = useUid();
  const { profile } = useAuth();
  const subjects = useAllSubjects();
  const attempts = useAttempts();
  const sessions = useSessions();
  const errors = useErrors();
  const sims = useSimulations();
  const days = usePracticeDays();
  const g = useGamification();
  const [period, setPeriod] = useState(30);

  const all = [subjects, attempts, sessions, errors, sims, days];
  if (all.some((q) => q.isLoading) || g.isLoading) return <LoadingBlock label="Juntando os seus dados…" />;
  const failed = all.find((q) => q.isError);
  if (failed) return <ErrorBlock error={failed.error} />;

  const name = (id: string | null | undefined) => subjects.data?.find((s) => s.id === id)?.name ?? '—';
  const today = dateKey();
  const from = addDaysToKey(today, -(period - 1));

  const buildReport = () => {
    const att = (attempts.data ?? []).filter((a) => attemptDay(a) >= from);
    const ses = (sessions.data ?? []).filter((s) => s.date >= from);
    const overall = overallAccuracy(att);
    const acc = accuracyBy(att, (a) => a.subjectId);
    const mins = minutesBy(ses, (s) => s.subjectId);
    const subjRows = (subjects.data ?? [])
      .map((s) => {
        const a = acc.get(s.id);
        return [s.name, formatMinutes(mins.get(s.id) ?? 0), a?.total ?? 0, a ? `${a.pct}%` : '—'] as (string | number)[];
      })
      .filter((r) => r[1] !== '0 min' || r[2] !== 0);
    const pending = (errors.data ?? []).filter((e) => !e.resolved);
    const byCat = new Map<string, number>();
    for (const e of pending) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    const st = simStats(sims.data ?? []);
    const gd = g.data;
    const html = [
      '<h2>Resumo</h2>',
      table(
        ['Indicador', 'Valor'],
        [
          ['Tempo de estudo', formatMinutes(ses.reduce((t, s) => t + s.minutes, 0))],
          ['Questões resolvidas', overall.total],
          ['Acerto geral', overall.total ? `${overall.pct}%` : '—'],
          ['Dias com estudo', new Set(ses.map((s) => s.date)).size],
          ['Erros pendentes no caderno', pending.length],
          ...(gd ? ([['Nível', `${gd.level} — ${gd.title} (${gd.xp} XP)`], ['Conquistas', `${gd.achievements.filter((a) => a.unlocked).length} de ${gd.achievements.length}`]] as (string | number)[][]) : []),
        ],
      ),
      '<h2>Por matéria</h2>',
      table(['Matéria', 'Tempo', 'Questões', 'Acerto'], subjRows),
      '<h2>Caderno de erros (pendentes por categoria)</h2>',
      table(['Categoria', 'Erros'], [...byCat].sort((a, b) => b[1] - a[1])),
      '<h2>Simulador Jurídico</h2>',
      `<p>Nível: <strong>${escapeHtml(st.level.name)}</strong> · ${st.done} peça(s) corrigida(s)${st.average !== null ? ` · média ${st.average}` : ''}</p>`,
      table(
        ['Papel', 'Peças', 'Média', 'Melhor'],
        st.byRole.filter((r) => r.count).map((r) => [ROLE_LABELS[r.role], r.count, r.average ?? '—', r.best ?? '—']),
      ),
    ].join('\n');
    return {
      title: 'Relatório de desempenho',
      html,
      meta: `${profile?.name ?? ''} · últimos ${period} dias (${from.split('-').reverse().join('/')} a ${today.split('-').reverse().join('/')})`,
    };
  };

  const csv = (file: string, rows: (string | number | boolean | null | undefined)[][]) => downloadFile(`${file}-${today}.csv`, toCsv(rows), 'text/csv;charset=utf-8');

  const sheets: { label: string; count: number; run: () => void }[] = [
    {
      label: 'Questões respondidas',
      count: attempts.data?.length ?? 0,
      run: () => csv('questoes-respondidas', [['Data', 'Matéria', 'Acertou', 'Tempo (s)', 'Quiz'], ...(attempts.data ?? []).map((a) => [attemptDay(a), name(a.subjectId), a.isCorrect ? 'sim' : 'não', a.timeSpentSec, a.quizId ? 'sim' : 'não'])]),
    },
    {
      label: 'Sessões de estudo',
      count: sessions.data?.length ?? 0,
      run: () => csv('sessoes-de-estudo', [['Data', 'Matéria', 'Atividade', 'Minutos'], ...(sessions.data ?? []).map((s) => [s.date, name(s.subjectId), s.activity, s.minutes])]),
    },
    {
      label: 'Caderno de erros',
      count: errors.data?.length ?? 0,
      run: () => csv('caderno-de-erros', [['Data', 'Matéria', 'Categoria', 'Anotação', 'Resolvido'], ...(errors.data ?? []).map((e) => [tsDate(e.createdAt), name(e.subjectId), e.category, e.note, e.resolved ? 'sim' : 'não'])]),
    },
    {
      label: 'Peças do Simulador',
      count: sims.data?.length ?? 0,
      run: () =>
        csv('simulador', [
          ['Data', 'Caso', 'Papel', 'Peça (título)', 'Situação', 'Nota', ...((sims.data ?? []).find((s) => s.correction)?.correction?.criteria.map((c) => c.label) ?? [])],
          ...(sims.data ?? []).map((s) => [tsDate(s.submittedAt ?? s.createdAt), s.caseTitle, ROLE_LABELS[s.role], s.pieceTitle, s.status, s.score ?? '', ...(s.correction?.criteria.map((c) => c.score) ?? [])]),
        ]),
    },
    {
      label: 'Dias na prática jurídica',
      count: days.data?.length ?? 0,
      run: () => csv('pratica-juridica', [['Data', 'Dia', 'Carreira', 'Situação', 'Nota'], ...(days.data ?? []).map((d) => [tsDate(d.createdAt), d.title, d.career, d.status, d.score ?? ''])]),
    },
  ];

  const safely = (fn: () => void) => () => {
    try {
      fn();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <>
      <PageHeader title="Relatórios e exportação" description="Leve os seus dados para onde quiser: relatório em PDF ou Word, planilhas e anotações." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary-text" /> Relatório de desempenho
          </CardTitle>
          <CardDescription className="mb-4">Resumo, tempo e acerto por matéria, erros por categoria, Simulador e nível.</CardDescription>
          <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Período">
            {[7, 30, 90, 365].map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'primary' : 'secondary'} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>
                {p === 365 ? '1 ano' : `${p} dias`}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={safely(() => { const r = buildReport(); printAsPdf(r.title, r.html, r.meta); })}>
              <Printer className="size-4" /> PDF (imprimir)
            </Button>
            <Button variant="secondary" onClick={safely(() => { const r = buildReport(); downloadWord(`relatorio-desempenho-${today}`, r.title, r.html, r.meta); })}>
              <FileText className="size-4" /> Word (.doc)
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-muted">No PDF, escolha “Salvar como PDF” na janela de impressão.</p>
        </Card>

        <Card className="p-5">
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="size-4 text-primary-text" /> Todas as anotações
          </CardTitle>
          <CardDescription className="mb-4">Um único arquivo com as anotações de todas as matérias, separadas por matéria.</CardDescription>
          <ExportMenu
            label="Exportar anotações"
            load={async () => {
              const r = await collectNotesHtml(uid, subjects.data ?? []);
              if (!r.count) throw new Error('Você ainda não tem anotações.');
              return { title: 'Minhas anotações', html: r.html, meta: `${r.count} anotação(ões) · exportado em ${today.split('-').reverse().join('/')}` };
            }}
          />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary-text" /> Planilhas (CSV)
          </CardTitle>
          <CardDescription className="mb-4">Abrem no Excel, no Google Planilhas e no LibreOffice.</CardDescription>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={safely(s.run)}
                  disabled={!s.count}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-primary-soft/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sheet className="size-5 shrink-0 text-primary-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">{s.label}</span>
                    <span className="block text-xs text-text-muted">{s.count ? `${s.count} linha(s)` : 'Sem dados ainda'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
