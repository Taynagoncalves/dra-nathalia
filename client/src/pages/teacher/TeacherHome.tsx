import { useQuery } from '@tanstack/react-query';
import { getDocs, orderBy, query } from 'firebase/firestore';
import { ChevronRight, FileUp, Presentation, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnSlidesModal } from '@/components/teacher/OwnSlidesModal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useAiStatus } from '@/hooks/useQuizzes';
import { useAllSubjects, useTopics } from '@/hooks/useStudyData';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { docsWithId, userCol } from '@/services/firebase/db';
import { generateDeck } from '@/services/teacher';
import type { Deck, DeckTemplate } from '@/types/models';

export const TEMPLATE_LABELS: Record<DeckTemplate, { label: string; text: string }> = {
  tradicional: { label: 'Tradicional', text: 'Conceito, elementos, requisitos e exemplos' },
  visual: { label: 'Visual', text: 'Pouco texto, esquemas e comparações' },
  revisao: { label: 'Revisão', text: 'O que mais cai, com pegadinhas' },
  juridica: { label: 'Jurídica', text: 'Lei, doutrina e jurisprudência dos materiais' },
  ensinar: { label: 'Ensinar outra pessoa', text: 'Linguagem simples e analogias' },
};

export function useDecks() {
  const uid = useUid();
  return useQuery({
    queryKey: ['decks', uid],
    queryFn: async () => docsWithId<Deck>(await getDocs(query(userCol(uid, 'decks'), orderBy('createdAt', 'desc')))),
  });
}

/** Modo Professora: suas apresentações e a criação de slides com IA. */
export default function TeacherHome() {
  const decks = useDecks();
  const subjects = useAllSubjects();
  const ai = useAiStatus();
  const [open, setOpen] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? 'Matéria';

  return (
    <>
      <PageHeader
        title="Modo Professora"
        description="Ensinar é o melhor jeito de aprender: crie slides, apresente falando e responda às perguntas da Tayna."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOwnOpen(true)}>
              <FileUp className="size-4" /> Usar meus slides
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Sparkles className="size-4" /> Criar slides
            </Button>
          </>
        }
      />
      {ai.data && !ai.data.configured && (
        <Alert variant="warning" className="mb-4">
          Falta a chave da IA no servidor (GEMINI_API_KEY).
        </Alert>
      )}
      {decks.isLoading ? (
        <LoadingBlock />
      ) : decks.isError ? (
        <ErrorBlock error={decks.error} onRetry={() => decks.refetch()} />
      ) : !decks.data?.length ? (
        <Card>
          <EmptyState
            icon={Presentation}
            title="Nenhuma apresentação ainda"
            description="A IA cria os slides a partir de uma matéria, de um assunto ou dos seus materiais — ou envie os seus próprios slides (PDF ou PowerPoint). Depois é só apresentar."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setOpen(true)}>
                  <Sparkles className="size-4" /> Criar com a IA
                </Button>
                <Button variant="secondary" onClick={() => setOwnOpen(true)}>
                  <FileUp className="size-4" /> Usar meus slides
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data.map((d) => (
            <li key={d.id}>
              <Link to={`/professora/${d.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-semibold text-text">{d.title}</span>
                  <ChevronRight className="size-4 shrink-0 text-text-muted" />
                </span>
                <span className="mt-auto flex flex-wrap gap-1">
                  <Badge variant="primary">{subjectName(d.subjectId)}</Badge>
                  <Badge variant="neutral">{d.template === 'proprio' ? 'Meus slides' : TEMPLATE_LABELS[d.template]?.label}</Badge>
                  <Badge variant="neutral">{d.slides.length} slides</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateDeckModal open={open} onClose={() => setOpen(false)} />
      <OwnSlidesModal open={ownOpen} onClose={() => setOwnOpen(false)} />
    </>
  );
}

function CreateDeckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [template, setTemplate] = useState<DeckTemplate>('tradicional');
  const [count, setCount] = useState(8);
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);
  const topics = useTopics(subjectId || undefined);

  const submit = async () => {
    setBusy(true);
    try {
      const deck = await generateDeck({ subjectId, topicId: topicId || null, materialIds: [], template, count, theme: theme.trim() || undefined });
      onClose();
      navigate(`/professora/${deck.id}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível criar os slides.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar slides com IA"
      description="A IA usa os materiais prontos da matéria (ou do assunto)."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!subjectId} loading={busy}>
            <Sparkles className="size-4" /> {busy ? 'Criando os slides…' : `Criar ${count} slides`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Matéria">{(id) => <SubjectSelect id={id} value={subjectId} emptyLabel="Escolha…" onChange={(v) => (setSubjectId(v), setTopicId(''))} />}</Field>
          <Field label="Assunto (opcional)">
            {(id) => (
              <Select id={id} value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.data?.length}>
                <option value="">Matéria inteira</option>
                {topics.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Tema específico (opcional)" hint="Use se a matéria ainda não tem materiais, ou para focar num ponto.">
          {(id, d) => <Input id={id} aria-describedby={d} value={theme} maxLength={200} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Responsabilidade civil objetiva" />}
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Modelo</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(TEMPLATE_LABELS) as DeckTemplate[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={template === t}
                onClick={() => setTemplate(t)}
                className={cn('rounded-lg border p-3 text-left transition-colors', template === t ? 'border-primary bg-primary-soft' : 'border-border hover:bg-primary-soft/40')}
              >
                <span className={cn('block text-sm font-semibold', template === t ? 'text-primary-text' : 'text-text')}>{TEMPLATE_LABELS[t].label}</span>
                <span className="block text-xs text-text-muted">{TEMPLATE_LABELS[t].text}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={`Quantidade de slides: ${count}`}>
          {(id) => <input id={id} type="range" min={3} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-(--primary)" />}
        </Field>
      </div>
    </Modal>
  );
}
