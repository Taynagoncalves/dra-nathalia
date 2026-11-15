import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { getAuthOrThrow } from './app';
import { ensureUserDoc } from './users';

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(getAuthOrThrow(), email, password);
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(getAuthOrThrow(), email, password);
  await updateProfile(user, { displayName: name });
  // Cria (ou completa) users/{uid} já com o nome digitado no cadastro.
  await ensureUserDoc(user, { name });
}

export async function signInWithGoogle() {
  const auth = getAuthOrThrow();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Navegadores que bloqueiam pop-up (comum no celular): usa redirecionamento.
    if ((err as { code?: string }).code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getAuthOrThrow(), email);
}

export async function signOut() {
  await fbSignOut(getAuthOrThrow());
}
