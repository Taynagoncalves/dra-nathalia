import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';

/** Motivo (sem dados secretos) quando o Firebase Admin não carrega; aparece em /api/health. */
export let firebaseAdminIssue: string | null = null;

/** Lugares onde procurar o arquivo (o Render põe Secret Files na raiz do app e em /etc/secrets). */
const CANDIDATES = ['./serviceAccount.json', '/etc/secrets/serviceAccount.json'];

function parse(json: string, origin: string): ServiceAccount | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    if (!data.private_key || !data.client_email || !data.project_id) {
      firebaseAdminIssue = `${origin}: o JSON não tem private_key/client_email/project_id (arquivo errado ou incompleto).`;
      return null;
    }
    return data as ServiceAccount;
  } catch {
    firebaseAdminIssue = `${origin}: o conteúdo não é um JSON válido (confira se colou o arquivo inteiro, do { ao }).`;
    return null;
  }
}

function loadServiceAccount(): ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) return parse(env.FIREBASE_SERVICE_ACCOUNT_JSON, 'FIREBASE_SERVICE_ACCOUNT_JSON');

  const paths = [env.FIREBASE_SERVICE_ACCOUNT_PATH, ...CANDIDATES].filter((p): p is string => !!p).map((p) => resolve(process.cwd(), p));
  const found = paths.find((p) => existsSync(p));
  if (!found) {
    firebaseAdminIssue = env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? `arquivo não encontrado em ${env.FIREBASE_SERVICE_ACCOUNT_PATH} (confira o nome do Secret File: serviceAccount.json).`
      : 'nenhuma service account configurada (FIREBASE_SERVICE_ACCOUNT_PATH ou Secret File serviceAccount.json).';
    return null;
  }
  return parse(readFileSync(found, 'utf8'), found);
}

const serviceAccount = loadServiceAccount();
let app: ReturnType<typeof initializeApp> | null = null;
if (serviceAccount) {
  try {
    app = initializeApp({ credential: cert(serviceAccount) });
    firebaseAdminIssue = null;
  } catch (err) {
    firebaseAdminIssue = `a chave foi lida, mas é inválida: ${(err as Error).message.slice(0, 120)}`;
  }
}
if (firebaseAdminIssue) console.warn('⚠️  Firebase Admin:', firebaseAdminIssue);

/** null enquanto o Firebase Admin não estiver configurado. */
export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
export const isFirebaseAdminConfigured = app !== null;
