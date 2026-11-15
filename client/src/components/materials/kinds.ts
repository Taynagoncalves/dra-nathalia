import { FileText, Image, Link2, NotebookPen, Presentation, FileType2, type LucideIcon } from 'lucide-react';
import { pdfThumbnailUrl, transformUrl } from '@/services/cloudinary/urls';
import type { Material, MaterialKind } from '@/types/models';

/** Ícone e cor fixa (igual nos dois temas) de cada tipo de material. */
export const KIND_META: Record<MaterialKind, { icon: LucideIcon; color: string; label: string }> = {
  pdf: { icon: FileText, color: '#DC2626', label: 'PDF' },
  word: { icon: FileType2, color: '#2563EB', label: 'Word' },
  slides: { icon: Presentation, color: '#EA580C', label: 'Slides' },
  image: { icon: Image, color: '#059669', label: 'Imagem' },
  link: { icon: Link2, color: '#0284C7', label: 'Link' },
  note: { icon: NotebookPen, color: '#7C3AED', label: 'Anotação' },
};

export const KIND_ORDER: MaterialKind[] = ['pdf', 'word', 'slides', 'image', 'link', 'note'];

/** Miniatura para o card (imagens e 1ª página do PDF); null = mostra o ícone. */
export function thumbnailOf(m: Material): string | null {
  if (!m.cloudinary) return null;
  if (m.kind === 'image') return transformUrl(m.cloudinary.url, 'c_fill,w_480,h_300,f_auto,q_auto');
  if (m.kind === 'pdf') return pdfThumbnailUrl(m.cloudinary.url, 480);
  return null;
}

/** Ícone do site (favicon) para links externos. */
export function faviconOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Link de download (o Cloudinary força "baixar" com fl_attachment em imagens/PDF). */
export function downloadUrl(m: Material): string | null {
  if (!m.cloudinary) return null;
  if (m.cloudinary.resourceType === 'image') return transformUrl(m.cloudinary.url, 'fl_attachment');
  return m.cloudinary.url;
}
