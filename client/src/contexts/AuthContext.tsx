import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import { firebaseAuth } from '@/services/firebase/app';
import { ensureUserDoc, getUserProfile } from '@/services/firebase/users';
import type { UserProfile } from '@/types/models';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** true até sabermos se há alguém logado (e o perfil ter carregado) */
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseAuth !== null);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (!u || u.isAnonymous) {
        // convidados da "Tayna ao vivo" entram anônimos e não têm perfil
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await ensureUserDoc(u);
        setProfile(await getUserProfile(u.uid));
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível carregar seu perfil.'));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) setProfile(await getUserProfile(user.uid));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
