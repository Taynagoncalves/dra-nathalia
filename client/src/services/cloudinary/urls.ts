/** Utilidades de URL do Cloudinary (transformações, miniaturas, visualizadores). */

const isCloudinary = (url: string) => url.includes('res.cloudinary.com') && url.includes('/upload/');

/** Insere uma transformação logo após "/upload/". URLs de outros sites voltam intactas. */
export function transformUrl(url: string, transformation: string): string {
  if (!isCloudinary(url)) return url;
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/** Foto de perfil quadrada, recortada no rosto. */
export function avatarUrl(url: string, px: number): string {
  return transformUrl(url, `c_fill,g_face,w_${px},h_${px},f_auto,q_auto`);
}

/** Miniatura da 1ª página de um PDF (enviado como resource_type image). */
export function pdfThumbnailUrl(url: string, width = 400): string {
  return transformUrl(url, `pg_1,w_${width},c_limit,f_jpg,q_auto`).replace(/\.pdf$/i, '.jpg');
}

/** Prévia de Word/PowerPoint pelo Office Online Viewer (precisa de URL pública). */
export function officeViewerUrl(url: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}
