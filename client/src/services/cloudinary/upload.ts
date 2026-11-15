import { ACCEPTED_FILES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/config/constants';
import type { CloudinaryAsset, CloudinaryResourceType, MaterialKind } from '@/types/models';
import { apiFetch } from '../api';

interface SignatureResponse {
  signature: string;
  timestamp: number;
  folder: string;
  api_key: string;
  cloud_name: string;
  max_bytes: number;
}

export type UploadPurpose = { purpose: 'material'; subjectId: string } | { purpose: 'avatar' };

export const fileExtension = (file: File) => file.name.split('.').pop()?.toLowerCase() ?? '';

/** Tipo do material e resource_type do Cloudinary para um arquivo (null = não aceito). */
export function classifyFile(file: File) {
  return ACCEPTED_FILES[fileExtension(file)] ?? null;
}

/** Valida tipo e tamanho ANTES de enviar. Retorna a mensagem de erro, ou null se estiver ok. */
export function validateFile(file: File): string | null {
  if (!classifyFile(file)) {
    return `"${file.name}": tipo não suportado. Envie PDF, Word, PowerPoint ou imagem.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `"${file.name}" tem ${mb} MB. O limite é ${MAX_UPLOAD_MB} MB por arquivo.`;
  }
  return null;
}

/**
 * Upload assinado: pede a assinatura ao /server e envia o arquivo direto ao Cloudinary.
 * Usa XMLHttpRequest porque o fetch não informa o progresso do envio.
 */
export async function uploadToCloudinary(
  file: File,
  target: UploadPurpose,
  opts: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<CloudinaryAsset & { kind: Exclude<MaterialKind, 'link' | 'note'> }> {
  const info = classifyFile(file);
  const invalid = validateFile(file);
  if (!info || invalid) throw new Error(invalid ?? 'Arquivo inválido.');

  const sig = await apiFetch<SignatureResponse>('/cloudinary/signature', { method: 'POST', json: target });

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const url = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${info.resourceType}/upload`;

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body?.error?.message ?? 'Falha no envio para o Cloudinary.'));
    };
    xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'));
    xhr.onabort = () => reject(new DOMException('Envio cancelado.', 'AbortError'));
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });

  return {
    kind: info.kind,
    publicId: String(result.public_id),
    url: String(result.secure_url),
    resourceType: result.resource_type as CloudinaryResourceType,
    format: (result.format as string | undefined) ?? fileExtension(file),
    bytes: Number(result.bytes),
    originalFilename: file.name,
  };
}

export async function deleteFromCloudinary(publicId: string, resourceType: CloudinaryResourceType) {
  await apiFetch(`/cloudinary/${encodeURIComponent(publicId)}?resourceType=${resourceType}`, {
    method: 'DELETE',
  });
}

export async function deleteManyFromCloudinary(
  items: { publicId: string; resourceType: CloudinaryResourceType }[],
) {
  if (items.length === 0) return;
  await apiFetch('/cloudinary/delete-batch', { method: 'POST', json: { items } });
}
