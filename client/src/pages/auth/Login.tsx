import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { friendlyError } from '@/lib/firebaseErrors';
import { signInWithEmail } from '@/services/firebase/auth';
import { AuthLayout } from './AuthLayout';
import { GoogleButton, OrDivider } from './GoogleButton';

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, password }: FormData) => {
    try {
      await signInWithEmail(email, password);
      // O redirecionamento acontece sozinho (PublicOnlyRoute).
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <AuthLayout
      title="Bem-vinda de volta"
      subtitle="Entre para continuar seus estudos."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-primary-text hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <GoogleButton />
      <OrDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" error={errors.email?.message}>
          {(id, d) => (
            <Input id={id} type="email" autoComplete="email" aria-describedby={d} aria-invalid={!!errors.email} {...register('email')} />
          )}
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          {(id, d) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              aria-describedby={d}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/recuperar-senha" className="text-sm text-primary-text hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
