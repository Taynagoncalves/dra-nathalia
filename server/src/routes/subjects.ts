import { Router } from 'express';
import { z } from 'zod';
import { deleteSubjectFolder } from '../lib/cloudinaryCleanup.js';
import { deleteRefs, requireDb, userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const subjectsRouter = Router();

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');

/** Coleções ligadas à matéria pelo campo subjectId que somem junto com ela. */
const CASCADE = ['topics', 'folders', 'materials', 'notes', 'questions', 'attempts', 'errors', 'quizzes'];

/**
 * DELETE /api/subjects/:subjectId
 * Exclui a matéria e tudo dela (inclusive os arquivos no Cloudinary).
 * As sessões de estudo ficam: o tempo estudado continua no histórico.
 */
subjectsRouter.delete('/:subjectId', async (req, res) => {
  const uid = req.uid!;
  const subjectId = firestoreId.parse(req.params.subjectId);
  const db = requireDb();

  const subjectRef = userCol(db, uid, 'subjects').doc(subjectId);
  if (!(await subjectRef.get()).exists) throw new HttpError(404, 'Matéria não encontrada.');

  const snaps = await Promise.all(CASCADE.map((c) => userCol(db, uid, c).where('subjectId', '==', subjectId).get()));
  const refs = snaps.flatMap((s) => s.docs.map((d) => d.ref));

  await deleteRefs(db, [...refs, subjectRef]);
  const filesOk = await deleteSubjectFolder(uid, subjectId);

  res.json({ deletedDocs: refs.length + 1, filesOk });
});
