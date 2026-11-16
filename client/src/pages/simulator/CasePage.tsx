import { useQueryClient } from '@tanstack/react-query';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronRight, PenLine, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { CaseDocuments } from '@/components/simulator/CaseDocuments';
import { RoleWheel } from '@/components/simulator/RoleWheel';
import { SimDisclaimer } from '@/components/simulator/SimDisclaimer';
import { AiProgress, isStaleJob } from '@/components/ui/AiProgress';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useCase, useSimulations } from '@/hooks/useSimulator';
import { useUid } from '@/hooks/useUid';
import { friendlyError } from '@/lib/firebaseErrors';
import { AREA_LABELS, DIFFICULTY_LABELS, ROLE_LABELS, scoreTone } from '@/lib/simulator';
import { userCol } from '@/services/firebase/db';
import { deleteCase } from '@/services/simulator';
import type { SimRole } from '@/types/models';
import NotFound from '../NotFound';

/** O caso: fatos, partes, documentos e a Roleta Jurídica. */
export default function CasePage() {
  const { caseId = '' } = useParams();
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const legalCase = useCase(caseId);
  const sims = useSimulations();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (legalCase.isLoading || sims.isLoading) return <LoadingBlock label="Abrindo o caso…" />;
  if (legalCase.isError) return <ErrorBlock error={legalCase.error} onRetry={() => legalCase.refetch()} />;
  const c = legalCase.data;
  if (!c) return <NotFound />;

  const crumbs = <Breadcrumb items={[{ label: 'Simulador Jurídico', to: '/simulador' }, { label: c.status === 'pronto' || !c.status ? c.title : 'Novo caso' }]} />;
  if (c.status === 'gerando' && !isStaleJob(c.jobStartedAt)) {
    return (
      <>
        {crumbs}
        <AiProgress
          title="Montando o seu caso…"
          startedAt={c.jobStartedAt}
          typicalSec={50}
          steps={['Inventando as partes e o conflito…', 'Escrevendo os fatos…', 'Redigindo contratos, conversas e comprovantes…', 'Preparando a situação de cada papel…']}
        />
      </>
    );
  }
  if (c.status === 'erro' || c.status === 'gerando') {
    return (
      <>
        {crumbs}
        <Card className="mx-auto mt-6 max-w-lg space-y-4 p-6">
          <Alert variant="error" title="O caso não foi gerado">
            {c.error ?? 'A geração demorou demais e foi interrompida.'} O uso da IA foi devolvido.
          </Alert>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await deleteCase(caseId).catch(() => {});
                qc.invalidateQueries({ queryKey: ['cases', uid] });
                navigate('/simulador');
              }}
            >
              <Trash2 className="size-4" /> Descartar e voltar
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const mine = (sims.data ?? []).filter((s) => s.caseId === caseId);
  const doneRoles = [...new Set(mine.map((s) => s.role))];
  const draft = mine.find((s) => s.status !== 'corrigida');

  const start = async (role: SimRole) => {
    setCreating(true);
    try {
      const ref = await addDoc(userCol(uid, 'simulations'), {
        caseId,
        caseTitle: c.title,
        area: c.area,
        role,
        pieceTitle: '',
        text: '',
        status: 'rascunho',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      qc.invalidateQueries({ queryKey: ['simulations', uid] });
      // um instante para ver o resultado da roleta
      window.setTimeout(() => navigate(`/simulador/pecas/${ref.id}`), 1400);
    } catch (err) {
      toast.error(friendlyError(err));
      setCreating(false);
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: 'Simulador Jurídico', to: '/simulador' }, { label: c.title }]} />
      <PageHeader
        title={c.title}
        description={c.summary}
        actions={
          <Button variant="danger" size="icon" onClick={() => setDeleting(true)} aria-label="Excluir caso">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge variant="primary">{AREA_LABELS[c.area]}</Badge>
        <Badge variant="neutral">{DIFFICULTY_LABELS[c.difficulty]}</Badge>
        <Badge variant="neutral">{c.documents.length} documentos</Badge>
      </div>
      <SimDisclaimer className="mb-5" />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card className="p-5">
            <CardTitle className="mb-2">Os fatos</CardTitle>
            <div className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap text-text">{c.facts}</div>
            <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <p>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase">
                  <Users className="size-3.5" /> Parte autora
                </span>
                {c.parties.autor}
              </p>
              <p>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase">
                  <Users className="size-3.5" /> Parte ré
                </span>
                {c.parties.reu}
              </p>
            </div>
          </Card>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-text">Documentos do caso</h2>
            <CaseDocuments documents={c.documents} />
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <CardTitle className="mb-1 text-center">Roleta Jurídica</CardTitle>
            {draft ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-text-muted">
                  Você tem uma peça em andamento como <strong className="text-text">{ROLE_LABELS[draft.role]}</strong>.
                </p>
                <ButtonLink to={`/simulador/pecas/${draft.id}`} className="w-full">
                  <PenLine className="size-4" /> Continuar a peça
                </ButtonLink>
              </div>
            ) : (
              <>
                <p className="mb-4 text-center text-sm text-text-muted">{doneRoles.length ? 'Refaça o caso com outro papel.' : 'Leia o caso e gire: o seu papel é sorteado.'}</p>
                <RoleWheel done={doneRoles} onResult={start} busy={creating} />
              </>
            )}
          </Card>
          {mine.some((s) => s.status === 'corrigida') && (
            <Card className="p-4">
              <CardTitle className="mb-2 text-sm">Suas peças neste caso</CardTitle>
              <ul className="space-y-1">
                {mine
                  .filter((s) => s.status === 'corrigida')
                  .map((s) => (
                    <li key={s.id}>
                      <Link to={`/simulador/pecas/${s.id}`} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-primary-soft/50">
                        <span className="flex-1 text-text">{ROLE_LABELS[s.role]}</span>
                        <Badge variant={scoreTone(s.score ?? 0)}>{s.score}/100</Badge>
                        <ChevronRight className="size-4 text-text-muted" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir este caso?"
        description={mine.length ? `As ${mine.length} peça(s) deste caso também serão excluídas.` : undefined}
        confirmLabel="Excluir"
        danger
        onConfirm={async () => {
          try {
            await deleteCase(caseId);
            qc.invalidateQueries({ queryKey: ['cases', uid] });
            qc.invalidateQueries({ queryKey: ['simulations', uid] });
            toast.success('Caso excluído.');
            navigate('/simulador');
          } catch (err) {
            toast.error(friendlyError(err));
          }
        }}
      />
    </>
  );
}
