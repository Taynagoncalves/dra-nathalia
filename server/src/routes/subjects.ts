import { Router } from 'express';
import { z } from 'zod';
import { deleteSubjectCascade } from '../lib/cascade.js';
import { requireDb, userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const subjectsRouter = Router();

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');

/** DELETE /api/subjects/:subjectId — exclui a matéria e tudo dela. */
subjectsRouter.delete('/:subjectId', async (req, res) => {
  const uid = req.uid!;
  const subjectId = firestoreId.parse(req.params.subjectId);
  const db = requireDb();

  if (!(await userCol(db, uid, 'subjects').doc(subjectId).get()).exists) {
    throw new HttpError(404, 'Matéria não encontrada.');
  }
  res.json(await deleteSubjectCascade(db, uid, subjectId));
});
