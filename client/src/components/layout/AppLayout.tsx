import { BookOpen, LogOut, Palette, User as UserIcon } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { signOut } from '@/services/firebase/auth';

/**
 * Layout PROVISÓRIO da Parte 1 (topo com tema e sair).
 * Na Parte 2 ele ganha a sidebar completa e o menu do celular.
 */
export function AppLayout() {
  const { profile, user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:bg-primary-soft hover:text-text',
    );

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="mr-2 flex items-center gap-2 font-semibold text-text">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary">
              <BookOpen className="size-4" />
            </span>
            <span className="hidden sm:inline">Estudos</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/perfil" className={linkClass}>
              <UserIcon className="size-4" />
              <span className="hidden sm:inline">Perfil</span>
            </NavLink>
            <NavLink to="/tema-preview" className={linkClass}>
              <Palette className="size-4" />
              <span className="hidden sm:inline">Tema</span>
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden max-w-48 truncate text-sm text-text-muted md:inline">
              {profile?.name || user?.displayName || user?.email}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair" title="Sair">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
