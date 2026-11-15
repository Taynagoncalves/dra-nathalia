import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { friendlyError } from '@/lib/firebaseErrors';
import { resetPassword } from '@/services/firebase/auth';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email: z.email('Informe um e-mail válido.') });
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    try {
      await resetPassword(email);
      setSentTo(email);
    } catch (err) {
      // Por segurança, o Firebase normalmente não revela se o e-mail existe.
      if ((err as { code?: string }).code === 'auth/user-not-found') setSentTo(email);
      else toast.error(friendlyError(err));
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={
        <Link to="/login" className="font-medium text-primary-text hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sentTo ? (
        <Alert variant="success" title="Confira seu e-mail">
          Se existir uma conta com <strong>{sentTo}</strong>, você vai receber um link para redefinir a senha. Olhe
          também a caixa de spam.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="E-mail" error={errors.email?.message}>
            {(id, d) => (
              <Input id={id} type="email" autoComplete="email" aria-describedby={d} aria-invalid={!!errors.email} {...register('email')} />
            )}
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
