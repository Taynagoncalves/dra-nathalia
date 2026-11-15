import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { deleteSubjectFolder } from './cloudinaryCleanup.js';
import { deleteRefs, userCol } from './firestoreAdmin.js';

/** Coleções ligadas à matéria pelo campo subjectId que somem junto com ela. */
const SUBJECT_CASCADE = ['topics', 'folders', 'materials', 'notes', 'questions', 'attempts', 'errors', 'quizzes'];

/**
 * Exclui uma matéria e tudo dela (inclusive os arquivos no Cloudinary).
 * As sessões de estudo ficam: o tempo estudado continua no histórico.
 */
export async function deleteSubjectCascade(db: Firestore, uid: string, subjectId: string) {
  const snaps = await Promise.all(
    SUBJECT_CASCADE.map((c) => userCol(db, uid, c).where('subjectId', '==', subjectId).get()),
  );
  const refs: DocumentReference[] = snaps.flatMap((s) => s.docs.map((d) => d.ref));
  await deleteRefs(db, [...refs, userCol(db, uid, 'subjects').doc(subjectId)]);
  const filesOk = await deleteSubjectFolder(uid, subjectId);
  return { deletedDocs: refs.length + 1, filesOk };
}
