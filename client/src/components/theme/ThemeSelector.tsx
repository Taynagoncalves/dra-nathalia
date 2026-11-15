import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/cn';
import { THEME_LABELS } from '@/lib/theme';
import type { ThemePreference } from '@/types/models';
import { THEME_ICONS } from './ThemeToggle';

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

/** Seletor Claro / Escuro / Automático (página de Perfil e /tema-preview). */
export function ThemeSelector({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn('inline-flex rounded-xl border border-border bg-surface p-1', className)}
    >
      {ORDER.map((pref) => {
        const Icon = THEME_ICONS[pref];
        const active = preference === pref;
        return (
          <button
            key={pref}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(pref)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:bg-primary-soft hover:text-text',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {THEME_LABELS[pref]}
          </button>
        );
      })}
    </div>
  );
}
