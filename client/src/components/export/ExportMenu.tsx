import { Download, FileText, FileType2, Loader2, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { downloadFile, downloadWord, htmlToMarkdown, printAsPdf, safeFileName } from '@/lib/exporters';
import { friendlyError } from '@/lib/firebaseErrors';

export interface ExportDoc {
  title: string;
  /** HTML do conteúdo (ex.: o do TipTap) */
  html: string;
  meta?: string;
}

/** Botão "Exportar" com Markdown, Word e PDF. `load` pode buscar o conteúdo na hora. */
export function ExportMenu({ load, label = 'Exportar', size = 'md' }: { load: () => Promise<ExportDoc> | ExportDoc; label?: string; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState(false);

  const run = async (kind: 'md' | 'doc' | 'pdf') => {
    setBusy(true);
    try {
      const d = await load();
      const name = safeFileName(d.title);
      if (kind === 'md') downloadFile(`${name}.md`, `# ${d.title}\n\n${d.meta ? `_${d.meta}_\n\n` : ''}${htmlToMarkdown(d.html)}`, 'text/markdown;charset=utf-8');
      if (kind === 'doc') downloadWord(name, d.title, d.html, d.meta);
      if (kind === 'pdf') printAsPdf(d.title, d.html, d.meta);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível exportar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dropdown
      trigger={({ toggle, open }) => (
        <Button variant="secondary" size={size} onClick={toggle} aria-expanded={open} aria-haspopup="menu" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {label}
        </Button>
      )}
    >
      {(close) => (
        <>
          <DropdownItem icon={<FileText className="size-4" />} onSelect={() => (close(), run('md'))}>
            Markdown (.md)
          </DropdownItem>
          <DropdownItem icon={<FileType2 className="size-4" />} onSelect={() => (close(), run('doc'))}>
            Word (.doc)
          </DropdownItem>
          <DropdownItem icon={<Printer className="size-4" />} onSelect={() => (close(), run('pdf'))}>
            PDF (imprimir)
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}

