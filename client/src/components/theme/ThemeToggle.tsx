import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useTheme } from '@/contexts/ThemeContext';
import { THEME_LABELS } from '@/lib/theme';
import type { ThemePreference } from '@/types/models';

export const THEME_ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

/** Botão de sol/lua do topo: abre o menu Claro / Escuro / Automático. */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <Dropdown
      trigger={({ open, toggle }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Tema: ${THEME_LABELS[preference]}. Trocar tema`}
          title="Trocar tema"
        >
          <Icon className="size-5" />
        </Button>
      )}
    >
      {(close) =>
        ORDER.map((pref) => {
          const ItemIcon = THEME_ICONS[pref];
          return (
            <DropdownItem
              key={pref}
              active={preference === pref}
              icon={<ItemIcon className="size-4" />}
              onSelect={() => {
                setPreference(pref);
                close();
              }}
            >
              <span className="flex items-center justify-between">
                {THEME_LABELS[pref]}
                {preference === pref && <Check className="size-4" />}
              </span>
            </DropdownItem>
          );
        })
      }
    </Dropdown>
  );
}
