import { useState } from 'react';
import { cn } from '@/lib/cn';
import { avatarUrl } from '@/services/cloudinary/urls';

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  /** tamanho em px */
  size?: number;
  className?: string;
}

const initials = (name?: string | null) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

/** Foto do usuário ou, sem foto, as iniciais na cor principal do tema. */
export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-text',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {showImage ? (
        <img
          src={avatarUrl(src, size * 2)}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
