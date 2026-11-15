import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { MOBILE_BAR_NAV } from './navItems';

const tabClass = (active: boolean) =>
  cn(
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
    active ? 'text-primary-text' : 'text-text-muted hover:text-text',
  );

/** Menu inferior do celular: 4 atalhos + "Mais", que abre o drawer. */
export function MobileTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {MOBILE_BAR_NAV.map(({ to, label, short, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => tabClass(isActive)}>
          {({ isActive }) => (
            <>
              <span className={cn('rounded-full px-4 py-1 transition-colors', isActive && 'bg-primary-soft')}>
                <Icon className="size-5" aria-hidden />
              </span>
              {short ?? label}
            </>
          )}
        </NavLink>
      ))}
      <button type="button" onClick={onOpenMenu} className={tabClass(false)}>
        <span className="px-4 py-1">
          <Menu className="size-5" aria-hidden />
        </span>
        Mais
      </button>
    </nav>
  );
}
