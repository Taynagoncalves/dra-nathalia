import { Router } from 'express';
import { z } from 'zod';
import { env, isCloudinaryConfigured } from '../config/env.js';
import { belongsToUser, cloudinary, userRoot } from '../lib/cloudinary.js';
import { HttpError } from '../middleware/errorHandler.js';

export const cloudinaryRouter = Router();

cloudinaryRouter.use((_req, _res, next) => {
  if (!isCloudinaryConfigured) {
    return next(new HttpError(503, 'Cloudinary não está configurado no servidor.'));
  }
  next();
});

/** IDs do Firestore: só letras, números, _ e -. Impede "../" no caminho da pasta. */
const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'ID inválido');
const resourceType = z.enum(['image', 'raw', 'video']);

const signatureBody = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('material'), subjectId: firestoreId }),
  z.object({ purpose: z.literal('avatar') }),
]);

/**
 * POST /api/cloudinary/signature
 * Devolve a assinatura para o client enviar o arquivo direto ao Cloudinary.
 * Pastas: estudos/{uid}/{subjectId}  |  estudos/{uid}/perfil
 */
cloudinaryRouter.post('/signature', (req, res) => {
  const body = signatureBody.parse(req.body);
  const uid = req.uid!;
  const folder =
    body.purpose === 'material' ? `${userRoot(uid)}${body.subjectId}` : `${userRoot(uid)}perfil`;

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, env.CLOUDINARY_API_SECRET!);

  res.json({
    signature,
    timestamp,
    folder,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    max_bytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  });
});

/**
 * DELETE /api/cloudinary/:publicId?resourceType=image|raw
 * O publicId vem com encodeURIComponent (as barras viram %2F).
 */
cloudinaryRouter.delete('/:publicId', async (req, res) => {
  const publicId = z.string().min(1).parse(req.params.publicId);
  const type = resourceType.default('image').parse(req.query.resourceType);
  if (!belongsToUser(publicId, req.uid!)) {
    throw new HttpError(403, 'Este arquivo não pertence a você.');
  }
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
  res.json({ result: result.result });
});

/**
 * POST /api/cloudinary/delete-batch
 * Usado ao excluir uma pasta com "Excluir tudo".
 */
const batchBody = z.object({
  items: z.array(z.object({ publicId: z.string().min(1), resourceType })).min(1).max(500),
});

cloudinaryRouter.post('/delete-batch', async (req, res) => {
  const { items } = batchBody.parse(req.body);
  const uid = req.uid!;
  if (items.some((i) => !belongsToUser(i.publicId, uid))) {
    throw new HttpError(403, 'Um ou mais arquivos não pertencem a você.');
  }
  const byType = new Map<string, string[]>();
  for (const i of items) byType.set(i.resourceType, [...(byType.get(i.resourceType) ?? []), i.publicId]);

  let deleted = 0;
  for (const [type, ids] of byType) {
    // A Admin API aceita até 100 IDs por chamada.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      await cloudinary.api.delete_resources(chunk, { resource_type: type, invalidate: true });
      deleted += chunk.length;
    }
  }
  res.json({ deleted });
});
