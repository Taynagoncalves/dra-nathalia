import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field, Input } from '@/components/ui/Field';
import { IconPicker } from '@/components/ui/IconPicker';
import { IconTile } from '@/components/ui/IconTile';
import { Modal } from '@/components/ui/Modal';

export interface EntityValues {
  name: string;
  color: string;
  icon: string;
}

interface EntityFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: EntityValues;
  submitLabel: string;
  namePlaceholder?: string;
  loading?: boolean;
  onSubmit: (values: EntityValues) => void;
  /** campos extras (ex.: tipo do projeto), mostrados depois do nome */
  extra?: ReactNode;
}

/** Formulário de nome + cor + ícone, usado por projetos e matérias. */
export function EntityFormModal({
  open,
  onClose,
  title,
  initial,
  submitLabel,
  namePlaceholder,
  loading,
  onSubmit,
  extra,
}: EntityFormModalProps) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();

  // Reinicia o formulário sempre que abre.
  useEffect(() => {
    if (open) {
      setValues(initial);
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = values.name.trim();
    if (name.length < 2) return setError('Informe um nome com pelo menos 2 letras.');
    if (name.length > 80) return setError('Nome muito longo (máx. 80 caracteres).');
    onSubmit({ ...values, name });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="entity-form" loading={loading}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-end gap-3">
          <IconTile icon={values.icon} color={values.color} size="lg" />
          <Field label="Nome" error={error} className="flex-1">
            {(id, d) => (
              <Input
                id={id}
                autoFocus
                value={values.name}
                placeholder={namePlaceholder}
                aria-describedby={d}
                aria-invalid={!!error}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
            )}
          </Field>
        </div>
        {extra}
        <ColorPicker value={values.color} onChange={(color) => setValues((v) => ({ ...v, color }))} />
        <IconPicker value={values.icon} onChange={(icon) => setValues((v) => ({ ...v, icon: icon ?? 'BookOpen' }))} />
      </form>
    </Modal>
  );
}
