import { BookOpen, Menu } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { StudyTimerWidget } from '@/components/timer/StudyTimerWidget';
import { Button } from '@/components/ui/Button';
import { MobileDrawer } from './MobileDrawer';
import { MobileTabBar } from './MobileTabBar';
import { SidebarContent } from './SidebarContent';
import { useLocalReminders } from '@/hooks/useNotifications';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

/**
 * Estrutura do app:
 * - desktop (≥ md): sidebar fixa à esquerda + topo
 * - celular: topo + menu inferior; o botão "Mais" (ou ☰) abre o drawer
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const { pathname } = useLocation();
  useLocalReminders();

  // Ao trocar de página: fecha o drawer e volta ao topo.
  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface md:block">
        <SidebarContent />
      </aside>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
          <div className="flex h-16 items-center gap-1 px-3 sm:gap-2 sm:px-4 md:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2 font-semibold text-text md:hidden">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-on-primary">
                <BookOpen className="size-3.5" />
              </span>
              <span className="hidden min-[420px]:inline">Estudos</span>
            </Link>

            <div className="flex flex-1 justify-end">
              <StudyTimerWidget />
            </div>

            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">
          <Outlet />
        </main>
      </div>

      <MobileTabBar onOpenMenu={() => setDrawerOpen(true)} />
    </div>
  );
}
