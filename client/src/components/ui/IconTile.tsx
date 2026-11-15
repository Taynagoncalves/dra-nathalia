import { iconByName } from '@/config/icons';
import { cn } from '@/lib/cn';
import { readableTextOn } from '@/lib/color';

interface IconTileProps {
  icon: string | null | undefined;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'size-8 rounded-lg [&_svg]:size-4', md: 'size-10 rounded-xl [&_svg]:size-5', lg: 'size-12 rounded-xl [&_svg]:size-6' };

/** Quadrado na cor do usuário com o ícone legível por cima. */
export function IconTile({ icon, color, size = 'md', className }: IconTileProps) {
  const Icon = iconByName(icon);
  return (
    <span
      className={cn('grid shrink-0 place-items-center', sizes[size], className)}
      style={{ backgroundColor: color, color: readableTextOn(color) }}
      aria-hidden
    >
      <Icon />
    </span>
  );
}
