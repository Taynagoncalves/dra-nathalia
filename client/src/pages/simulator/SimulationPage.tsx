import { useQueryClient } from '@tanstack/react-query';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { Dices, FileText, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { CaseDocuments } from '@/components/simulator/CaseDocuments';
import { CorrectionView } from '@/components/simulator/CorrectionView';
import { SimDisclaimer } from '@/components/simulator/SimDisclaimer';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useCase, useSimulation } from '@/hooks/useSimulator';
import { useUid } from '@/hooks/useUid';
import { friendlyError } from '@/lib/firebaseErrors';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/simulator';
import { userDoc } from '@/services/firebase/db';
import { correctSimulation } from '@/services/simulator';
import type { LegalCase, Simulation } from '@/types/models';
import NotFound from '../NotFound';

const MIN_CHARS = 200;
const MAX_CHARS = 60_000;

/** A peça: editor (rascunho com salvamento automático) ou o resultado da correção. */
export default function SimulationPage() {
  const { simId = '' } = useParams();
  const sim = useSimulation(simId);
  const legalCase = useCase(sim.data?.caseId);

  if (sim.isLoading || (sim.data && legalCase.isLoading)) return <LoadingBlock label="Abrindo a peça…" />;
  if (sim.isError) return <ErrorBlock error={sim.error} onRetry={() => sim.refetch()} />;
  if (!sim.data) return <NotFound />;
  if (legalCase.isError) return <ErrorBlock error={legalCase.error} />;
  const c = legalCase.data;
  const s = sim.data;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Simulador Jurídico', to: '/simulador' },
          { label: s.caseTitle, to: c ? `/simulador/casos/${c.id}` : undefined },
          { label: ROLE_LABELS[s.role] },
        ]}
      />
      {s.status === 'corrigida' && s.correction ? (
        <>
          <PageHeader
            title={`Correção — ${ROLE_LABELS[s.role]}`}
            description={s.pieceTitle ? `Sua peça: ${s.pieceTitle}` : undefined}
            actions={
              c && (
                <ButtonLink to={`/simulador/casos/${c.id}`} variant="secondary">
                  <Dices className="size-4" /> Refazer com outro papel
                </ButtonLink>
              )
            }
          />
          <SimDisclaimer className="mb-5" />
          <CorrectionView sim={s} correction={s.correction} subjectId={c?.subjectId ?? null} onSaved={() => sim.refetch()} />
        </>
      ) : (
        <Editor sim={s} legalCase={c ?? null} onCorrected={() => sim.refetch()} />
      )}
    </>
  );
}

function Editor({ sim, legalCase, onCorrected }: { sim: Simulation; legalCase: LegalCase | null; onCorrected: () => void }) {
  const uid = useUid();
  const qc = useQueryClient();
  const [pieceTitle, setPieceTitle] = useState(sim.pieceTitle);
  const [text, setText] = useState(sim.text);
  const [saveState, setSaveState] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo');
  const [confirm, setConfirm] = useState(false);
  const [correcting, setCorrecting] = useState(sim.status === 'corrigindo');
  const latest = useRef({ pieceTitle, text });
  latest.current = { pieceTitle, text };

  const save = useCallback(async () => {
    setSaveState('salvando');
    try {
      await updateDoc(userDoc(uid, 'simulations', sim.id), { ...latest.current, updatedAt: serverTimestamp() });
      setSaveState('salvo');
    } catch (err) {
      setSaveState('erro');
      throw err;
    }
  }, [uid, sim.id]);

  // salvamento automático 1,5 s depois de parar de digitar
  useEffect(() => {
    if (pieceTitle === sim.pieceTitle && text === sim.text && saveState === 'salvo') return;
    setSaveState('pendente');
    const t = window.setTimeout(() => save().catch(() => {}), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceTitle, text]);

  // avisa antes de sair com alterações não salvas
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === 'pendente' || saveState === 'salvando') e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const submit = async () => {
    setCorrecting(true);
    try {
      await save();
      await correctSimulation(sim.id);
      qc.invalidateQueries({ queryKey: ['simulations', uid] });
      toast.success('Peça corrigida!');
      onCorrected();
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível corrigir a peça.'));
      setCorrecting(false);
    }
  };

  const chars = text.trim().length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooShort = chars < MIN_CHARS;

  if (correcting) {
    return (
      <Card className="mx-auto mt-8 max-w-lg p-8 text-center">
        <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary-text" />
        <p className="font-semibold text-text">Corrigindo a sua peça…</p>
        <p className="mt-1 text-sm text-text-muted">A IA confere os 8 critérios, linha por linha, e prepara o modelo de resposta. Pode levar até 2 minutos.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`Você é: ${ROLE_LABELS[sim.role]}`}
        description={ROLE_DESCRIPTIONS[sim.role]}
        actions={
          <span className="text-xs text-text-muted" aria-live="polite">
            {saveState === 'salvando' ? 'Salvando…' : saveState === 'pendente' ? 'Alterações não salvas' : saveState === 'erro' ? 'Erro ao salvar' : 'Rascunho salvo'}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">
          {legalCase ? (
            <>
              <Alert variant="info" title="A sua situação">
                {legalCase.roles[sim.role]}
              </Alert>
              <details className="rounded-xl border border-border bg-surface p-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-text">Os fatos</summary>
                <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-text">{legalCase.facts}</div>
                <p className="mt-3 text-xs text-text-muted">
                  Autor: {legalCase.parties.autor} · Réu: {legalCase.parties.reu}
                </p>
              </details>
              <CaseDocuments documents={legalCase.documents} />
            </>
          ) : (
            <Alert variant="warning">O caso desta peça foi excluído.</Alert>
          )}
        </div>

        <Card className="flex flex-col gap-3 p-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary-text" /> Sua peça
          </CardTitle>
          <Field label="Qual peça você vai fazer?" hint="Descubra pelo caso e pelo seu papel. Ex.: o nome da ação, da defesa ou da decisão.">
            {(id, d) => <Input id={id} aria-describedby={d} value={pieceTitle} maxLength={200} onChange={(e) => setPieceTitle(e.target.value)} placeholder="Nome da peça" />}
          </Field>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            aria-label="Texto da peça"
            placeholder={'Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a)…\n\nEscreva a peça completa: endereçamento, qualificação, fatos, fundamentos, pedidos e fechamento.'}
            className="min-h-[55vh] flex-1 font-serif text-[15px] leading-relaxed"
            spellCheck
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-text-muted tabular-nums">
              {words} palavras · {chars.toLocaleString('pt-BR')} caracteres
              {tooShort && chars > 0 && ` (mínimo ${MIN_CHARS})`}
            </span>
            <Button onClick={() => setConfirm(true)} disabled={tooShort || !legalCase}>
              <Send className="size-4" /> Enviar para correção
            </Button>
          </div>
          {sim.status === 'corrigindo' && <Badge variant="warning">A última correção não terminou. Envie de novo.</Badge>}
        </Card>
      </div>
      <SimDisclaimer className="mt-5" />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Enviar para correção?"
        description="Depois do envio a peça não pode mais ser editada. O modelo de resposta só aparece depois da correção."
        confirmLabel="Enviar"
        onConfirm={() => {
          setConfirm(false);
          void submit();
        }}
      />
    </>
  );
}
