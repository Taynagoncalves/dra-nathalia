import { useQueryClient } from '@tanstack/react-query';
import { FileText, FileUp, PenLine, Sparkles, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { Tabs } from '@/components/ui/Tabs';
import { materialKeys, useMaterials } from '@/hooks/useMaterials';
import { useUid } from '@/hooks/useUid';
import { friendlyError } from '@/lib/firebaseErrors';
import { fileExtension, uploadToCloudinary, validateFile } from '@/services/cloudinary/upload';
import { createFileMaterial } from '@/services/firebase/materials';
import { importQuestions } from '@/services/questionsAi';

type Source = 'pdf' | 'texto';

/**
 * Importar questões de uma prova: PDF oficial da banca (enviado agora ou já nos
 * materiais) ou texto escrito pela própria pessoa. Do QConcursos e de outras
 * plataformas guardamos só o link — regra do projeto.
 */
export function ImportQuestionsModal({ open, onClose, defaultSubjectId }: { open: boolean; onClose: () => void; defaultSubjectId?: string }) {
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? '');
  const [source, setSource] = useState<Source>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [materialId, setMaterialId] = useState('');
  const [text, setText] = useState('');
  const [keyMaterialId, setKeyMaterialId] = useState('');
  const [keyText, setKeyText] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const materials = useMaterials(subjectId);
  const pdfs = (materials.data ?? []).filter((m) => m.kind === 'pdf' || m.kind === 'word');

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!['pdf', 'docx'].includes(fileExtension(f))) return toast.error('Envie o PDF da prova (ou um .docx).');
    const invalid = validateFile(f);
    if (invalid) return toast.error(invalid);
    setFile(f);
    setMaterialId('');
  };

  const submit = async () => {
    try {
      let mid = materialId;
      if (source === 'pdf' && file) {
        setBusy('Enviando a prova…');
        setProgress(0);
        const asset = await uploadToCloudinary(file, { purpose: 'material', subjectId }, { onProgress: setProgress });
        mid = await createFileMaterial(uid, subjectId, null, asset);
        qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
        setProgress(null);
      }
      setBusy('Começando…');
      const r = await importQuestions({
        subjectId,
        ...(source === 'pdf' ? { materialId: mid } : { text: text.trim() }),
        ...(keyMaterialId ? { answerKeyMaterialId: keyMaterialId } : keyText.trim() ? { answerKeyText: keyText.trim() } : {}),
      });
      qc.invalidateQueries({ queryKey: ['questionImports', uid] });
      onClose();
      navigate(`/questoes/importar/${r.id}`);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível começar a importação.'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const ready = !!subjectId && (source === 'pdf' ? !!(file || materialId) : text.trim().length >= 40);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Importar questões de uma prova"
      description="A IA separa enunciado, alternativas, gabarito, banca, ano e órgão. Você revisa antes de salvar."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!ready} loading={!!busy}>
            <Sparkles className="size-4" /> {busy ?? 'Importar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Matéria" hint="As questões vão para esta matéria (dá para mudar o assunto de cada uma depois).">
          {(id, d) => <SubjectSelect id={id} aria-describedby={d} value={subjectId} emptyLabel="Escolha…" onChange={(v) => (setSubjectId(v), setMaterialId(''), setKeyMaterialId(''))} />}
        </Field>

        <Tabs<Source>
          value={source}
          onChange={setSource}
          items={[
            { value: 'pdf', label: 'PDF da prova', icon: FileUp },
            { value: 'texto', label: 'Texto meu', icon: PenLine },
          ]}
        />

        {source === 'pdf' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files[0]);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <Upload className="size-6 text-primary-text" aria-hidden />
              <span className="text-sm font-medium text-text">{file ? file.name : 'Enviar o PDF da prova'}</span>
              <span className="text-xs text-text-muted">Baixe a prova no site da banca (FGV, Cebraspe, FCC…) e envie aqui</span>
            </button>
            <input ref={input} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {progress !== null && <ProgressBar value={progress} label="Envio da prova" />}
            {subjectId && pdfs.length > 0 && (
              <Field label="…ou use um PDF que já está nos materiais">
                {(id) => (
                  <Select id={id} value={materialId} onChange={(e) => (setMaterialId(e.target.value), setFile(null))}>
                    <option value="">Escolha…</option>
                    {pdfs.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
        ) : (
          <Field label="Questões" hint="Questões que você mesma escreveu ou digitou. Numere cada uma e marque o gabarito, se tiver.">
            {(id, d) => <Textarea id={id} aria-describedby={d} rows={8} value={text} maxLength={80000} onChange={(e) => setText(e.target.value)} placeholder={'1. Enunciado…\nA) …\nB) …\n\nGabarito: 1-B'} />}
          </Field>
        )}

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-text">
            <FileText className="mr-1 inline size-4 text-primary-text" /> Gabarito separado (opcional)
          </summary>
          <p className="mt-2 text-xs text-text-muted">Se o gabarito estiver no fim do próprio PDF, não precisa. Se for outro arquivo (gabarito oficial/definitivo), escolha aqui ou cole.</p>
          <div className="mt-2 space-y-2">
            {subjectId && pdfs.length > 0 && (
              <Select value={keyMaterialId} onChange={(e) => setKeyMaterialId(e.target.value)} aria-label="Gabarito dos materiais">
                <option value="">PDF do gabarito (dos materiais)…</option>
                {pdfs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            )}
            <Textarea rows={2} value={keyText} onChange={(e) => setKeyText(e.target.value)} placeholder="Ou cole: 1-A 2-C 3-E … (ou 1-C 2-E para certo/errado)" aria-label="Gabarito colado" disabled={!!keyMaterialId} />
          </div>
        </details>

        <Alert variant="info">
          Do QConcursos e de outras plataformas, o banco guarda só o <strong>link</strong> da questão (no cadastro manual). Para importar em lote, use a prova oficial em PDF, que as bancas publicam.
        </Alert>
      </div>
    </Modal>
  );
}
