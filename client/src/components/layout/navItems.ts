import {
  Bot,
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
export const SOON_NAV: SoonItem[] = [
  {
    slug: 'assistente',
    label: 'Assistente IA',
    icon: Bot,
    stage: 'Etapa 2',
    description:
      'Um chat dentro de cada matéria que responde com base nos seus materiais e indica a fonte (“Apostila X, p. 12”).',
  },
  {
    slug: 'quizzes',
    label: 'Quizzes com IA',
    icon: Sparkles,
    stage: 'Etapa 2',
    description:
      'Gere quizzes a partir de um PDF, de uma pasta, de uma matéria ou dos seus erros — com gabarito comentado e o trecho de origem.',
  },
  {
    slug: 'professora',
    label: 'Modo Professora',
    icon: Presentation,
    stage: 'Etapa 3',
    description:
      'Crie slides, apresente o conteúdo em voz alta e responda às perguntas da Tayna, que aponta o que faltou na sua explicação.',
  },
  {
    slug: 'simulador',
    label: 'Simulador Jurídico',
    icon: Scale,
    stage: 'Etapa 4',
    description:
      'Casos concretos fictícios com documentos e a Roleta Jurídica: sorteie seu papel (autor, réu ou magistrado), escreva a peça e receba a correção.',
  },
];
