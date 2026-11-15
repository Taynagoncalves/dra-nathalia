import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PRESET_COLORS } from '@/config/constants';
import { cn } from '@/lib/cn';
import { isValidHex, readableTextOn } from '@/lib/color';
import { Input } from './Field';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

/** 12 cores prontas + cor personalizada (hex ou seletor do sistema). */
export function ColorPicker({ value, onChange, label = 'Cor' }: ColorPickerProps) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);

  const isPreset = PRESET_COLORS.some((c) => c.hex.toLowerCase() === value.toLowerCase());

  const commitHex = (raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    setHex(v);
    if (isValidHex(v)) onChange(v.toUpperCase());
  };

  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1.5 text-sm font-medium text-text">{label}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {PRESET_COLORS.map((c) => {
          const selected = c.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={selected}
              onClick={() => onChange(c.hex)}
              className={cn(
                'grid aspect-square place-items-center rounded-lg transition-transform hover:scale-110',
                selected && 'ring-2 ring-text ring-offset-2 ring-offset-surface-elevated',
              )}
              style={{ backgroundColor: c.hex, color: readableTextOn(c.hex) }}
            >
              {selected && <Check className="size-4" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label
          className={cn(
            'relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border',
            !isPreset && 'ring-2 ring-text ring-offset-2 ring-offset-surface-elevated',
          )}
          style={{ backgroundColor: isValidHex(hex) ? hex : value }}
          title="Escolher cor personalizada"
        >
          <input
            type="color"
            value={isValidHex(value) ? value : '#7C3AED'}
            onChange={(e) => commitHex(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Cor personalizada"
          />
        </label>
        <Input
          value={hex}
          onChange={(e) => commitHex(e.target.value)}
          maxLength={7}
          placeholder="#7C3AED"
          aria-label="Código hex da cor"
          aria-invalid={!isValidHex(hex)}
          className="w-32 font-mono uppercase"
        />
        <span className="text-xs text-text-muted">Personalizada</span>
      </div>
    </fieldset>
  );
}
