import { Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { officeViewerUrl } from '@/services/cloudinary/urls';
import type { Material } from '@/types/models';
import { downloadUrl, formatBytes, KIND_META } from './kinds';
import { KindIcon } from './MaterialCard';

/**
 * Visualizador em tela cheia:
 * - imagem → lightbox
 * - PDF → visualizador do navegador (iframe)
 * - Word/PowerPoint → Office Online Viewer + download
 */
export function MaterialViewer({ material, onClose, page }: { material: Material | null; onClose: () => void; page?: number | null }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!material) return;
    setLoaded(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [material, onClose]);

  if (!material?.cloudinary) return null;
  const { url, bytes } = material.cloudinary;
  const download = downloadUrl(material);
  const isImage = material.kind === 'image';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={material.title} className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <KindIcon material={material} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{material.title}</p>
          <p className="text-xs text-text-muted">
            {KIND_META[material.kind].label} · {formatBytes(bytes)}
          </p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
          <Button variant="ghost" size="sm" tabIndex={-1}>
            <ExternalLink className="size-4" /> Nova aba
          </Button>
        </a>
        {download && (
          <a href={download} download={material.cloudinary.originalFilename} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm" tabIndex={-1}>
              <Download className="size-4" /> <span className="hidden sm:inline">Baixar</span>
            </Button>
          </a>
        )}
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" autoFocus>
          <X className="size-5" />
        </Button>
      </header>

      <div className="relative flex-1 overflow-hidden" onClick={isImage ? onClose : undefined}>
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner className="size-8 text-white" />
          </div>
        )}

        {isImage && (
          <img
            src={url}
            alt={material.title}
            onLoad={() => setLoaded(true)}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto h-full max-w-full object-contain p-2 sm:p-6"
          />
        )}

        {material.kind === 'pdf' && (
          <>
            <iframe src={page ? `${url}#page=${page}` : url} title={material.title} onLoad={() => setLoaded(true)} className="size-full bg-white" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:hidden">
              <Alert variant="info" className="pointer-events-auto bg-surface">
                No celular, o PDF pode abrir só a primeira página.{' '}
                <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-text underline">
                  Abrir em nova aba
                </a>
              </Alert>
            </div>
          </>
        )}

        {(material.kind === 'word' || material.kind === 'slides') && (
          <iframe src={officeViewerUrl(url)} title={material.title} onLoad={() => setLoaded(true)} className="size-full bg-white" />
        )}
      </div>
    </div>,
    document.body,
  );
}
