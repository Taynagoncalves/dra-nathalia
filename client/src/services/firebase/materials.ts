import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { CloudinaryAsset, Material, MaterialKind, Note } from '@/types/models';
import { deleteFromCloudinary } from '../cloudinary/upload';
import { getDb } from './app';
import { docsWithId, docWithId, userCol, userDoc } from './db';

/** Todos os materiais da matéria (filtros, busca e pastas são resolvidos no client). */
export async function listMaterials(uid: string, subjectId: string): Promise<Material[]> {
  const snap = await getDocs(query(userCol(uid, 'materials'), where('subjectId', '==', subjectId), orderBy('createdAt', 'desc')));
  return docsWithId<Material>(snap);
}

const base = (subjectId: string, folderId: string | null) => ({
  subjectId,
  folderId,
  topicId: null,
  tags: [] as string[],
  favorite: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/** Remove a extensão: "Apostila Civil.pdf" → "Apostila Civil" */
const titleFromFilename = (name: string) => name.replace(/\.[^.]+$/, '').trim() || name;

export async function createFileMaterial(
  uid: string,
  subjectId: string,
  folderId: string | null,
  asset: CloudinaryAsset & { kind: Exclude<MaterialKind, 'link' | 'note'> },
) {
  const { kind, ...cloudinary } = asset;
  const ref = await addDoc(userCol(uid, 'materials'), {
    ...base(subjectId, folderId),
    kind,
    title: titleFromFilename(asset.originalFilename),
    cloudinary,
    aiStatus: 'pendente', // Etapa 2: extração de texto para a IA
  });
  return ref.id;
}

export async function createLinkMaterial(
  uid: string,
  subjectId: string,
  folderId: string | null,
  data: { title: string; linkUrl: string; description?: string },
) {
  const ref = await addDoc(userCol(uid, 'materials'), {
    ...base(subjectId, folderId),
    kind: 'link',
    title: data.title,
    linkUrl: data.linkUrl,
    description: data.description ?? '',
  });
  return ref.id;
}

/** Anotação = material (kind 'note') + conteúdo em notes/{mesmo id}. */
export async function createNoteMaterial(uid: string, subjectId: string, folderId: string | null, title: string) {
  const ref = doc(userCol(uid, 'materials'));
  const batch = writeBatch(getDb());
  batch.set(ref, { ...base(subjectId, folderId), kind: 'note', title });
  batch.set(userDoc(uid, 'notes', ref.id), { subjectId, content: '', updatedAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export type MaterialPatch = Partial<Pick<Material, 'title' | 'description' | 'tags' | 'favorite' | 'folderId' | 'topicId' | 'linkUrl'>>;

export async function updateMaterial(uid: string, id: string, data: MaterialPatch) {
  await updateDoc(userDoc(uid, 'materials', id), { ...data, updatedAt: serverTimestamp() });
}

export async function getMaterial(uid: string, id: string): Promise<Material | null> {
  return docWithId<Material>(await getDoc(userDoc(uid, 'materials', id)));
}

export async function getNote(uid: string, id: string): Promise<Note | null> {
  return docWithId<Note>(await getDoc(userDoc(uid, 'notes', id)));
}

export async function saveNote(uid: string, id: string, subjectId: string, content: string) {
  const batch = writeBatch(getDb());
  batch.set(userDoc(uid, 'notes', id), { subjectId, content, updatedAt: serverTimestamp() }, { merge: true });
  batch.update(userDoc(uid, 'materials', id), { updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Exclui o material; se tiver arquivo, apaga no Cloudinary; se for anotação, apaga o conteúdo. */
export async function deleteMaterial(uid: string, material: Material) {
  await deleteDoc(userDoc(uid, 'materials', material.id));
  if (material.kind === 'note') await deleteDoc(userDoc(uid, 'notes', material.id)).catch(() => {});
  if (material.cloudinary) {
    // Se falhar, o documento já saiu; o arquivo fica órfão mas some ao excluir a matéria.
    await deleteFromCloudinary(material.cloudinary.publicId, material.cloudinary.resourceType).catch(() => {});
  }
}


