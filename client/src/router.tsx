import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/layout/RouteGuards';
import { FullPageSpinner, Spinner } from '@/components/ui/Feedback';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import NotFound from '@/pages/NotFound';
import SetupRequired from '@/pages/SetupRequired';
import { isFirebaseConfigured } from '@/services/firebase/app';

// Páginas carregadas sob demanda (deixa o carregamento inicial mais leve).
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const PerformancePage = lazy(() => import('@/pages/performance/PerformancePage'));
const Profile = lazy(() => import('@/pages/Profile'));
const ComingSoon = lazy(() => import('@/pages/ComingSoon'));
const Projects = lazy(() => import('@/pages/projects/Projects'));
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'));
const SubjectPage = lazy(() => import('@/pages/subjects/SubjectPage'));
const NoteEditorPage = lazy(() => import('@/pages/subjects/NoteEditorPage'));
const QuestionsPage = lazy(() => import('@/pages/questions/QuestionsPage'));
const SolvePage = lazy(() => import('@/pages/questions/SolvePage'));
const ErrorNotebookPage = lazy(() => import('@/pages/errors/ErrorNotebookPage'));
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));
const ThemePreview = lazy(() => import('@/pages/ThemePreview'));

const page = (node: ReactNode) => (
  <Suspense
    fallback={
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-7" />
      </div>
    }
  >
    {node}
  </Suspense>
);

/** Página temporária de conferência do tema (funciona mesmo sem Firebase). */
const themePreviewRoute: RouteObject = {
  path: '/tema-preview',
  element: <Suspense fallback={<FullPageSpinner />}>{<ThemePreview />}</Suspense>,
};

const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/cadastro', element: <Register /> },
      { path: '/recuperar-senha', element: <ForgotPassword /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: page(<DashboardPage />) },
          { path: '/projetos', element: page(<Projects />) },
          { path: '/projetos/:projectId', element: page(<ProjectDetail />) },
          { path: '/materias/:subjectId', element: page(<SubjectPage />) },
          { path: '/materias/:subjectId/anotacoes/:noteId', element: page(<NoteEditorPage />) },
          { path: '/questoes', element: page(<QuestionsPage />) },
          { path: '/questoes/resolver', element: page(<SolvePage />) },
          { path: '/erros', element: page(<ErrorNotebookPage />) },
          { path: '/calendario', element: page(<CalendarPage />) },
          { path: '/desempenho', element: page(<PerformancePage />) },
          { path: '/perfil', element: page(<Profile />) },
          { path: '/em-breve/:slug', element: page(<ComingSoon />) },
        ],
      },
    ],
  },
  themePreviewRoute,
  { path: '*', element: <NotFound /> },
];

/** Sem as credenciais do Firebase, mostra a tela de configuração (e a prévia do tema). */
const setupRoutes: RouteObject[] = [themePreviewRoute, { path: '*', element: <SetupRequired /> }];

export const router = createBrowserRouter(isFirebaseConfigured ? appRoutes : setupRoutes);
