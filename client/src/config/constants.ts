import type { MaterialKind, ProjectType } from '@/types/models';

/** Chave do tema no localStorage. Mantenha igual ao script do index.html. */
export const THEME_STORAGE_KEY = 'tema';

/** Limite de upload (MB). No plano gratuito do Cloudinary o máximo é 10 MB. */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Tipos aceitos no upload → tipo de material e resource_type do Cloudinary. */
export const ACCEPTED_FILES: Record<
  string,
  { kind: Exclude<MaterialKind, 'link' | 'note'>; resourceType: 'image' | 'raw' }
> = {
  pdf: { kind: 'pdf', resourceType: 'image' }, // image → gera miniatura da 1ª página
  doc: { kind: 'word', resourceType: 'raw' },
  docx: { kind: 'word', resourceType: 'raw' },
  ppt: { kind: 'slides', resourceType: 'raw' },
  pptx: { kind: 'slides', resourceType: 'raw' },
  jpg: { kind: 'image', resourceType: 'image' },
  jpeg: { kind: 'image', resourceType: 'image' },
  png: { kind: 'image', resourceType: 'image' },
  webp: { kind: 'image', resourceType: 'image' },
  gif: { kind: 'image', resourceType: 'image' },
};

/** Valor do atributo `accept` do <input type="file"> */
export const ACCEPT_ATTR = Object.keys(ACCEPTED_FILES)
  .map((ext) => `.${ext}`)
  .join(',');

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  pdf: 'PDF',
  word: 'Word',
  slides: 'Slides',
  image: 'Imagem',
  link: 'Link',
  note: 'Anotação',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  faculdade: 'Faculdade',
  oab: 'OAB',
  concurso: 'Concurso',
  pos: 'Pós-graduação',
  curso: 'Curso',
  pessoal: 'Estudo pessoal',
  outro: 'Outro',
};

/**
 * Paleta pronta para pastas, projetos e matérias.
 * Estas cores NÃO mudam com o tema; o texto sobre elas é escolhido por contraste
 * (veja readableTextOn em lib/color.ts).
 */
export const PRESET_COLORS = [
  { name: 'Violeta', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Vermelho', hex: '#DC2626' },
  { name: 'Laranja', hex: '#F97316' },
  { name: 'Âmbar', hex: '#F59E0B' },
  { name: 'Amarelo', hex: '#EAB308' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Turquesa', hex: '#14B8A6' },
  { name: 'Ciano', hex: '#06B6D4' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Índigo', hex: '#4F46E5' },
  { name: 'Grafite', hex: '#64748B' },
] as const;

export const DEFAULT_DAILY_GOAL_MINUTES = 60;

/** Fuso usado para datas de estudo e streak. */
export const APP_TIMEZONE = 'America/Sao_Paulo';
