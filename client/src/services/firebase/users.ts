import type { User } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { DEFAULT_DAILY_GOAL_MINUTES } from '@/config/constants';
import { readStoredPreference } from '@/lib/theme';
import type { UserProfile, UserSettings } from '@/types/models';
import { getDb } from './app';

export const userRef = (uid: string) => doc(getDb(), 'users', uid);

/**
 * Cria users/{uid} no primeiro login. Se já existir, não sobrescreve nada
 * (só completa o nome, se vier `extra.name` e o documento estiver sem nome).
 */
export async function ensureUserDoc(user: User, extra?: { name?: string }) {
  const ref = userRef(user.uid);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        name: extra?.name ?? user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? null,
        photoPublicId: null,
        createdAt: serverTimestamp(),
        xp: 0,
        level: 1,
        streak: 0,
        lastStudyDate: null,
        settings: {
          theme: readStoredPreference(),
          dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
        } satisfies UserSettings,
      });
    } else if (extra?.name && !snap.data().name) {
      tx.update(ref, { name: extra.name });
    }
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'name' | 'photoURL' | 'photoPublicId'>>,
) {
  await updateDoc(userRef(uid), data);
}

/** Atualiza só os campos informados de `settings` (sem apagar os outros). */
export async function updateUserSettings(uid: string, settings: Partial<UserSettings>) {
  const patch = Object.fromEntries(Object.entries(settings).map(([k, v]) => [`settings.${k}`, v]));
  await updateDoc(userRef(uid), patch);
}
