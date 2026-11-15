import type { Timestamp } from 'firebase/firestore';

/**
 * Modelo de dados do Firestore. Tudo fica em users/{uid}/…
 * Subcoleções planas, com campos de referência (projectId, subjectId, folderId).
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserSettings {
  theme: ThemePreference;
  dailyGoalMinutes: number;
  /** cor principal personalizada no modo claro (null = padrão roxo) */
  accentLight?: string | null;
  /** cor principal personalizada no modo escuro (null = padrão rosa) */
  accentDark?: string | null;
  /** lembretes de eventos do calendário (padrão: ligado) */
  notifyEvents?: boolean;
  /** aviso de sequência em risco às 19h (padrão: ligado) */
  notifyStreak?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  photoURL: string | null;
  /** publicId da foto no Cloudinary, para poder trocá-la/excluí-la */
  photoPublicId?: string | null;
  createdAt: Timestamp;
  xp: number;
  level: number;
  streak: number;
  /** 'AAAA-MM-DD' no fuso de São Paulo */
  lastStudyDate: string | null;
  settings: UserSettings;
}

/** Campos comuns: id do documento é sempre incluído na leitura. */
export interface WithId {
  id: string;
}

export type ProjectType = 'faculdade' | 'oab' | 'concurso' | 'pos' | 'curso' | 'pessoal' | 'outro';

export interface Project extends WithId {
  name: string;
  type: ProjectType;
  color: string;
  icon: string;
  order: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Subject extends WithId {
  projectId: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TopicStatus = 'nao_iniciado' | 'estudando' | 'concluido';

export interface Topic extends WithId {
  subjectId: string;
  name: string;
  order: number;
  /** usado no progresso do projeto (% de assuntos concluídos) */
  status: TopicStatus;
}

export interface Folder extends WithId {
  subjectId: string;
  /** null = raiz da matéria */
  parentId: string | null;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MaterialKind = 'pdf' | 'word' | 'slides' | 'image' | 'link' | 'note';
export type CloudinaryResourceType = 'image' | 'raw' | 'video';

export interface CloudinaryAsset {
  publicId: string;
  url: string;
  resourceType: CloudinaryResourceType;
  format: string | null;
  bytes: number;
  originalFilename: string;
}

/** Etapa 2: status do processamento de texto para a IA */
export type AiStatus = 'pendente' | 'processando' | 'pronto' | 'erro';

export interface Material extends WithId {
  subjectId: string;
  /** null = raiz da matéria */
  folderId: string | null;
  topicId?: string | null;
  kind: MaterialKind;
  title: string;
  description?: string;
  tags: string[];
  favorite: boolean;
  cloudinary?: CloudinaryAsset;
  linkUrl?: string;
  /** Etapa 2 */
  aiStatus?: AiStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Conteúdo de uma anotação. Mesmo ID do material (kind 'note'). */
export interface Note extends WithId {
  subjectId: string;
  /** HTML gerado pelo TipTap */
  content: string;
  updatedAt: Timestamp;
}

export type QuestionType = 'multipla' | 'certo_errado' | 'discursiva';
export type QuestionSource = 'propria' | 'material' | 'externa' | 'ia';
export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface Question extends WithId {
  subjectId: string;
  topicId?: string | null;
  statement: string;
  type: QuestionType;
  options: string[];
  /** índice da alternativa (multipla), 'certo'|'errado' ou texto-modelo (discursiva) */
  correctAnswer: string;
  explanation: string;
  source: QuestionSource;
  externalUrl?: string;
  difficulty: Difficulty;
  createdAt: Timestamp;
}

export interface Attempt extends WithId {
  questionId: string;
  subjectId: string;
  topicId?: string | null;
  quizId?: string | null;
  answer: string;
  isCorrect: boolean;
  timeSpentSec: number;
  createdAt: Timestamp;
}

export const ERROR_CATEGORIES = [
  'Não conhecia o conteúdo',
  'Esqueceu a informação',
  'Confundiu conceitos',
  'Interpretou a questão incorretamente',
  'Não conhecia a legislação',
  'Errou por desatenção',
  'Não conseguiu identificar a solução jurídica',
  'Utilizou fundamento inadequado',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export interface ErrorEntry extends WithId {
  questionId?: string | null;
  simulationId?: string | null;
  subjectId: string;
  topicId?: string | null;
  category: ErrorCategory;
  note: string;
  resolved: boolean;
  createdAt: Timestamp;
}

export interface StudySession extends WithId {
  subjectId: string;
  activity: string;
  minutes: number;
  /** 'AAAA-MM-DD' */
  date: string;
  createdAt: Timestamp;
}

export interface Goal extends WithId {
  period: 'diaria' | 'semanal';
  metric: 'minutos' | 'questoes';
  target: number;
  projectId?: string | null;
}

export type EventType = 'estudo' | 'revisao' | 'prova' | 'outro';

export interface CalendarEvent extends WithId {
  title: string;
  /** 'AAAA-MM-DD' */
  date: string;
  /** 'HH:mm' (opcional; sem horário = o dia todo) */
  time?: string | null;
  subjectId?: string | null;
  type: EventType;
  done: boolean;
  notes?: string;
  /** etapas de lembrete já enviadas pelo server ('7', '3', '1', '0') */
  reminders?: Record<string, boolean>;
}

/* ── Etapa 2 (reservado) ─────────────────────────────────────────── */

export interface Quiz extends WithId {
  title: string;
  subjectId: string;
  topicId?: string | null;
  sourceMaterialIds: string[];
  sourceFolderId?: string | null;
  config: {
    count: number;
    types: string[];
    difficulty: string;
    mode: 'treino' | 'prova' | 'relampago';
    timerSec?: number;
  };
  questionIds: string[];
  status: 'gerando' | 'pronto' | 'erro';
  createdAt: Timestamp;
}

export interface QuizResult extends WithId {
  quizId: string;
  score: number;
  total: number;
  correct: number;
  timeSpentSec: number;
  weakTopics: string[];
  feedback: string;
  createdAt: Timestamp;
}
