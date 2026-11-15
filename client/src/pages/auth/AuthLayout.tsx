import { BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      {/* brilho suave na cor principal do tema */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-primary-soft to-transparent"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-on-primary shadow-card">
            <BookOpen className="size-6" />
          </span>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
      </div>
    </div>
  );
}
