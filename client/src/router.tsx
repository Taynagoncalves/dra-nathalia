import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/layout/RouteGuards';
import { FullPageSpinner } from '@/components/ui/Feedback';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import Profile from '@/pages/Profile';
import SetupRequired from '@/pages/SetupRequired';
import { isFirebaseConfigured } from '@/services/firebase/app';

// Recharts é pesado: só carrega quando a página for aberta.
const ThemePreview = lazy(() => import('@/pages/ThemePreview'));

const withSuspense = (node: ReactNode) => <Suspense fallback={<FullPageSpinner />}>{node}</Suspense>;

/** Página temporária de conferência do tema (funciona mesmo sem Firebase). */
const themePreviewRoute: RouteObject = { path: '/tema-preview', element: withSuspense(<ThemePreview />) };

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
          { index: true, element: <Home /> },
          { path: '/perfil', element: <Profile /> },
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
