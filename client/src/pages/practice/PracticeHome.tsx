import { useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { usePracticeDays } from '@/hooks/useGamification';
import { useAiStatus } from '@/hooks/useQuizzes';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { AREA_LABELS, DIFFICULTY_LABELS, scoreTone } from '@/lib/simulator';
import { generatePracticeDay } from '@/services/practice';
import type { CaseArea, CaseDifficulty, PracticeCareer } from '@/types/models';

export const CAREER_LABELS: Record<PracticeCareer, string> = {
  advocacia: 'Advocacia',
  magistratura: 'Magistratura',
  promotoria: 'Promotoria',
  defensoria: 'Defensoria Pública',
  delegacia: 'Delegacia',
};

const toneText = { success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

/** "Um dia na prática jurídica": lista de expedientes e criação de um novo. */
export default function PracticeHome() {
  const days = usePracticeDays();
  const ai = useAiStatus();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Um dia na prática jurídica"
        description="Viva um expediente: atendimento, prazos, audiência, redação e e-mail ao cliente. No fim do dia, a IA avalia cada tarefa."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Briefcase className="size-4" /> Começar um dia
          </Button>
        }
      />
      <Alert variant="info" className="mb-5">
        Situações fictícias, para treino. A avaliação é educacional e feita por IA: confira a legislação atualizada.
      </Alert>
      {ai.data && !ai.data.configured && (
        <Alert variant="warning" className="mb-4">
          Falta a chave da IA no servidor (GEMINI_API_KEY).
        </Alert>
      )}
      {days.isLoading ? (
        <LoadingBlock />
      ) : days.isError ? (
        <ErrorBlock error={days.error} onRetry={() => days.refetch()} />
      ) : !days.data?.length ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Nenhum expediente ainda"
            description="Escolha a carreira e a IA monta a agenda do seu dia, com 5 tarefas do horário de abertura ao fim do expediente."
            action={
              <Button onClick={() => setOpen(true)}>
                <Briefcase className="size-4" /> Começar meu primeiro dia
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {days.data.map((d) => {
            const answered = d.answers.filter((a) => a.trim()).length;
            return (
              <Link key={d.id} to={`/pratica/${d.id}`} className="flex items-center gap-3 p-4 hover:bg-primary-soft/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{d.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="primary">{CAREER_LABELS[d.career]}</Badge>
                    <Badge variant="neutral">{d.area === 'variado' ? 'Áreas variadas' : AREA_LABELS[d.area]}</Badge>
                    <Badge variant="neutral">{d.createdAt?.toDate().toLocaleDateString('pt-BR') ?? ''}</Badge>
                  </span>
                </span>
                {d.status === 'concluido' ? (
                  <span className={cn('text-lg font-bold tabular-nums', toneText[scoreTone(d.score ?? 0)])}>{d.score}</span>
                ) : d.status === 'gerando' || d.status === 'avaliando' ? (
                  <Badge variant="info">{d.status === 'gerando' ? 'Montando…' : 'Avaliando…'}</Badge>
                ) : d.status === 'erro' ? (
                  <Badge variant="error">Falhou</Badge>
                ) : (
                  <Badge variant="warning">
                    {answered}/{d.tasks.length} tarefas
                  </Badge>
                )}
                <ChevronRight className="size-4 shrink-0 text-text-muted" />
              </Link>
            );
          })}
        </Card>
      )}
      <NewDayModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NewDayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = useUid();
  const [career, setCareer] = useState<PracticeCareer>('advocacia');
  const [area, setArea] = useState<CaseArea | 'variado'>('variado');
  const [difficulty, setDifficulty] = useState<CaseDifficulty>('medio');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const d = await generatePracticeDay({ career, area, difficulty });
      qc.invalidateQueries({ queryKey: ['practiceDays', uid] });
      onClose();
      navigate(`/pratica/${d.id}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível montar o dia.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Começar um dia na prática"
      description="A IA monta a agenda do dia. Pode levar alguns minutos: você é avisada quando ficar pronto."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            <Sparkles className="size-4" /> {busy ? 'Enviando…' : 'Abrir o expediente'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Carreira">
          {(id) => (
            <Select id={id} value={career} onChange={(e) => setCareer(e.target.value as PracticeCareer)}>
              {(Object.keys(CAREER_LABELS) as PracticeCareer[]).map((c) => (
                <option key={c} value={c}>
                  {CAREER_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área">
            {(id) => (
              <Select id={id} value={area} onChange={(e) => setArea(e.target.value as CaseArea | 'variado')}>
                <option value="variado">Variadas</option>
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
      </div>
    </Modal>
  );
}
