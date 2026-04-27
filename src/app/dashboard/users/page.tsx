'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/use-admin';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { Loader2, Shield, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function UsersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: currentUser, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);

  const usersQuery = useMemoFirebase(() => {
    if(!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const adminsQuery = useMemoFirebase(() => {
    if(!firestore) return null;
    return collection(firestore, 'admins');
  }, [firestore]);

  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);
  const { data: admins, isLoading: areAdminsLoading } = useCollection<{id: string}>(adminsQuery);

  const adminIds = new Set(admins?.map(a => a.id) ?? []);

  useEffect(() => {
    if (!isAdminLoading && currentUser && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [currentUser, isAdmin, isAdminLoading, router]);

  const handleAdminToggle = async (userToToggle: UserProfile, isCurrentlyAdmin: boolean) => {
    if (!firestore || !currentUser) return;
    
    if (currentUser.uid === userToToggle.id) {
        toast({
            variant: 'destructive',
            title: 'Ação não permitida',
            description: 'Você não pode remover sua própria permissão de administrador.',
        });
      return;
    }

    setTogglingAdminId(userToToggle.id);
    const adminRef = doc(firestore, 'admins', userToToggle.id);

    try {
        if (isCurrentlyAdmin) {
          await deleteDoc(adminRef);
          toast({
            title: 'Permissão Removida',
            description: `${userToToggle.name} não é mais um administrador.`,
          });
        } else {
          // The document can be empty, its existence is what matters.
          await setDoc(adminRef, {});
          toast({
            title: 'Permissão Concedida',
            description: `${userToToggle.name} agora é um administrador.`,
          });
        }
    } catch(error) {
        console.error("Error toggling admin status:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao alterar permissão',
            description: 'Não foi possível atualizar o status de administrador. Tente novamente.',
        });
    } finally {
        setTogglingAdminId(null);
    }
  };

  const isLoading = isAdminLoading || areUsersLoading || areAdminsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Usuários</CardTitle>
        <CardDescription>Visualize todos os usuários e gerencie as permissões de administrador.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Administrador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users && users.length > 0 ? (
              users.map((user) => {
                const isUserAdmin = adminIds.has(user.id);
                const isToggling = togglingAdminId === user.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatarDataUri} alt={user.name} />
                          <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                        {isToggling ? <Loader2 className="h-5 w-5 animate-spin" /> :
                         isUserAdmin ? <Shield className="h-5 w-5 text-primary" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
                        <Switch
                          checked={isUserAdmin}
                          onCheckedChange={() => handleAdminToggle(user, isUserAdmin)}
                          disabled={user.id === currentUser?.uid || isToggling}
                          aria-label={`Tornar ${user.name} administrador`}
                        />
                       </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
