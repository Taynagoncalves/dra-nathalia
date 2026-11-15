import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebaseAdmin.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

/** Valida o Firebase ID Token (Authorization: Bearer <token>) e coloca o uid em req.uid. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!adminAuth) {
    return res.status(503).json({ error: 'Firebase Admin não está configurado no servidor.' });
  }
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}
