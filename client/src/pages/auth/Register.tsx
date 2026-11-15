import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { friendlyError } from '@/lib/firebaseErrors';
import { signUpWithEmail } from '@/services/firebase/auth';
import { AuthLayout } from './AuthLayout';
import { GoogleButton, OrDivider } from './GoogleButton';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome.'),
    email: z.email('Informe um e-mail válido.'),
    password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'As senhas não conferem.' });
type FormData = z.infer<typeof schema>;

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ name, email, password }: FormData) => {
    try {
      await signUpWithEmail(name, email, password);
      toast.success('Conta criada! Bons estudos.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Organize seus estudos em um só lugar."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-primary-text hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <GoogleButton label="Cadastrar com Google" />
      <OrDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome" error={errors.name?.message}>
          {(id, d) => <Input id={id} autoComplete="name" aria-describedby={d} aria-invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          {(id, d) => (
            <Input id={id} type="email" autoComplete="email" aria-describedby={d} aria-invalid={!!errors.email} {...register('email')} />
          )}
        </Field>
        <Field label="Senha" error={errors.password?.message} hint="Mínimo de 6 caracteres.">
          {(id, d) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={d}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          )}
        </Field>
        <Field label="Confirmar senha" error={errors.confirm?.message}>
          {(id, d) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={d}
              aria-invalid={!!errors.confirm}
              {...register('confirm')}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
