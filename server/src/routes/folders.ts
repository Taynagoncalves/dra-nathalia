import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { deleteAssets, type AssetRef } from '../lib/cloudinaryCleanup.js';
import { deleteRefs, inBatches, requireDb, userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const foldersRouter = Router();

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');
const modeSchema = z.enum(['moveUp', 'cascade']);

/**
 * DELETE /api/folders/:folderId?mode=moveUp|cascade
 * - moveUp:  o conteúdo direto (subpastas e materiais) sobe para a pasta de cima
 * - cascade: apaga a pasta, todas as subpastas, os materiais, as anotações e os
 *            arquivos no Cloudinary
 */
foldersRouter.delete('/:folderId', async (req, res) => {
  const uid = req.uid!;
  const folderId = firestoreId.parse(req.params.folderId);
  const mode = modeSchema.parse(req.query.mode);
  const db = requireDb();

  const folders = userCol(db, uid, 'folders');
  const materials = userCol(db, uid, 'materials');
  const folderSnap = await folders.doc(folderId).get();
  if (!folderSnap.exists) throw new HttpError(404, 'Pasta não encontrada.');

  const folder = folderSnap.data() as { subjectId: string; parentId: string | null };
  const parentId = folder.parentId ?? null;

  // Todas as pastas e materiais da matéria (uma leitura só; o filtro é em memória).
  const [allFolders, allMaterials] = await Promise.all([
    folders.where('subjectId', '==', folder.subjectId).get(),
    materials.where('subjectId', '==', folder.subjectId).get(),
  ]);

  if (mode === 'moveUp') {
    const now = FieldValue.serverTimestamp();
    const childFolders = allFolders.docs.filter((d) => d.get('parentId') === folderId);
    const childMaterials = allMaterials.docs.filter((d) => d.get('folderId') === folderId);
    await inBatches(db, [...childFolders, ...childMaterials], (batch, d) => {
      const field = d.ref.parent.id === 'folders' ? 'parentId' : 'folderId';
      batch.update(d.ref, { [field]: parentId, updatedAt: now });
    });
    await folders.doc(folderId).delete();
    return res.json({ movedFolders: childFolders.length, movedMaterials: childMaterials.length });
  }

  // cascade: coleta a pasta e todos os descendentes
  const children = new Map<string, string[]>();
  for (const d of allFolders.docs) {
    const p = (d.get('parentId') as string | null) ?? '';
    children.set(p, [...(children.get(p) ?? []), d.id]);
  }
  const toDelete = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (toDelete.has(id)) continue;
    toDelete.add(id);
    stack.push(...(children.get(id) ?? []));
  }

  const doomedMaterials = allMaterials.docs.filter((d) => toDelete.has(d.get('folderId')));
  const assets: AssetRef[] = doomedMaterials
    .map((d) => d.get('cloudinary') as { publicId?: string; resourceType?: string } | undefined)
    .filter((c): c is { publicId: string; resourceType: string } => !!c?.publicId && !!c.resourceType)
    .map((c) => ({ publicId: c.publicId, resourceType: c.resourceType }));
  const noteRefs = doomedMaterials.filter((d) => d.get('kind') === 'note').map((d) => userCol(db, uid, 'notes').doc(d.id));

  // Primeiro o Firestore (o que o usuário vê), depois os arquivos.
  await deleteRefs(db, [
    ...doomedMaterials.map((d) => d.ref),
    ...noteRefs,
    ...[...toDelete].map((id) => folders.doc(id)),
  ]);
  const files = await deleteAssets(uid, assets);

  res.json({ deletedFolders: toDelete.size, deletedMaterials: doomedMaterials.length, filesFailed: files.failed });
});
