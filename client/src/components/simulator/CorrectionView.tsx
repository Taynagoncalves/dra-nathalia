import { updateDoc } from 'firebase/firestore';
import { BookOpenCheck, CheckCircle2, Copy, FileCheck2, ListChecks, NotebookPen, Rows3, ThumbsUp, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { Tabs } from '@/components/ui/Tabs';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { scoreTone } from '@/lib/simulator';
import { userDoc } from '@/services/firebase/db';
import { createError } from '@/services/firebase/errors';
import type { SimCorrection, Simulation } from '@/types/models';

type Tab = 'resumo' | 'linhas' | 'modelo';

const toneText = { success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

/** Resultado da correção: nota geral, 8 critérios, "Meus erros", linha a linha e o modelo de resposta. */
export function CorrectionView({ sim, correction, subjectId, onSaved }: { sim: Simulation; correction: SimCorrection; subjectId: string | null; onSaved?: () => void }) {
  const [tab, setTab] = useState<Tab>('resumo');
  const tone = scoreTone(correction.overall);

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-5xl font-bold tabular-nums', toneText[tone])}>{correction.overall}</span>
          <span className="text-lg text-text-muted">/100</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2 text-sm text-text">
            {correction.pieceCorrect ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-error" aria-hidden />}
            <span>
              Você fez: <strong>{correction.identifiedPiece}</strong>
            </span>
          </p>
          <p className="text-sm text-text-muted">
            Peça cabível: <strong className="text-text">{correction.expectedPiece}</strong>
          </p>
          <p className="text-sm text-text">{correction.summary}</p>
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'resumo', label: 'Correção', icon: ListChecks },
          { value: 'linhas', label: 'Linha a linha', icon: Rows3, badge: correction.lines.length ? <Badge variant="warning">{correction.lines.length}</Badge> : undefined },
          { value: 'modelo', label: 'Modelo de resposta', icon: BookOpenCheck },
        ]}
      />

      {tab === 'resumo' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <CardTitle className="mb-3">Notas por critério</CardTitle>
            <ul className="space-y-3">
              {correction.criteria.map((c) => {
                const t = scoreTone(c.score * 10);
                return (
                  <li key={c.key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-text">{c.label}</span>
                      <span className={cn('font-semibold tabular-nums', toneText[t])}>{c.score.toLocaleString('pt-BR')}/10</span>
                    </div>
                    <ProgressBar value={c.score * 10} tone={t} label={`${c.label}: ${c.score} de 10`} />
                    <p className="mt-1 text-xs text-text-muted">{c.comment}</p>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="space-y-5">
            <MyErrors sim={sim} correction={correction} subjectId={subjectId} onSaved={onSaved} />
            {correction.strengths.length > 0 && (
              <Card className="p-5">
                <CardTitle className="mb-2 flex items-center gap-2">
                  <ThumbsUp className="size-4 text-success" /> O que você fez bem
                </CardTitle>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text">
                  {correction.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'linhas' && <LineByLine text={sim.text} lines={correction.lines} />}

      {tab === 'modelo' && <ModelAnswer correction={correction} />}
    </div>
  );
}

function MyErrors({ sim, correction, subjectId, onSaved }: { sim: Simulation; correction: SimCorrection; subjectId: string | null; onSaved?: () => void }) {
  const uid = useUid();
  const [subject, setSubject] = useState(subjectId ?? '');
  const [saving, setSaving] = useState(false);
  const saved = !!sim.errorsSaved;

  const save = async () => {
    setSaving(true);
    try {
      for (const e of correction.errors) {
        await createError(uid, {
          questionId: null,
          simulationId: sim.id,
          subjectId: subject,
          topicId: null,
          category: e.category,
          note: `[Simulador — ${sim.caseTitle}] ${e.error}\nPor quê: ${e.why}\nComo corrigir: ${e.fix}`,
        });
      }
      await updateDoc(userDoc(uid, 'simulations', sim.id), { errorsSaved: true });
      toast.success(`${correction.errors.length} erro(s) no caderno de erros.`);
      onSaved?.();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <CardTitle className="mb-3 flex items-center gap-2">
        <NotebookPen className="size-4 text-primary-text" /> Meus erros nesta atividade
      </CardTitle>
      {!correction.errors.length ? (
        <p className="text-sm text-text-muted">Nenhum erro relevante encontrado. Muito bem!</p>
      ) : (
        <>
          <ol className="space-y-3">
            {correction.errors.map((e, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold text-text">
                  {i + 1}. {e.error}
                </p>
                <p className="mt-1 text-text-muted">
                  <span className="font-medium text-error">Por que está errado: </span>
                  {e.why}
                </p>
                <p className="mt-1 text-text-muted">
                  <span className="font-medium text-success">Como corrigir: </span>
                  {e.fix}
                </p>
                <Badge variant="neutral" className="mt-2">
                  {e.category}
                </Badge>
              </li>
            ))}
          </ol>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {saved ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> Já estão no caderno de erros.
              </p>
            ) : (
              <>
                {!subjectId && (
                  <Field label="Matéria no caderno de erros">
                    {(id) => <SubjectSelect id={id} value={subject} emptyLabel="Escolha a matéria…" onChange={setSubject} />}
                  </Field>
                )}
                <Button variant="secondary" onClick={save} loading={saving} disabled={!subject}>
                  <NotebookPen className="size-4" /> Enviar para o caderno de erros
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/** Comparação lado a lado: a sua linha à esquerda, a sugestão à direita. */
function LineByLine({ text, lines }: { text: string; lines: SimCorrection['lines'] }) {
  const [onlyIssues, setOnlyIssues] = useState(lines.length > 0);
  const fixes = new Map(lines.map((l) => [l.index, l]));
  const all = text.split(/\r?\n/);
  const rows = all.map((t, i) => ({ i, t, fix: fixes.get(i) })).filter((r) => (onlyIssues ? r.fix : r.t.trim()));

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <p className="text-sm text-text-muted">
          {lines.length ? `${lines.length} linha(s) para ajustar.` : 'Nenhuma linha precisou de ajuste.'}
        </p>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="accent-(--primary)" />
          Só as linhas com ajuste
        </label>
      </div>
      <div className="hidden grid-cols-[3rem_1fr_1fr] gap-3 border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase md:grid">
        <span>Linha</span>
        <span>O que você escreveu</span>
        <span>Sugestão</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map(({ i, t, fix }) => (
          <li key={i} className="grid gap-2 px-4 py-3 md:grid-cols-[3rem_1fr_1fr] md:gap-3">
            <span className="text-xs font-semibold text-text-muted tabular-nums">L{i + 1}</span>
            <p className={cn('text-sm whitespace-pre-wrap', fix ? (fix.status === 'erro' ? 'text-error line-through decoration-error/50' : 'text-warning') : 'text-text')}>
              {t || <em className="text-text-muted">(linha vazia)</em>}
            </p>
            {fix ? (
              <div className="space-y-1 rounded-lg bg-success/8 p-2">
                <p className="text-sm whitespace-pre-wrap text-text">{fix.suggestion}</p>
                <p className="text-xs text-text-muted">
                  <Badge variant={fix.status === 'erro' ? 'error' : 'warning'} className="mr-1">
                    {fix.status === 'erro' ? 'Erro' : 'Ajustar'}
                  </Badge>
                  {fix.comment}
                </p>
              </div>
            ) : (
              <p className="hidden text-sm text-text-muted md:block">—</p>
            )}
          </li>
        ))}
      </ul>
      {!rows.length && <p className="p-4 text-sm text-text-muted">Nada para mostrar.</p>}
    </Card>
  );
}

function ModelAnswer({ correction }: { correction: SimCorrection }) {
  const copy = () =>
    navigator.clipboard
      .writeText(correction.modelAnswer)
      .then(() => toast.success('Modelo copiado.'))
      .catch(() => toast.error('Não foi possível copiar.'));
  return (
    <div className="space-y-4">
      {correction.essentials.length > 0 && (
        <Card className="p-5">
          <CardTitle className="mb-2 flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary-text" /> Pontos essenciais da peça
          </CardTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text">
            {correction.essentials.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <CardTitle>Modelo de resposta — {correction.expectedPiece}</CardTitle>
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="size-4" /> Copiar
          </Button>
        </div>
        <Alert variant="info" className="mb-3">
          Um modelo possível, não o único. Confira os artigos citados na legislação atualizada.
        </Alert>
        <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-text">{correction.modelAnswer}</div>
      </Card>
    </div>
  );
}
