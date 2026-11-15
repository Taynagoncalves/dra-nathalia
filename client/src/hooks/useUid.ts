import { useAuth } from '@/contexts/AuthContext';

/** uid do usuário logado. Use só dentro das rotas protegidas. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('useUid usado fora de uma rota protegida.');
  return user.uid;
}
