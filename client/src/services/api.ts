import { firebaseAuth } from './firebase/app';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Token do usuário logado, para o server validar com o firebase-admin. */
export async function getIdToken(): Promise<string> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new ApiError(401, 'Você precisa estar logado.');
  return user.getIdToken();
}

/** fetch para o /server com o Firebase ID Token e JSON. */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${await getIdToken()}`,
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Não foi possível falar com o servidor. Ele está rodando?');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Erro ${res.status} no servidor.`);
  }
  return data as T;
}
