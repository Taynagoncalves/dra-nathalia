import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

export interface LinkValues {
  title: string;
  linkUrl: string;
  description: string;
}

/** Normaliza e valida a URL (aceita sem "https://"). */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

interface LinkFormModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onSubmit: (values: LinkValues) => void;
}

export function LinkFormModal({ open, onClose, loading, onSubmit }: LinkFormModalProps) {
  const [values, setValues] = useState<LinkValues>({ title: '', linkUrl: '', description: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LinkValues, string>>>({});

  useEffect(() => {
    if (open) {
      setValues({ title: '', linkUrl: '', description: '' });
      setErrors({});
    }
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(values.linkUrl);
    const next: typeof errors = {};
    if (!url) next.linkUrl = 'Informe um endereço válido (ex.: www.stj.jus.br).';
    if (!values.title.trim() && !url) next.title = 'Informe um título.';
    setErrors(next);
    if (Object.keys(next).length || !url) return;
    onSubmit({
      title: values.title.trim() || new URL(url).hostname.replace(/^www\./, ''),
      linkUrl: url,
      description: values.description.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Salvar link"
      description="Guarde só o link — o conteúdo continua no site de origem."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="link-form" loading={loading}>
            Salvar link
          </Button>
        </>
      }
    >
      <form id="link-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Endereço (URL)" error={errors.linkUrl}>
          {(id, d) => (
            <Input
              id={id}
              autoFocus
              inputMode="url"
              placeholder="https://…"
              value={values.linkUrl}
              aria-describedby={d}
              aria-invalid={!!errors.linkUrl}
              onChange={(e) => setValues((v) => ({ ...v, linkUrl: e.target.value }))}
            />
          )}
        </Field>
        <Field label="Título" error={errors.title} hint="Se deixar em branco, usamos o nome do site.">
          {(id, d) => (
            <Input
              id={id}
              placeholder="Ex.: Informativo 812 do STJ"
              value={values.title}
              aria-describedby={d}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            />
          )}
        </Field>
        <Field label="Descrição (opcional)">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
