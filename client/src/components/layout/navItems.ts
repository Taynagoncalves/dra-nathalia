import {
  BookOpenText,
  CalendarDays,
  ChartLine,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Presentation,
  Scale,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** rótulo curto para o menu inferior do celular */
  short?: string;
}

/** Itens principais da Etapa 1. */
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Início', icon: LayoutDashboard },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/questoes', label: 'Questões', icon: ListChecks },
  { to: '/quizzes', label: 'Quizzes com IA', short: 'Quizzes', icon: Sparkles },
  { to: '/caderno', label: 'Caderno IA', short: 'Caderno', icon: BookOpenText },
  { to: '/professora', label: 'Modo Professora', short: 'Professora', icon: Presentation },
  { to: '/simulador', label: 'Simulador Jurídico', short: 'Simulador', icon: Scale },
  { to: '/erros', label: 'Caderno de Erros', short: 'Erros', icon: NotebookPen },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/desempenho', label: 'Desempenho', icon: ChartLine },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
];

/** Os 4 primeiros vão para o menu inferior do celular (o 5º botão abre o drawer). */
export const MOBILE_BAR_NAV = MAIN_NAV.slice(0, 4);

export interface SoonItem {
  slug: string;
  label: string;
  icon: LucideIcon;
  stage: string;
  description: string;
}

/** Funções das próximas etapas: aparecem com o selo "Em breve". */
export const SOON_NAV: SoonItem[] = [];
