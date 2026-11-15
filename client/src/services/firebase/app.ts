import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Variáveis obrigatórias que ainda faltam no client/.env (usado na tela de configuração). */
export const missingFirebaseEnv = (
  [
    ['VITE_FIREBASE_API_KEY', config.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', config.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', config.projectId],
    ['VITE_FIREBASE_APP_ID', config.appId],
  ] as const
)
  .filter(([, v]) => !v)
  .map(([k]) => k);

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

const app: FirebaseApp | null = isFirebaseConfigured ? initializeApp(config) : null;

const authInstance: Auth | null = app ? getAuth(app) : null;
if (authInstance) authInstance.languageCode = 'pt-BR';

const dbInstance: Firestore | null = app ? getFirestore(app) : null;

/** Auth do Firebase (null enquanto o .env não estiver preenchido). */
export const firebaseAuth = authInstance;

/** Use dentro dos services: falha com mensagem clara se o Firebase não estiver configurado. */
export function getAuthOrThrow(): Auth {
  if (!authInstance) throw new Error('O Firebase ainda não foi configurado (veja o README).');
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) throw new Error('O Firebase ainda não foi configurado (veja o README).');
  return dbInstance;
}
