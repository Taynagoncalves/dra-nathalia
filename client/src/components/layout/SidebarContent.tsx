import { BookOpen } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { SoonBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { MAIN_NAV, SOON_NAV } from './navItems';

const itemClass = (active: boolean) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:bg-primary-soft hover:text-text',
  );

/** Conteúdo da navegação, usado na sidebar (desktop) e no drawer (celular). */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-2.5 px-5 font-semibold text-text">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary">
          <BookOpen className="size-4" />
        </span>
        Estudos
      </Link>

      <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {MAIN_NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div>
          <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-text-muted uppercase">Próximas etapas</p>
          <ul className="space-y-0.5">
            {SOON_NAV.map(({ slug, label, icon: Icon }) => (
              <li key={slug}>
                <NavLink
                  to={`/em-breve/${slug}`}
                  onClick={onNavigate}
                  className={({ isActive }) => itemClass(isActive)}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{label}</span>
                  <SoonBadge />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
