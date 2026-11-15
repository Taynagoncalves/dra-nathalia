import { Router } from 'express';
import { z } from 'zod';
import { deleteSubjectCascade } from '../lib/cascade.js';
import { deleteRefs, requireDb, userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export const projectsRouter = Router();

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');

/**
 * DELETE /api/projects/:projectId
 * Exclui o projeto, todas as matérias dele (com assuntos, pastas, materiais,
 * arquivos no Cloudinary, anotações, questões e erros) e as metas do projeto.
 */
projectsRouter.delete('/:projectId', async (req, res) => {
  const uid = req.uid!;
  const projectId = firestoreId.parse(req.params.projectId);
  const db = requireDb();

  const projectRef = userCol(db, uid, 'projects').doc(projectId);
  if (!(await projectRef.get()).exists) throw new HttpError(404, 'Projeto não encontrado.');

  const subjects = await userCol(db, uid, 'subjects').where('projectId', '==', projectId).get();
  let filesOk = true;
  for (const s of subjects.docs) {
    const r = await deleteSubjectCascade(db, uid, s.id);
    filesOk &&= r.filesOk;
  }

  const goals = await userCol(db, uid, 'goals').where('projectId', '==', projectId).get();
  await deleteRefs(db, [...goals.docs.map((d) => d.ref), projectRef]);

  res.json({ deletedSubjects: subjects.size, filesOk });
});
