import { isCloudinaryConfigured } from '../config/env.js';
import { belongsToUser, cloudinary } from './cloudinary.js';

export interface AssetRef {
  publicId: string;
  resourceType: string;
}

/**
 * Apaga arquivos do Cloudinary sem derrubar a operação principal:
 * devolve quantos falharam (para avisar o usuário), em vez de lançar erro.
 */
export async function deleteAssets(uid: string, assets: AssetRef[]): Promise<{ deleted: number; failed: number }> {
  const mine = assets.filter((a) => belongsToUser(a.publicId, uid));
  if (!isCloudinaryConfigured || mine.length === 0) return { deleted: 0, failed: mine.length };

  const byType = new Map<string, string[]>();
  for (const a of mine) byType.set(a.resourceType, [...(byType.get(a.resourceType) ?? []), a.publicId]);

  let deleted = 0;
  let failed = 0;
  for (const [type, ids] of byType) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      try {
        await cloudinary.api.delete_resources(chunk, { resource_type: type, invalidate: true });
        deleted += chunk.length;
      } catch (err) {
        console.error('Falha ao apagar no Cloudinary:', err);
        failed += chunk.length;
      }
    }
  }
  return { deleted, failed };
}

/** Apaga tudo que estiver na pasta do Cloudinary de uma matéria (inclui órfãos). */
export async function deleteSubjectFolder(uid: string, subjectId: string): Promise<boolean> {
  if (!isCloudinaryConfigured) return true;
  const prefix = `estudos/${uid}/${subjectId}/`;
  try {
    for (const type of ['image', 'raw', 'video']) {
      await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: type, invalidate: true });
    }
    return true;
  } catch (err) {
    console.error('Falha ao apagar a pasta da matéria no Cloudinary:', err);
    return false;
  }
}
