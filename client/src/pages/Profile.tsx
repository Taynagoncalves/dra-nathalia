import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { Camera, KeyRound, LogOut, Palette, Target, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DEFAULT_DAILY_GOAL_MINUTES } from '@/config/constants';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { classifyFile, deleteFromCloudinary, uploadToCloudinary, validateFile } from '@/services/cloudinary/upload';
import { resetPassword, signOut } from '@/services/firebase/auth';
import { updateUserProfile, updateUserSettings } from '@/services/firebase/users';

export default function Profile() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Perfil" description="Seus dados, sua meta diária e a aparência do site." />
      <IdentityCard />
      <GoalCard />
      <AppearanceCard />
      <AccountCard />
    </div>
  );
}

/* ── Foto e nome ───────────────────────────────────────────────────── */

const nameSchema = z.object({ name: z.string().trim().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.') });

function IdentityCard() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({ resolver: zodResolver(nameSchema), values: { name: profile?.name ?? '' } });

  if (!user) return null;

  const saveName = async ({ name }: { name: string }) => {
    try {
      await updateUserProfile(user.uid, { name });
      await updateProfile(user, { displayName: name });
      await refreshProfile();
      reset({ name });
      toast.success('Nome atualizado.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;

    const invalid = validateFile(file);
    if (invalid) return void toast.error(invalid);
    if (classifyFile(file)?.kind !== 'image') return void toast.error('Escolha uma imagem (JPG, PNG, WEBP ou GIF).');

    const oldPublicId = profile?.photoPublicId;
    setProgress(0);
    try {
      const asset = await uploadToCloudinary(file, { purpose: 'avatar' }, { onProgress: setProgress });
      await updateUserProfile(user.uid, { photoURL: asset.url, photoPublicId: asset.publicId });
      await updateProfile(user, { photoURL: asset.url });
      await refreshProfile();
      toast.success('Foto atualizada.');
      // A foto antiga sai do Cloudinary só depois que a nova já está salva.
      if (oldPublicId) deleteFromCloudinary(oldPublicId, 'image').catch(() => {});
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível enviar a foto.'));
    } finally {
      setProgress(null);
    }
  };

  const removePhoto = async () => {
    setRemoving(true);
    try {
      const oldPublicId = profile?.photoPublicId;
      await updateUserProfile(user.uid, { photoURL: null, photoPublicId: null });
      await updateProfile(user, { photoURL: null });
      await refreshProfile();
      if (oldPublicId) deleteFromCloudinary(oldPublicId, 'image').catch(() => {});
      toast.success('Foto removida.');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setRemoving(false);
    }
  };

  const uploading = progress !== null;

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>Foto e nome</CardTitle>
        <CardDescription>Aparecem no topo do site.</CardDescription>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar name={profile?.name} src={profile?.photoURL} size={88} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Trocar foto"
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-surface bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            <Camera className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
              {uploading ? 'Enviando…' : 'Trocar foto'}
            </Button>
            {profile?.photoURL && !uploading && (
              <Button variant="ghost" size="sm" onClick={removePhoto} loading={removing}>
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>
          {uploading ? (
            <ProgressBar value={progress} label="Envio da foto" className="max-w-xs" />
          ) : (
            <p className="text-xs text-text-muted">JPG, PNG, WEBP ou GIF.</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={onPickPhoto}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(saveName)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <Field label="Nome" error={errors.name?.message} className="flex-1">
          {(id, d) => <Input id={id} autoComplete="name" aria-describedby={d} aria-invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Salvar nome
        </Button>
      </form>
    </Card>
  );
}

/* ── Meta diária ───────────────────────────────────────────────────── */

const GOAL_PRESETS = [30, 60, 90, 120, 180];

const formatMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (!h) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
};

function GoalCard() {
  const { user, profile, refreshProfile } = useAuth();
  const current = profile?.settings?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES;
  const [value, setValue] = useState<number | ''>(current);
  const [saving, setSaving] = useState(false);

  // Mantém o campo em sincronia quando o perfil carrega depois.
  const [lastCurrent, setLastCurrent] = useState(current);
  if (current !== lastCurrent) {
    setLastCurrent(current);
    setValue(current);
  }

  if (!user) return null;

  const valid = typeof value === 'number' && value >= 5 && value <= 960;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await updateUserSettings(user.uid, { dailyGoalMinutes: value });
      await refreshProfile();
      toast.success(`Meta diária: ${formatMinutes(value)}.`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
          <Target className="size-4.5" />
        </span>
        <div>
          <CardTitle>Meta diária de estudo</CardTitle>
          <CardDescription>Quanto tempo você quer estudar por dia. Aparece no dashboard.</CardDescription>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {GOAL_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setValue(m)}
            aria-pressed={value === m}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              value === m
                ? 'border-primary bg-primary-soft text-primary-text'
                : 'border-border text-text-muted hover:bg-primary-soft hover:text-text',
            )}
          >
            {formatMinutes(m)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Minutos por dia"
          error={value !== '' && !valid ? 'Escolha entre 5 e 960 minutos.' : undefined}
          className="sm:w-48"
        >
          {(id, d) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={5}
              max={960}
              step={5}
              value={value}
              aria-describedby={d}
              aria-invalid={value !== '' && !valid}
              onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
            />
          )}
        </Field>
        <Button onClick={save} loading={saving} disabled={!valid || value === current}>
          Salvar meta
        </Button>
      </div>
    </Card>
  );
}

/* ── Aparência ─────────────────────────────────────────────────────── */

function AppearanceCard() {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
          <Palette className="size-4.5" />
        </span>
        <div>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            “Automático” acompanha o tema do seu sistema. A escolha vale em todos os seus dispositivos.
          </CardDescription>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ThemeSelector />
        <ButtonLink to="/tema-preview" variant="ghost" size="sm">
          Ver prévia do tema
        </ButtonLink>
      </div>
    </Card>
  );
}

/* ── Conta ─────────────────────────────────────────────────────────── */

function AccountCard() {
  const { user, profile } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user) return null;

  const email = profile?.email || user.email || '';
  const usesPassword = user.providerData.some((p) => p.providerId === 'password');
  const usesGoogle = user.providerData.some((p) => p.providerId === 'google.com');

  const sendReset = async () => {
    setSending(true);
    try {
      await resetPassword(email);
      toast.success(`Enviamos um link para ${email}.`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>Conta</CardTitle>
        <CardDescription>
          {email}
          {usesGoogle && ' · entra com Google'}
        </CardDescription>
      </div>
      <div className="flex flex-wrap gap-2">
        {usesPassword && (
          <Button variant="secondary" size="sm" onClick={sendReset} loading={sending}>
            <KeyRound className="size-4" /> Trocar senha
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={handleSignOut}>
          <LogOut className="size-4" /> Sair
        </Button>
      </div>
    </Card>
  );
}
