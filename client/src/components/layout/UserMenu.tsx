import { LogOut, Palette, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyError } from '@/lib/firebaseErrors';
import { signOut } from '@/services/firebase/auth';

export function UserMenu() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const name = profile?.name || user?.displayName || '';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <Dropdown
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menu da conta"
          className="rounded-full"
        >
          <Avatar name={name} src={profile?.photoURL} size={34} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text">{name || 'Sem nome'}</p>
            <p className="truncate text-xs text-text-muted">{profile?.email || user?.email}</p>
          </div>
          <div className="py-1">
            <DropdownItem
              icon={<UserRound className="size-4" />}
              onSelect={() => {
                close();
                navigate('/perfil');
              }}
            >
              Perfil
            </DropdownItem>
            <DropdownItem
              icon={<Palette className="size-4" />}
              onSelect={() => {
                close();
                navigate('/tema-preview');
              }}
            >
              Prévia do tema
            </DropdownItem>
            <DropdownItem danger icon={<LogOut className="size-4" />} onSelect={handleSignOut}>
              Sair
            </DropdownItem>
          </div>
        </>
      )}
    </Dropdown>
  );
}
