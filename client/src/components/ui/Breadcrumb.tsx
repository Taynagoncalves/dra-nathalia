import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

/** Projetos › OAB › Direito Civil */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Você está em" className="mb-3 flex min-w-0 flex-wrap items-center gap-1 text-sm text-text-muted">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {last ? (
              <span aria-current="page" className="truncate font-medium text-text">
                {c.label}
              </span>
            ) : c.to ? (
              <Link to={c.to} className="truncate hover:text-primary-text hover:underline">
                {c.label}
              </Link>
            ) : (
              <button type="button" onClick={c.onClick} className="truncate hover:text-primary-text hover:underline">
                {c.label}
              </button>
            )}
            {!last && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
          </Fragment>
        );
      })}
    </nav>
  );
}
