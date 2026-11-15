import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GraduationCap, Mic, Plus, Radio, Save, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { SlideView } from '@/components/teacher/SlideView';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Textarea } from '@/components/ui/Field';
import { SortableList } from '@/components/ui/SortableList';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useUid } from '@/hooks/useUid';
import { friendlyError } from '@/lib/firebaseErrors';
import { docWithId, userDoc } from '@/services/firebase/db';
import type { Deck, Slide } from '@/types/models';
import NotFound from '../NotFound';

type EditSlide = Slide & { id: string };
const withIds = (slides: Slide[]): EditSlide[] => slides.map((s) => ({ ...s, id: crypto.randomUUID() }));

/** Editor da apresentação: editar, reordenar (arrastando), adicionar e excluir slides. */
export default function DeckEditor() {
  const { deckId = '' } = useParams();
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const deck = useQuery({ queryKey: ['deck', uid, deckId], queryFn: async () => docWithId<Deck>(await getDoc(userDoc(uid, 'decks', deckId))) });
  const [slides, setSlides] = useState<EditSlide[]>([]);
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (deck.data) {
      setSlides(withIds(deck.data.slides));
      setTitle(deck.data.title);
      setDirty(false);
    }
  }, [deck.data]);

  if (deck.isLoading) return <LoadingBlock label="Abrindo a apresentação…" />;
  if (deck.isError) return <ErrorBlock error={deck.error} />;
  if (!deck.data) return <NotFound />;

  const change = (next: EditSlide[]) => {
    setSlides(next);
    setDirty(true);
  };
  const patch = (id: string, data: Partial<Slide>) => change(slides.map((s) => (s.id === id ? { ...s, ...data } : s)));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(userDoc(uid, 'decks', deckId), {
        title: title.trim() || 'Apresentação',
        slides: slides.map(({ id: _id, ...s }) => ({ ...s, bullets: s.bullets.map((b) => b.trim()).filter(Boolean) })),
        updatedAt: serverTimestamp(),
      });
      await qc.invalidateQueries({ queryKey: ['deck', uid, deckId] });
      qc.invalidateQueries({ queryKey: ['decks', uid] });
      setDirty(false);
      toast.success('Apresentação salva.');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const go = async (mode: 'oral' | 'tayna' | 'aovivo') => {
    if (dirty) await save();
    navigate(`/professora/${deckId}/apresentar?modo=${mode}`);
  };

  const current = slides[Math.min(preview, slides.length - 1)];

  return (
    <>
      <Breadcrumb items={[{ label: 'Modo Professora', to: '/professora' }, { label: deck.data.title }]} />
      <PageHeader
        title="Editar apresentação"
        actions={
          <>
            <Button variant="secondary" onClick={save} disabled={!dirty} loading={saving}>
              <Save className="size-4" /> {dirty ? 'Salvar' : 'Salvo'}
            </Button>
            <Button variant="danger" size="icon" onClick={() => setDeleting(true)} aria-label="Excluir apresentação">
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {deck.data.noMaterial && <Alert variant="info" className="mb-4">Criada sem os seus materiais: confira os fundamentos antes de apresentar.</Alert>}

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <Button className="h-auto justify-start py-3" onClick={() => go('oral')}>
          <Mic className="size-5" />
          <span className="text-left">
            <span className="block">Ensino oral</span>
            <span className="block text-xs font-normal opacity-90">Fale; a IA avalia</span>
          </span>
        </Button>
        <Button variant="secondary" className="h-auto justify-start py-3" onClick={() => go('tayna')}>
          <GraduationCap className="size-5" />
          <span className="text-left">
            <span className="block">Modo Tayna</span>
            <span className="block text-xs font-normal text-text-muted">Ela faz perguntas</span>
          </span>
        </Button>
        <Button variant="secondary" className="h-auto justify-start py-3" onClick={() => go('aovivo')}>
          <Users className="size-5" />
          <span className="text-left">
            <span className="block">Tayna de verdade</span>
            <span className="block text-xs font-normal text-text-muted">Outra pessoa pelo celular</span>
          </span>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          <Input value={title} onChange={(e) => (setTitle(e.target.value), setDirty(true))} aria-label="Título da apresentação" className="text-base font-semibold" />
          <SortableList
            items={slides}
            onReorder={change}
            renderItem={(s, handle) => {
              const i = slides.findIndex((x) => x.id === s.id);
              return (
                <div className={`space-y-2 rounded-xl border bg-surface p-3 ${i === preview ? 'border-primary' : 'border-border'}`} onFocus={() => setPreview(i)} onClick={() => setPreview(i)}>
                  <div className="flex items-center gap-2">
                    {handle}
                    <span className="text-xs font-semibold text-text-muted">{i + 1}</span>
                    <Input value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} aria-label={`Título do slide ${i + 1}`} className="h-9 font-medium" />
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 hover:text-error" disabled={slides.length <= 1} onClick={() => change(slides.filter((x) => x.id !== s.id))} aria-label={`Excluir slide ${i + 1}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Textarea
                    rows={Math.max(3, s.bullets.length)}
                    value={s.bullets.join('\n')}
                    onChange={(e) => patch(s.id, { bullets: e.target.value.split('\n') })}
                    aria-label="Tópicos (um por linha)"
                    placeholder="Um tópico por linha"
                    className="text-sm"
                  />
                  <Input value={s.highlight ?? ''} onChange={(e) => patch(s.id, { highlight: e.target.value || null })} placeholder="Destaque (exemplo, esquema, pegadinha…)" aria-label="Destaque" className="h-9 text-sm" />
                  <details>
                    <summary className="cursor-pointer text-xs text-text-muted">Roteiro de fala</summary>
                    <Textarea rows={3} value={s.notes} onChange={(e) => patch(s.id, { notes: e.target.value })} aria-label="Roteiro de fala" className="mt-1 text-sm" />
                  </details>
                </div>
              );
            }}
          />
          <Button variant="secondary" onClick={() => change([...slides, { id: crypto.randomUUID(), title: 'Novo slide', bullets: [''], notes: '', highlight: null }])}>
            <Plus className="size-4" /> Adicionar slide
          </Button>
        </div>
        <aside className="h-fit space-y-2 lg:sticky lg:top-20">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
            <Radio className="size-3.5" /> Prévia
          </p>
          {current && <SlideView slide={{ ...current, bullets: current.bullets.filter(Boolean) }} index={preview} total={slides.length} />}
        </aside>
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir esta apresentação?"
        confirmLabel="Excluir"
        danger
        onConfirm={async () => {
          await deleteDoc(userDoc(uid, 'decks', deckId)).catch((err) => toast.error(friendlyError(err)));
          qc.invalidateQueries({ queryKey: ['decks', uid] });
          navigate('/professora');
        }}
      />
    </>
  );
}
