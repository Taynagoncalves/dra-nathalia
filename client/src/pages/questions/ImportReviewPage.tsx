import { useQueryClient } from '@tanstack/react-query';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, CheckSquare, FileSearch, ListChecks, Loader2, Pencil, Save, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { isStaleJob } from '@/components/ui/AiProgress';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useQuestionImport } from '@/hooks/useQuestionImports';
import { questionKeys } from '@/hooks/useQuestions';
import { useAllTopics } from '@/hooks/useStudyData';
import { useUid } from '@/hooks/useUid';
import { BOARDS, examMeta, normalizeBoard } from '@/lib/boards';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { LETTERS } from '@/lib/questions';
import { getDb } from '@/services/firebase/app';
import { chunk, userCol, userDoc } from '@/services/firebase/db';
import type { ImportedQuestion } from '@/types/models';
import NotFound from '../NotFound';

type Row = ImportedQuestion & { include: boolean; topicId: string };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Revisão das questões importadas de uma prova, antes de salvar no banco. */
export default function ImportReviewPage() {
  const { importId = '' } = useParams();
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const imp = useQuestionImport(importId);
  const topics = useAllTopics();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState({ board: '', year: '', institution: '', role: '' });
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const d = imp.data;
  const subjectTopics = useMemo(() => (topics.data ?? []).filter((t) => t.subjectId === d?.subjectId), [topics.data, d?.subjectId]);
  const reviewable = !!d && (d.status === 'revisar' || (d.status === 'erro' && d.questions.length > 0) || (d.status === 'processando' && isStaleJob(d.jobStartedAt) && d.questions.length > 0));

  // monta a lista editável uma vez, quando a leitura termina
  useEffect(() => {
    if (!d || rows || !reviewable) return;
    const topicFor = (name: string | null) => {
      if (!name) return '';
      const n = norm(name);
      return subjectTopics.find((t) => norm(t.name) === n || norm(t.name).includes(n) || n.includes(norm(t.name)))?.id ?? '';
    };
    setRows(d.questions.map((q) => ({ ...q, include: !q.annulled && q.answer !== null, topicId: topicFor(q.topic) })));
    setMeta({ board: normalizeBoard(d.meta.board), year: d.meta.year ? String(d.meta.year) : '', institution: d.meta.institution ?? '', role: d.meta.role ?? '' });
  }, [d, rows, reviewable, subjectTopics]);

  if (imp.isLoading) return <LoadingBlock label="Abrindo a importação…" />;
  if (imp.isError) return <ErrorBlock error={imp.error} onRetry={() => imp.refetch()} />;
  if (!d) return <NotFound />;

  const crumbs = <Breadcrumb items={[{ label: 'Questões', to: '/questoes' }, { label: `Importar: ${d.title}` }]} />;

  if (d.status === 'processando' && !isStaleJob(d.jobStartedAt)) {
    const pct = d.progress.total ? (d.progress.done / d.progress.total) * 100 : 0;
    return (
      <>
        {crumbs}
        <Card className="mx-auto mt-6 max-w-lg p-6 text-center sm:p-8">
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary-text" aria-hidden />
          <p className="font-semibold text-text">Lendo a prova…</p>
          <p className="mt-1 text-sm text-text-muted" aria-live="polite">
            Parte {Math.min(d.progress.done + 1, d.progress.total)} de {d.progress.total} · {d.questions.length} questões encontradas até agora
          </p>
          <ProgressBar value={Math.max(4, pct)} className="mt-4" label="Andamento da leitura" />
          <p className="mt-5 text-sm text-text-muted">Pode sair desta página: você recebe um aviso no site e no celular quando ficar pronto para revisar.</p>
        </Card>
      </>
    );
  }

  if (d.status === 'salvo') {
    return (
      <>
        {crumbs}
        <Card className="mx-auto mt-6 max-w-lg space-y-3 p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <p className="font-semibold text-text">{d.savedCount ?? 0} questões salvas no seu banco.</p>
          <ButtonLink to="/questoes">
            <ListChecks className="size-4" /> Ir para o banco de questões
          </ButtonLink>
        </Card>
      </>
    );
  }

  if (!reviewable || !rows) {
    return (
      <>
        {crumbs}
        <Alert variant="error" title="A importação não terminou" className="mx-auto mt-6 max-w-lg">
          {d.error ?? 'A leitura demorou demais e foi interrompida.'} O uso da IA foi devolvido; tente importar de novo.
        </Alert>
      </>
    );
  }

  const patch = (i: number, data: Partial<Row>) => setRows((l) => l!.map((r, j) => (j === i ? { ...r, ...data } : r)));
  const selected = rows.filter((r) => r.include);
  const selectedWithoutAnswer = selected.filter((r) => r.answer === null).length;
  const yearNum = meta.year ? Number(meta.year) : null;

  const save = async () => {
    if (selectedWithoutAnswer) return toast.error('Marque o gabarito das questões selecionadas (ou desmarque-as).');
    setSaving(true);
    try {
      const db = getDb();
      for (const part of chunk(selected, 400)) {
        const batch = writeBatch(db);
        for (const r of part) {
          batch.set(doc(userCol(uid, 'questions')), {
            subjectId: d.subjectId,
            topicId: r.topicId || null,
            statement: r.statement.trim(),
            type: r.type,
            options: r.type === 'multipla' ? r.options : [],
            correctAnswer: r.answer,
            explanation: '',
            source: 'material',
            externalUrl: '',
            difficulty: 'medio',
            examBoard: normalizeBoard(meta.board) || null,
            examYear: yearNum && Number.isInteger(yearNum) ? yearNum : null,
            institution: meta.institution.trim() || null,
            role: meta.role.trim() || null,
            importId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
      await updateDoc(userDoc(uid, 'questionImports', importId), { status: 'salvo', savedCount: selected.length });
      qc.invalidateQueries({ queryKey: questionKeys.questions(uid) });
      qc.invalidateQueries({ queryKey: ['questionImports', uid] });
      toast.success(`${selected.length} questões salvas no banco.`);
      navigate('/questoes');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {crumbs}
      <PageHeader
        title="Revisar questões importadas"
        description={`${rows.length} questões encontradas em ${d.title}. Confira o gabarito e salve as que quiser.`}
        actions={
          <Button onClick={save} loading={saving} disabled={!selected.length}>
            <Save className="size-4" /> Salvar {selected.length} no banco
          </Button>
        }
      />
      {d.status === 'erro' && (
        <Alert variant="warning" className="mb-4">
          A leitura parou no meio ({d.error}). As questões abaixo foram lidas até ali.
        </Alert>
      )}

      <Card className="mb-4 space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-text">
          <FileSearch className="size-4 text-primary-text" /> Prova de origem (vale para todas)
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Banca">
            {(id) => (
              <>
                <Input id={id} list="bancas-import" value={meta.board} onChange={(e) => setMeta({ ...meta, board: e.target.value })} placeholder="FGV, Cebraspe…" />
                <datalist id="bancas-import">
                  {BOARDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Ano">{(id) => <Input id={id} inputMode="numeric" maxLength={4} value={meta.year} onChange={(e) => setMeta({ ...meta, year: e.target.value.replace(/\D/g, '') })} />}</Field>
          <Field label="Órgão">{(id) => <Input id={id} value={meta.institution} onChange={(e) => setMeta({ ...meta, institution: e.target.value })} placeholder="OAB, TJSP…" />}</Field>
          <Field label="Cargo">{(id) => <Input id={id} value={meta.role} onChange={(e) => setMeta({ ...meta, role: e.target.value })} />}</Field>
        </div>
        <p className="text-xs text-text-muted">{examMeta({ examBoard: normalizeBoard(meta.board), examYear: yearNum, institution: meta.institution, role: meta.role }) || 'A IA não achou a banca no cabeçalho: preencha se souber.'}</p>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Button size="sm" variant="secondary" onClick={() => setRows(rows.map((r) => ({ ...r, include: !r.annulled && r.answer !== null })))}>
          <CheckSquare className="size-4" /> Só as com gabarito
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>
          <Square className="size-4" /> Desmarcar todas
        </Button>
        <span className="ml-auto text-text-muted">
          {selected.length} selecionadas{selectedWithoutAnswer ? ` · ${selectedWithoutAnswer} sem gabarito` : ''}
        </span>
      </div>

      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={i}>
            <Card className={cn('space-y-3 p-4', !r.include && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-text">
                  <input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} className="size-4 accent-(--primary)" />
                  Questão {r.number ?? i + 1}
                </label>
                <Badge variant="neutral">{r.type === 'multipla' ? 'Múltipla escolha' : 'Certo/errado'}</Badge>
                {r.annulled && <Badge variant="warning">Anulada</Badge>}
                {r.answer === null && !r.annulled && <Badge variant="error">Sem gabarito</Badge>}
                <select
                  value={r.topicId}
                  onChange={(e) => patch(i, { topicId: e.target.value })}
                  aria-label={`Assunto da questão ${r.number ?? i + 1}`}
                  className="ml-auto h-8 max-w-[14rem] rounded-lg border border-border bg-surface px-2 text-xs text-text"
                >
                  <option value="">{r.topic ? `Sem assunto (IA: ${r.topic})` : 'Sem assunto'}</option>
                  {subjectTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(editing === i ? null : i)} aria-label="Editar texto">
                  <Pencil className="size-4" />
                </Button>
              </div>

              {editing === i ? (
                <div className="space-y-2">
                  <Textarea rows={6} value={r.statement} onChange={(e) => patch(i, { statement: e.target.value })} aria-label="Enunciado" />
                  {r.options.map((o, j) => (
                    <Input key={j} value={o} onChange={(e) => patch(i, { options: r.options.map((x, k) => (k === j ? e.target.value : x)) })} aria-label={`Alternativa ${LETTERS[j]}`} />
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-line text-text">{r.statement}</p>
                  {r.type === 'multipla' && (
                    <ul className="space-y-1 text-sm">
                      {r.options.map((o, j) => (
                        <li key={j} className={cn('flex gap-2', r.answer === String(j) ? 'font-medium text-success' : 'text-text')}>
                          <span className="font-semibold">{LETTERS[j]})</span> {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-text-muted">Gabarito:</span>
                {(r.type === 'multipla' ? r.options.map((_, j) => String(j)) : ['certo', 'errado']).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={r.answer === v}
                    onClick={() => patch(i, { answer: v, include: true })}
                    className={cn(
                      'h-8 min-w-8 rounded-lg border px-2 text-sm font-medium transition-colors',
                      r.answer === v ? 'border-success bg-success/15 text-success' : 'border-border text-text-muted hover:bg-primary-soft',
                    )}
                  >
                    {r.type === 'multipla' ? LETTERS[Number(v)] : v === 'certo' ? 'Certo' : 'Errado'}
                  </button>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} loading={saving} disabled={!selected.length}>
          <Save className="size-4" /> Salvar {selected.length} no banco
        </Button>
      </div>
    </>
  );
}
