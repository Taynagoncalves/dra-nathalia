import { ICONS } from '@/config/icons';
import { cn } from '@/lib/cn';

interface IconPickerProps {
  value: string | null;
  onChange: (name: string | null) => void;
  /** permite "sem ícone" (pastas) */
  allowNone?: boolean;
  label?: string;
}

export function IconPicker({ value, onChange, allowNone, label = 'Ícone' }: IconPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-text">{label}</legend>
      <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-11">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={cn(
              'grid aspect-square place-items-center rounded-lg border text-[10px] text-text-muted',
              value === null ? 'border-primary bg-primary-soft text-primary-text' : 'border-border hover:bg-primary-soft',
            )}
          >
            Nenhum
          </button>
        )}
        {Object.entries(ICONS).map(([name, Icon]) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={value === name}
            onClick={() => onChange(name)}
            className={cn(
              'grid aspect-square place-items-center rounded-lg border transition-colors',
              value === name
                ? 'border-primary bg-primary-soft text-primary-text'
                : 'border-transparent text-text-muted hover:bg-primary-soft hover:text-text',
            )}
          >
            <Icon className="size-4.5" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
