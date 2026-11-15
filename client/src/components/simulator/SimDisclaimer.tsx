import { Alert } from '@/components/ui/Alert';

/** Aviso obrigatório do simulador. */
export function SimDisclaimer({ className }: { className?: string }) {
  return (
    <Alert variant="info" className={className}>
      Os casos são <strong>fictícios</strong> (pessoas, empresas e números inventados) e a correção é <strong>educacional</strong>, feita por IA: não substitui a orientação de
      um(a) professor(a) nem serve como parecer jurídico. Confira a legislação atualizada.
    </Alert>
  );
}
