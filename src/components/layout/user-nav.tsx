'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useAdmin } from '@/hooks/use-admin';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';

export function UserNav() {
  const { user, isAdmin } = useAdmin();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const handleLogout = () => {
    signOut(auth);
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  const displayName = userProfile?.name ?? user.displayName ?? 'Usuário';
  const avatarDataUri = userProfile?.avatarDataUri ?? '';
  const email = userProfile?.email ?? user.email ?? '';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('')
    : (email.charAt(0) ?? '').toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarDataUri} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
            {isAdmin && (
              <Badge variant="secondary" className="mt-1 w-fit">
                Administrador
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            Perfil
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => router.push('/dashboard/users')}>
              Gerenciar Usuários
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
