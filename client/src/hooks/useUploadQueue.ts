import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import { uploadToCloudinary, validateFile } from '@/services/cloudinary/upload';
import { processMaterialForAi } from '@/services/ai';
import { createFileMaterial } from '@/services/firebase/materials';
import { materialKeys } from './useMaterials';
import { useUid } from './useUid';

export type UploadStatus = 'na_fila' | 'enviando' | 'concluido' | 'erro' | 'cancelado';

export interface UploadItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  status: UploadStatus;
  error?: string;
}

const CONCURRENCY = 3;

/**
 * Fila de upload: valida cada arquivo, envia até 3 ao mesmo tempo para o
 * Cloudinary (com progresso) e salva os metadados no Firestore.
 */
export function useUploadQueue(subjectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const queue = useRef<UploadItem[]>([]);
  const active = useRef(0);

  const patch = useCallback((id: string, data: Partial<UploadItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }, []);

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const item = queue.current.shift()!;
      const controller = controllers.current.get(item.id);
      if (!controller || controller.signal.aborted) continue;
      active.current += 1;
      patch(item.id, { status: 'enviando' });

      uploadToCloudinary(
        item.file,
        { purpose: 'material', subjectId },
        { signal: controller.signal, onProgress: (progress) => patch(item.id, { progress }) },
      )
        .then((asset) => createFileMaterial(uid, subjectId, item.folderId, asset))
        .then((materialId) => {
          patch(item.id, { status: 'concluido', progress: 100 });
          qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) });
          // Extrai o texto para a IA em segundo plano (status: Processando… → Pronto para IA)
          processMaterialForAi(materialId)
            .catch(() => {})
            .finally(() => qc.invalidateQueries({ queryKey: materialKeys.materials(uid, subjectId) }));
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === 'AbortError') patch(item.id, { status: 'cancelado' });
          else patch(item.id, { status: 'erro', error: friendlyError(err, 'Falha no envio.') });
        })
        .finally(() => {
          active.current -= 1;
          controllers.current.delete(item.id);
          pump();
        });
    }
  }, [patch, qc, subjectId, uid]);

  /** Adiciona arquivos à fila. Os inválidos (tipo/tamanho) são recusados com aviso. */
  const enqueue = useCallback(
    (files: FileList | File[], folderId: string | null) => {
      const accepted: UploadItem[] = [];
      for (const file of Array.from(files)) {
        const invalid = validateFile(file);
        if (invalid) {
          toast.error(invalid);
          continue;
        }
        const item: UploadItem = { id: crypto.randomUUID(), file, folderId, progress: 0, status: 'na_fila' };
        controllers.current.set(item.id, new AbortController());
        accepted.push(item);
      }
      if (!accepted.length) return;
      setItems((list) => [...list, ...accepted]);
      queue.current.push(...accepted);
      pump();
    },
    [pump],
  );

  const cancel = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      queue.current = queue.current.filter((i) => i.id !== id);
      patch(id, { status: 'cancelado' });
    },
    [patch],
  );

  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      controllers.current.set(id, new AbortController());
      patch(id, { status: 'na_fila', progress: 0, error: undefined });
      queue.current.push(item);
      pump();
    },
    [items, patch, pump],
  );

  /** Tira da lista o que já terminou (concluído, cancelado ou com erro). */
  const clearFinished = useCallback(() => {
    setItems((list) => list.filter((i) => i.status === 'na_fila' || i.status === 'enviando'));
  }, []);

  const busy = items.some((i) => i.status === 'na_fila' || i.status === 'enviando');

  return { items, enqueue, cancel, retry, clearFinished, busy };
}
