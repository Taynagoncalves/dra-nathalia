import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge precisa conhecer as cores semânticas para não confundi-las com tamanhos. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'bg', 'surface', 'surface-elevated', 'border', 'primary', 'primary-hover', 'primary-soft',
        'primary-text', 'on-primary', 'text', 'text-muted', 'success', 'error', 'warning', 'info', 'ring',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
