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
export type AiStatus = 'pendente' | 'processando' | 'pronto' | 'erro' | 'indisponivel';

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
  /** motivo quando aiStatus = 'erro' | 'indisponivel' */
  aiError?: string;
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

/* ── Etapa 2: quizzes com IA ─────────────────────────────────────── */

export type QuizQuestionType = 'multipla' | 'certo_errado' | 'lacunas' | 'discursiva';
export type QuizDifficulty = 'facil' | 'medio' | 'dificil' | 'pegadinha' | 'oab' | 'concurso';
export type QuizMode = 'treino' | 'prova' | 'relampago';
export type QuizFocus = 'geral' | 'artigos' | 'jurisprudencia' | 'conceitos';

export interface QuizConfig {
  count: number;
  types: QuizQuestionType[];
  difficulty: QuizDifficulty;
  mode: QuizMode;
  /** segundos por questão (modo relâmpago) */
  timerSec?: number | null;
  focus: QuizFocus;
}

/** De onde o quiz é gerado. */
export type QuizSource =
  | { type: 'material'; subjectId: string; materialIds: string[] }
  | { type: 'folder'; subjectId: string; folderId: string }
  | { type: 'subject'; subjectId: string; topicId?: string | null }
  | { type: 'errors'; subjectId: string }
  | { type: 'tema'; subjectId: string; theme: string }
  | { type: 'quiz_erros'; subjectId: string; fromQuizId: string; indices: number[] };

/** Questão gerada pela IA, guardada dentro do quiz. */
export interface QuizItem {
  type: QuizQuestionType;
  statement: string;
  options: string[];
  /** índice ('0'…'4') em múltipla/lacunas; 'certo'|'errado'; ou resposta-modelo (discursiva) */
  correctAnswer: string;
  explanation: string;
  /** por que cada alternativa está certa ou errada */
  optionExplanations: string[];
  sourceMaterialId: string | null;
  sourceMaterialTitle: string | null;
  sourcePage: number | null;
  /** trecho de origem (citação do material) */
  sourceQuote: string | null;
  topicId: string | null;
  topicName: string;
  difficulty: 'facil' | 'medio' | 'dificil';
}

export interface Quiz extends WithId {
  title: string;
  subjectId: string;
  topicId?: string | null;
  source: QuizSource;
  sourceMaterialIds: string[];
  sourceFolderId?: string | null;
  config: QuizConfig;
  items: QuizItem[];
  /** questões salvas no banco de questões */
  questionIds: string[];
  status: 'gerando' | 'pronto' | 'erro';
  error?: string;
  /** gerado sem material do aluno (tema livre) */
  noMaterial?: boolean;
  /** material grande demais: a IA usou trechos selecionados */
  truncated?: boolean;
  contested?: number[];
  result?: { score: number; total: number; correct: number; timeSpentSec: number; resultId: string };
  createdAt: Timestamp | null;
}

export interface QuizResult extends WithId {
  quizId: string;
  subjectId: string | null;
  score: number;
  total: number;
  correct: number;
  timeSpentSec: number;
  weakTopics: string[];
  byTopic: { topic: string; correct: number; total: number }[];
  feedback: string;
  contested: number[];
  createdAt: Timestamp | null;
}

/* ── Etapa 2: Caderno IA (estilo NotebookLM) ─────────────────────── */

export interface NotebookCitation {
  materialId: string | null;
  title: string;
  page: number | null;
  quote: string;
}

export interface NotebookMessage {
  role: 'user' | 'assistant';
  text: string;
  /** citações numeradas: o texto usa [n] */
  citations?: (NotebookCitation & { n: number })[];
  followUps?: string[];
  /** a resposta usou conhecimento geral (fora dos materiais) */
  generalKnowledge?: boolean;
}

export type StudioKind = 'resumo' | 'guia' | 'faq' | 'linha_do_tempo' | 'mapa_mental';

type Cit = NotebookCitation | null;
export interface StudioContent {
  resumo: { title: string; overview: string; keyPoints: { point: string; detail: string; citation: Cit }[] };
  guia: {
    title: string;
    objectives: string[];
    sections: { topic: string; explanation: string; keyTerms: { term: string; definition: string }[]; citation: Cit }[];
    selfCheck: { question: string; answer: string }[];
  };
  faq: { title: string; items: { question: string; answer: string; citation: Cit }[] };
  linha_do_tempo: { title: string; events: { when: string; what: string; why: string; citation: Cit }[] };
  mapa_mental: {
    title: string;
    root: string;
    branches: { label: string; summary: string; citation: Cit; children: { label: string; summary: string; citation: Cit }[] }[];
  };
}

export interface NotebookItem<K extends StudioKind = StudioKind> extends WithId {
  subjectId: string;
  kind: K;
  title: string;
  content: StudioContent[K];
  sourceMaterialIds: string[];
  truncated?: boolean;
  createdAt: Timestamp | null;
}

/* ── Etapa 3: Modo Professora ────────────────────────────────────── */

