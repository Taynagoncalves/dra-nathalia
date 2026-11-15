import { Folder } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field, Input } from '@/components/ui/Field';
import { IconPicker } from '@/components/ui/IconPicker';
import { Modal } from '@/components/ui/Modal';
import { iconByName } from '@/config/icons';
import type { FolderInput } from '@/services/firebase/folders';
import { FolderCard } from './FolderCard';

interface FolderFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: FolderInput;
  title: string;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: FolderInput) => void;
}

/** Criar/editar pasta: nome, cor (12 prontas + hex) e ícone opcional, com prévia. */
export function FolderFormModal({ open, onClose, initial, title, submitLabel, loading, onSubmit }: FolderFormModalProps) {
  const empty: FolderInput = { name: '', color: '#7C3AED', icon: null };
  const [values, setValues] = useState<FolderInput>(initial ?? empty);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setValues(initial ?? empty);
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) return setError('Dê um nome para a pasta.');
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
          <Button type="submit" form="folder-form" loading={loading}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="folder-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Nome da pasta" error={error}>
          {(id, d) => (
            <Input
              id={id}
              autoFocus
              value={values.name}
              placeholder="Ex.: Súmulas do STJ"
              aria-describedby={d}
              aria-invalid={!!error}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          )}
        </Field>
        <ColorPicker value={values.color} onChange={(color) => setValues((v) => ({ ...v, color }))} />
        <IconPicker allowNone value={values.icon} onChange={(icon) => setValues((v) => ({ ...v, icon }))} />
        <div>
          <p className="mb-2 text-sm font-medium text-text">Prévia</p>
          <FolderCard
            name={values.name.trim() || 'Nova pasta'}
            color={values.color}
            icon={iconByName(values.icon, Folder)}
            className="max-w-64"
          />
        </div>
      </form>
    </Modal>
  );
}
