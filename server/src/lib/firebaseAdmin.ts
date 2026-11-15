import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';

function loadServiceAccount(): ServiceAccount | null {
  try {
    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    }
    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const file = resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
      return JSON.parse(readFileSync(file, 'utf8')) as ServiceAccount;
    }
  } catch (err) {
    console.warn('⚠️  Não foi possível ler a service account do Firebase:', (err as Error).message);
  }
  return null;
}

const serviceAccount = loadServiceAccount();
const app = serviceAccount ? initializeApp({ credential: cert(serviceAccount) }) : null;

/** null enquanto o Firebase Admin não estiver configurado. */
export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
export const isFirebaseAdminConfigured = app !== null;