export type DeckTemplate = 'tradicional' | 'visual' | 'revisao' | 'juridica' | 'ensinar';

export interface Slide {
  title: string;
  bullets: string[];
  /** roteiro do que falar */
  notes: string;
  /** destaque: exemplo, esquema, pegadinha ou pergunta */
  highlight: string | null;
}

export interface Deck extends WithId {
  title: string;
  subjectId: string;
  topicId?: string | null;
  template: DeckTemplate;
  slides: Slide[];
  sourceMaterialIds: string[];
  noMaterial?: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type TaynaLevel = 'basico' | 'intermediario' | 'avancado' | 'pegadinha' | 'oab' | 'concurso';
export type TaynaPersonality = 'curiosa' | 'rigorosa' | 'advogada_do_diabo';

export interface LiveQuestion {
  id: string;
  slideIndex: number;
  text: string;
  expectedAnswer: string | null;
  askedBy: string;
  askedByName: string;
  result: 'certa' | 'errada' | null;
  aiVerdict?: string;
  aiNote?: string;
  createdAt: number;
}

export interface LiveSession {
  id: string;
  ownerUid: string;
  ownerName: string;
  deckId: string;
  deckTitle: string;
  slides: Pick<Slide, 'title' | 'bullets' | 'highlight'>[];
  currentSlide: number;
  status: 'ativa' | 'encerrada';
  participants: Record<string, string>;
  questions: LiveQuestion[];
  suggestions: Record<string, { question: string; answer: string }[]>;
}

/* ── Etapa 4 — Simulador Jurídico ─────────────────────────────────── */

export type CaseArea = 'civil' | 'consumidor' | 'familia' | 'penal' | 'trabalho' | 'administrativo' | 'tributario' | 'constitucional' | 'empresarial' | 'previdenciario';
export type CaseDifficulty = 'facil' | 'medio' | 'dificil';
export type SimRole = 'autor' | 'reu' | 'magistrado';
export type CaseDocKind = 'contrato' | 'conversa' | 'comprovante' | 'decisao' | 'notificacao' | 'email' | 'boletim' | 'laudo' | 'peticao' | 'outro';

export interface CaseDocument {
  kind: CaseDocKind;
  title: string;
  date: string | null;
  content: string;
}

export interface LegalCase extends WithId {
  title: string;
  summary: string;
  facts: string;
  parties: { autor: string; reu: string };
  documents: CaseDocument[];
  roles: Record<SimRole, string>;
  area: CaseArea;
  difficulty: CaseDifficulty;
  subjectId: string | null;
  /** gerado em segundo plano pelo server */
  status?: 'gerando' | 'pronto' | 'erro';
  error?: string;
  jobStartedAt?: number;
  createdAt: Timestamp | null;
}

export interface SimCriterion {
  key: string;
  label: string;
  score: number;
  comment: string;
}

export interface SimCorrection {
  overall: number;
  expectedPiece: string;
  identifiedPiece: string;
  pieceCorrect: boolean;
  criteria: SimCriterion[];
  summary: string;
  strengths: string[];
  errors: { error: string; why: string; fix: string; category: ErrorCategory }[];
  lines: { index: number; status: 'ajustar' | 'erro'; suggestion: string; comment: string }[];
  modelAnswer: string;
  essentials: string[];
}

export interface Simulation extends WithId {
  caseId: string;
  caseTitle: string;
  area: CaseArea;
  role: SimRole;
  pieceTitle: string;
  text: string;
  status: 'rascunho' | 'corrigindo' | 'corrigida';
  score?: number;
  correction?: SimCorrection;
  errorsSaved?: boolean;
  /** erro da última correção (o texto continua salvo) */
  correctionError?: string;
  jobStartedAt?: number;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
  submittedAt?: Timestamp | null;
}

/* ── Etapa 5 — Um dia na prática jurídica ─────────────────────────── */

export type PracticeCareer = 'advocacia' | 'magistratura' | 'promotoria' | 'defensoria' | 'delegacia';
export type PracticeTaskKind = 'atendimento' | 'prazo' | 'audiencia' | 'redacao' | 'email' | 'pesquisa' | 'decisao' | 'reuniao';

export interface PracticeTask {
  time: string;
  kind: PracticeTaskKind;
  title: string;
  context: string;
  prompt: string;
  size: 'curta' | 'media';
}

export interface PracticeDay extends WithId {
  career: PracticeCareer;
  area: CaseArea | 'variado';
  difficulty: CaseDifficulty;
  title: string;
  intro: string;
  tasks: PracticeTask[];
  answers: string[];
  status: 'gerando' | 'erro' | 'em_andamento' | 'avaliando' | 'concluido';
  error?: string;
  evaluationError?: string;
  jobStartedAt?: number;
  score?: number;
  evaluation?: {
    perTask: { score: number; feedback: string; ideal: string }[];
    summary: string;
    strengths: string[];
    toImprove: string[];
  };
  createdAt: Timestamp | null;
  finishedAt?: Timestamp | null;
}
