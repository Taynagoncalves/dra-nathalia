import { v2 as cloudinary } from 'cloudinary';
import { env, isCloudinaryConfigured } from '../config/env.js';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/** Raiz de todos os arquivos de um usuário: estudos/{uid}/ */
export const userRoot = (uid: string) => `estudos/${uid}/`;

/** Garante que o publicId pertence à pasta do usuário (e não tenta escapar dela). */
export function belongsToUser(publicId: string, uid: string): boolean {
  return publicId.startsWith(userRoot(uid)) && !publicId.includes('..');
}
