import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** As cores dos toasts vêm das variáveis do tema. */
const toastStyle = {
  '--normal-bg': 'var(--surface-elevated)',
  '--normal-text': 'var(--text)',
  '--normal-border': 'var(--border)',
  '--success-bg': 'color-mix(in srgb, var(--success) 12%, var(--surface-elevated))',
  '--success-text': 'var(--success)',
  '--success-border': 'color-mix(in srgb, var(--success) 35%, transparent)',
  '--error-bg': 'color-mix(in srgb, var(--error) 12%, var(--surface-elevated))',
  '--error-text': 'var(--error)',
  '--error-border': 'color-mix(in srgb, var(--error) 35%, transparent)',
  '--warning-bg': 'color-mix(in srgb, var(--warning) 12%, var(--surface-elevated))',
  '--warning-text': 'var(--warning)',
  '--warning-border': 'color-mix(in srgb, var(--warning) 35%, transparent)',
  '--info-bg': 'color-mix(in srgb, var(--info) 12%, var(--surface-elevated))',
  '--info-text': 'var(--info)',
  '--info-border': 'color-mix(in srgb, var(--info) 35%, transparent)',
} as CSSProperties;

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors closeButton position="top-right" style={toastStyle} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
