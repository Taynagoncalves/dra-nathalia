import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { MaterialPatch } from '@/services/firebase/materials';
import type { Material, Topic } from '@/types/models';
import { normalizeUrl } from './LinkFormModal';

interface MaterialEditModalProps {
  material: Material | null;
  topics: Topic[];
  /** tags já usadas na matéria (sugestões) */
  knownTags: string[];
  onClose: () => void;
  loading?: boolean;
  onSubmit: (patch: MaterialPatch) => void;
}

const normalizeTag = (t: string) => t.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 30);

/** Renomear, descrever, marcar tags e vincular a um assunto. */
export function MaterialEditModal({ material, topics, knownTags, onClose, loading, onSubmit }: MaterialEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [topicId, setTopicId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!material) return;
    setTitle(material.title);
    setDescription(material.description ?? '');
    setTags(material.tags ?? []);
    setTagInput('');
    setTopicId(material.topicId ?? '');
    setLinkUrl(material.linkUrl ?? '');
    setError(undefined);
  }, [material]);

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !tags.includes(t) && tags.length < 10) setTags((list) => [...list, t]);
    setTagInput('');
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags((list) => list.slice(0, -1));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!material) return;
    if (!title.trim()) return setError('O título não pode ficar vazio.');
    const patch: MaterialPatch = {
      title: title.trim().slice(0, 150),
      description: description.trim(),
      tags: tagInput.trim() ? [...new Set([...tags, normalizeTag(tagInput)])] : tags,
      topicId: topicId || null,
    };
    if (material.kind === 'link') {
      const url = normalizeUrl(linkUrl);
      if (!url) return setError('Endereço do link inválido.');
      patch.linkUrl = url;
    }
    onSubmit(patch);
  };

  const suggestions = knownTags.filter((t) => !tags.includes(t) && t.includes(normalizeTag(tagInput))).slice(0, 6);

  return (
    <Modal
      open={!!material}
      onClose={onClose}
      title="Editar material"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="material-form" loading={loading}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Título" error={error}>
          {(id, d) => <Input id={id} value={title} aria-describedby={d} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        {material?.kind === 'link' && (
          <Field label="Endereço (URL)">
            {(id) => <Input id={id} value={linkUrl} inputMode="url" onChange={(e) => setLinkUrl(e.target.value)} />}
          </Field>
        )}
        <Field label="Assunto" hint={topics.length ? undefined : 'Crie assuntos na aba “Assuntos” da matéria.'}>
          {(id, d) => (
            <Select id={id} value={topicId} aria-describedby={d} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.length}>
              <option value="">Sem assunto</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tags" hint="Enter ou vírgula para adicionar. Até 10.">
          {(id, d) => (
            <div>
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-text">
                    #{t}
                    <button type="button" onClick={() => setTags((l) => l.filter((x) => x !== t))} aria-label={`Remover tag ${t}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  id={id}
                  value={tagInput}
                  aria-describedby={d}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={onTagKey}
                  onBlur={() => tagInput.trim() && addTag(tagInput)}
                  placeholder={tags.length ? '' : 'ex.: sumula, revisao'}
                  className="min-w-24 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                />
              </div>
              {tagInput && suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => addTag(s)} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted hover:bg-primary-soft">
                      #{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label="Descrição (opcional)">
          {(id) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
