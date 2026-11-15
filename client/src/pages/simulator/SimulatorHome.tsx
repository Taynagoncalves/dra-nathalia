import { Award, ChevronRight, FileText, Gavel, Scale, Sparkles, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StatTile } from '@/components/charts/StatTile';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimDisclaimer } from '@/components/simulator/SimDisclaimer';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { Tabs } from '@/components/ui/Tabs';
import { useAiStatus } from '@/hooks/useQuizzes';
import { useCases, useSimulations } from '@/hooks/useSimulator';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { AREA_LABELS, DIFFICULTY_LABELS, ROLE_LABELS, ROLES, scoreTone, simStats, SIM_LEVELS } from '@/lib/simulator';
import { generateCase } from '@/services/simulator';
import type { CaseArea, CaseDifficulty, SimRole, Simulation } from '@/types/models';

type Tab = 'casos' | 'historico';
const ROLE_ICONS = { autor: Scale, reu: FileText, magistrado: Gavel } as const;
const toneText = { success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

/** Simulador Jurídico: nível, estatísticas por papel, casos e histórico. */
export default function SimulatorHome() {
  const cases = useCases();
  const sims = useSimulations();
  const ai = useAiStatus();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('casos');
  const stats = simStats(sims.data ?? []);

  const rolesByCase = new Map<string, Simulation[]>();
  for (const s of sims.data ?? []) rolesByCase.set(s.caseId, [...(rolesByCase.get(s.caseId) ?? []), s]);

  return (
    <>
      <PageHeader
        title="Simulador Jurídico"
        description="Um caso fictício com documentos, a Roleta Jurídica sorteia o seu papel e você descobre qual peça fazer."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Sparkles className="size-4" /> Novo caso
          </Button>
        }
      />
      <SimDisclaimer className="mb-5" />
      {ai.data && !ai.data.configured && (
        <Alert variant="warning" className="mb-4">
          Falta a chave da IA no servidor (GEMINI_API_KEY).
        </Alert>
      )}

      {/* Nível e estatísticas */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
            <Award className="size-4" /> Seu nível
          </p>
          <p className="mt-1 text-2xl font-bold text-primary-text">{stats.level.name}</p>
          <ProgressBar value={stats.level.progress} className="mt-3" label="Progresso até o próximo nível" />
          <p className="mt-1.5 text-xs text-text-muted">
            {stats.level.next ? `${stats.level.toNext} pontos para ${stats.level.next}` : 'Nível máximo alcançado!'} · {stats.points} pontos
          </p>
          <details className="mt-3 text-xs text-text-muted">
            <summary className="cursor-pointer">Como subir de nível</summary>
            <p className="mt-1">Cada peça corrigida soma a nota (0 a 100) aos seus pontos.</p>
            <ol className="mt-1 space-y-0.5">
              {SIM_LEVELS.map((l, i) => (
                <li key={l.name} className={cn(i === stats.level.index && 'font-semibold text-primary-text')}>
                  {l.name} — {l.min} pts
                </li>
              ))}
            </ol>
          </details>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.byRole.map((r) => {
            const Icon = ROLE_ICONS[r.role];
            return (
              <StatTile
                key={r.role}
                icon={Icon}
                label={ROLE_LABELS[r.role]}
                value={r.average === null ? '—' : r.average}
                hint={r.count ? `média · ${r.count} peça(s) · melhor ${r.best}` : 'nenhuma peça ainda'}
              />
            );
          })}
        </div>
      </div>

      <Tabs<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'casos', label: 'Casos' },
          { value: 'historico', label: 'Histórico', badge: stats.done ? <Badge variant="neutral">{stats.done}</Badge> : undefined },
        ]}
      />

      {tab === 'casos' &&
        (cases.isLoading ? (
          <LoadingBlock />
        ) : cases.isError ? (
          <ErrorBlock error={cases.error} onRetry={() => cases.refetch()} />
        ) : !cases.data?.length ? (
          <Card>
            <EmptyState
              icon={Scale}
              title="Nenhum caso ainda"
              description="A IA cria um caso concreto fictício, com contratos, conversas, comprovantes e decisões. Depois a roleta sorteia o seu papel."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Sparkles className="size-4" /> Gerar meu primeiro caso
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cases.data.map((c) => {
              const done = rolesByCase.get(c.id) ?? [];
              return (
                <li key={c.id}>
                  <Link to={`/simulador/casos/${c.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 font-semibold text-text">{c.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-text-muted" />
                    </span>
                    <span className="line-clamp-2 text-sm text-text-muted">{c.summary}</span>
                    <span className="mt-auto flex flex-wrap gap-1 pt-1">
                      <Badge variant="primary">{AREA_LABELS[c.area]}</Badge>
                      <Badge variant="neutral">{DIFFICULTY_LABELS[c.difficulty]}</Badge>
                      {ROLES.map((r) => {
                        const s = done.find((x) => x.role === r && x.status === 'corrigida');
                        return s ? (
                          <Badge key={r} variant={scoreTone(s.score ?? 0)}>
                            {ROLE_LABELS[r]} {s.score}
                          </Badge>
                        ) : null;
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'historico' && <History sims={sims.data ?? []} loading={sims.isLoading} error={sims.isError ? sims.error : null} />}

      <NewCaseModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function History({ sims, loading, error }: { sims: Simulation[]; loading: boolean; error: unknown }) {
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} />;
  if (!sims.length)
    return (
      <Card>
        <EmptyState icon={Trophy} title="Nenhuma peça ainda" description="Abra um caso, gire a roleta e escreva a sua peça." />
      </Card>
    );
  return (
    <Card className="divide-y divide-border p-0">
      {sims.map((s) => (
        <Link key={s.id} to={`/simulador/pecas/${s.id}`} className="flex items-center gap-3 p-4 hover:bg-primary-soft/40">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text">{s.caseTitle}</span>
            <span className="block truncate text-xs text-text-muted">
              {ROLE_LABELS[s.role as SimRole]} · {s.pieceTitle || 'peça sem título'} · {s.createdAt?.toDate().toLocaleDateString('pt-BR') ?? ''}
            </span>
          </span>
          {s.status === 'corrigida' ? (
            <span className={cn('text-lg font-bold tabular-nums', toneText[scoreTone(s.score ?? 0)])}>{s.score}</span>
          ) : (
            <Badge variant="neutral">{s.status === 'corrigindo' ? 'Corrigindo' : 'Rascunho'}</Badge>
          )}
          <ChevronRight className="size-4 shrink-0 text-text-muted" />
        </Link>
      ))}
    </Card>
  );
}

function NewCaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [area, setArea] = useState<CaseArea>('civil');
  const [difficulty, setDifficulty] = useState<CaseDifficulty>('medio');
  const [subjectId, setSubjectId] = useState('');
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const c = await generateCase({ area, difficulty, subjectId: subjectId || null, theme: theme.trim() || undefined });
      qc.invalidateQueries({ queryKey: ['cases'] });
      onClose();
      navigate(`/simulador/casos/${c.id}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível gerar o caso.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Novo caso concreto"
      description="A IA cria um caso fictício com documentos. Leva de 20 a 60 segundos."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            <Sparkles className="size-4" /> {busy ? 'Montando o caso…' : 'Gerar caso'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área">
            {(id) => (
              <Select id={id} value={area} onChange={(e) => setArea(e.target.value as CaseArea)}>
                {(Object.keys(AREA_LABELS) as CaseArea[]).map((a) => (
                  <option key={a} value={a}>
                    {AREA_LABELS[a]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Dificuldade">
            {(id) => (
              <Select id={id} value={difficulty} onChange={(e) => setDifficulty(e.target.value as CaseDifficulty)}>
                {(Object.keys(DIFFICULTY_LABELS) as CaseDifficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Matéria (opcional)" hint="Liga o caso a uma matéria: a IA se inspira nos seus materiais e os erros vão para ela no caderno.">
          {(id) => <SubjectSelect id={id} value={subjectId} emptyLabel="Nenhuma" onChange={setSubjectId} />}
        </Field>
        <Field label="Tema (opcional)">
          {(id) => <Input id={id} value={theme} maxLength={200} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: vício do produto, despejo por falta de pagamento…" />}
        </Field>
      </div>
    </Modal>
  );
}
