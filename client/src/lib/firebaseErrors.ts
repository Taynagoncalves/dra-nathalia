const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-email': 'Informe o e-mail.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/cancelled-popup-request': 'A janela do Google foi fechada antes de concluir.',
  'auth/account-exists-with-different-credential':
    'Este e-mail já está cadastrado com outro método de login.',
  'auth/operation-not-allowed': 'Este método de login não está ativado no Firebase.',
  'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
  'permission-denied': 'Você não tem permissão para acessar estes dados.',
  unavailable: 'Serviço indisponível no momento. Tente de novo.',
};

/** Converte erros do Firebase (e outros) em mensagens em português. */
export function friendlyError(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const code = (err as { code?: string })?.code;
  if (code === 'failed-precondition' && String((err as Error).message).includes('index')) {
    return 'Falta publicar os índices do Firestore: rode "firebase deploy --only firestore:indexes" (veja o README) e aguarde alguns minutos.';
  }
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Erros do nosso server (ApiError) já vêm com mensagem em português: mostra como está.
  if (err instanceof Error && typeof (err as { status?: unknown }).status === 'number' && err.message) return err.message;
  // Mensagens internas do SDK do Firebase (em inglês) não são mostradas.
  if (err instanceof Error && err.message && !/^Firebase(Error)?:/.test(err.message)) return err.message;
  return fallback;
}
