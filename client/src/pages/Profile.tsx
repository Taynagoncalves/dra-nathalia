import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Perfil — nesta Parte 1 só o tema.
 * Nome, foto (Cloudinary) e meta diária entram na Parte 2.
 */
export default function Profile() {
  const { profile, user } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Perfil</h1>
        <p className="mt-1 text-text-muted">{profile?.email || user?.email}</p>
      </div>

      <Card className="space-y-4">
        <div>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            “Automático” acompanha o tema do seu sistema. A escolha vale em todos os seus dispositivos.
          </CardDescription>
        </div>
        <ThemeSelector />
      </Card>
    </div>
  );
}
