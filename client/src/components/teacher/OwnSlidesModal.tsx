import { useQueryClient } from '@tanstack/react-query';
import { FileText, FileUp, Presentation, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { Tabs } from '@/components/ui/Tabs';
import { materialKeys, useMaterials } from '@/hooks/useMaterials';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { fileExtension, uploadToCloudinary, validateFile } from '@/services/cloudinary/upload';
import { createFileMaterial } from '@/services/firebase/materials';
import { createDeckFromOwnSlides } from '@/services/teacher';

type Source = 'arquivo' | 'materiais';
const ACCEPT = ['pdf', 'pptx'];

/**
 * "Usar meus slides": envia um PDF/PowerPoint (ou escolhe um dos materiais da
 * matéria) e cria a apresentação para ensaiar em todos os modos.
 */
export function OwnSlidesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState('');
  const [source, setSource] = useState<Source>('arquivo');
  const [file, setFile] = useState<File | null>(null);
  const [materialId, setMaterialId] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const materials = useMaterials(subjectId);
  const decks = (materials.data ?? []).filter((m) => m.kind === 'pdf' || m.kind === 'slides');

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.includes(fileExtension(f))) return toast.error('Envie um PDF ou um PowerPoint (.pptx). Arquivos .ppt antigos: salve como .pptx ou PDF.');
    const invalid = validateFile(f);
    if (invalid) return toast.error(invalid);
    setFile(f);
  };

  const submit = async () => {
    try {
      let id = materialId;
      if (source === 'arquivo') {
        if (!file) return;
        setBusy('Enviando o arquivo…');
        setProgress(0);
        const asset = await uploadToCloudinary(file, { purpose: 'material', subjectId }, { onProgress: setProgress });
        id = await createFileMaterial(uid, subjectId, null, asset);
        qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
      }
      setBusy('Lendo os slides…');
      setProgress(null);
      const r = await createDeckFromOwnSlides(id);
      qc.invalidateQueries({ queryKey: ['decks', uid] });
      qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
      toast.success(r.ai ? 'Slides prontos! A IA está escrevendo o roteiro de cada um.' : 'Slides prontos!');
      onClose();
      navigate(`/professora/${r.id}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível usar estes slides.'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const ready = !!subjectId && (source === 'arquivo' ? !!file : !!materialId);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Usar meus slides"
      description="Ensaie a sua própria apresentação: a IA confere a sua fala e faz perguntas sobre os seus slides."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!ready} loading={!!busy}>
            <Presentation className="size-4" /> {busy ?? 'Criar apresentação'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Matéria" hint="O arquivo também fica salvo nos materiais desta matéria.">
          {(id, d) => <SubjectSelect id={id} aria-describedby={d} value={subjectId} emptyLabel="Escolha…" onChange={(v) => (setSubjectId(v), setMaterialId(''))} />}
        </Field>

        <Tabs<Source>
          value={source}
          onChange={setSource}
          items={[
            { value: 'arquivo', label: 'Enviar arquivo', icon: FileUp },
            { value: 'materiais', label: 'Dos meus materiais', icon: FileText },
          ]}
        />

        {source === 'arquivo' ? (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files[0]);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <Upload className="size-6 text-primary-text" aria-hidden />
              <span className="text-sm font-medium text-text">{file ? file.name : 'Escolha ou arraste o arquivo dos slides'}</span>
              <span className="text-xs text-text-muted">PDF ou PowerPoint (.pptx)</span>
            </button>
            <input ref={input} type="file" accept=".pdf,.pptx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {progress !== null && <ProgressBar value={progress} label="Envio do arquivo" />}
          </>
        ) : !subjectId ? (
          <p className="text-sm text-text-muted">Escolha a matéria para ver os PDFs e PowerPoints dela.</p>
        ) : materials.isLoading ? (
          <p className="text-sm text-text-muted">Carregando os materiais…</p>
        ) : !decks.length ? (
          <p className="text-sm text-text-muted">Esta matéria não tem PDFs nem PowerPoints. Use “Enviar arquivo”.</p>
        ) : (
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {decks.map((m) => (
              <li key={m.id}>
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm', materialId === m.id ? 'border-primary bg-primary-soft' : 'border-border')}>
                  <input type="radio" name="material" checked={materialId === m.id} onChange={() => setMaterialId(m.id)} className="accent-(--primary)" />
                  <span className="flex-1 truncate text-text">{m.title}</span>
                  <span className="text-xs text-text-muted uppercase">{m.kind === 'pdf' ? 'PDF' : 'PPTX'}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <Alert variant="info">
          No <strong>PDF</strong>, os slides aparecem com o visual original. No PowerPoint aparece só o texto: para manter o visual, salve como PDF no PowerPoint
          (Arquivo → Salvar como → PDF).
        </Alert>
      </div>
    </Modal>
  );
}
