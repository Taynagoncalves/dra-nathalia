import { Moon, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { DEFAULT_ACCENT, type AccentMode } from '@/lib/accent';
import { cn } from '@/lib/cn';

const LABELS: Record<AccentMode, { title: string; icon: typeof Sun; standard: string }> = {
  light: { title: 'Cor no modo claro', icon: Sun, standard: 'roxo' },
  dark: { title: 'Cor no modo escuro', icon: Moon, standard: 'rosa' },
};

/**
 * Escolha da cor principal de cada modo (botões, links, item ativo, gráficos).
 * A prévia de cada coluna é forçada no modo correspondente, então dá para ver
 * as duas cores ao mesmo tempo.
 */
export function AccentPicker() {
  const { accent, setAccent } = useTheme();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(['light', 'dark'] as AccentMode[]).map((mode) => {
        const { title, icon: Icon, standard } = LABELS[mode];
        const value = accent[mode] ?? DEFAULT_ACCENT[mode];
        const custom = accent[mode] !== null;
        return (
          <div key={mode} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-text">
                <Icon className="size-4" /> {title}
              </p>
              {custom && (
                <Button variant="ghost" size="sm" onClick={() => setAccent(mode, null)}>
                  <RotateCcw className="size-3.5" /> Padrão ({standard})
                </Button>
              )}
            </div>

            {/* Prévia no próprio modo */}
            <div className={cn(mode, 'rounded-xl border border-border bg-bg p-3')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-on-primary">Botão</span>
                <span className="inline-flex h-8 items-center rounded-lg bg-primary-soft px-3 text-sm font-medium text-primary-text">Item ativo</span>
                <span className="text-sm font-medium text-primary-text underline">Link</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-text">Selo</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-soft">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
            </div>

            <ColorPicker label="Escolha a cor" value={value} onChange={(hex) => setAccent(mode, hex)} />
          </div>
        );
      })}
    </div>
  );
}
