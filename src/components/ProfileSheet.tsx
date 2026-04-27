'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfile } from 'firebase/auth';
import type { UserProfile } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';

const profileSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
});

// Helper function to create a default crop area
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

interface ProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  // State for image cropper
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropperOpen, setCropperOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);


  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    },
  });

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const { blockedUserIds } = useBlockedUsers();
  const blockedUserIdsArray = useMemo(() => Array.from(blockedUserIds), [blockedUserIds]);
  const { profiles: blockedUserProfiles, isLoading: areBlockedProfilesLoading } = useUserProfiles(blockedUserIdsArray);

  useEffect(() => {
    if (userProfile) {
      form.setValue('name', userProfile.name || '');
      setAvatarPreview(userProfile.avatarDataUri || null);
    } else if (user) {
        form.setValue('name', user.displayName || '');
        setAvatarPreview(user.photoURL || null);
    }
  }, [userProfile, user, form]);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
         if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
              variant: 'destructive',
              title: 'Imagem muito grande',
              description: 'Por favor, selecione um arquivo com menos de 5MB.',
            });
            return;
          }
        setIsUploading(true);
        setCrop(undefined); // Reset crop
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          setImgSrc(reader.result?.toString() || '');
          setCropperOpen(true);
          setIsUploading(false);
        });
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset file input
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
      imgRef.current = e.currentTarget;
      const { width, height } = e.currentTarget
      setCrop(centerAspectCrop(width, height, 1 / 1))
  }

  const handleApplyCrop = async () => {
      if (completedCrop && imgRef.current) {
          const canvas = document.createElement('canvas');
          const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
          const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
          canvas.width = completedCrop.width;
          canvas.height = completedCrop.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
              toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar a imagem.' });
              return;
          }

          ctx.drawImage(
              imgRef.current,
              completedCrop.x * scaleX,
              completedCrop.y * scaleY,
              completedCrop.width * scaleX,
              completedCrop.height * scaleY,
              0,
              0,
              completedCrop.width,
              completedCrop.height
          );

          // Compress to JPEG with 80% quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setAvatarPreview(compressedDataUrl);
          setCropperOpen(false);
          setImgSrc('');
      }
  };

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user || !firestore || !auth?.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Usuário não autenticado ou falha na conexão.',
      });
      return;
    }
    
    try {
        const dataToUpdate: { name: string; avatarDataUri?: string } = {
          name: values.name,
        };

        if (avatarPreview && avatarPreview !== userProfile?.avatarDataUri) {
          dataToUpdate.avatarDataUri = avatarPreview;
        }
      
        // The user's name is updated in the auth profile.
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, {
                displayName: dataToUpdate.name,
            });
        }

        // The user's profile document is updated in Firestore.
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, dataToUpdate);

        if (user.email) {
            const normalizedEmail = user.email.trim().toLowerCase();
            const memberEmailDocRef = doc(firestore, 'memberEmails', normalizedEmail);
            await updateDoc(memberEmailDocRef, { name: dataToUpdate.name });
        }

        toast({
            title: 'Perfil Atualizado!',
            description: 'Suas informações foram salvas com sucesso.',
        });
        onOpenChange(false);
      
    } catch (error) {
        console.error("Error updating profile: ", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao atualizar',
            description: 'Não foi possível salvar suas alterações. Tente novamente.'
        });
    }
  };

  const handleUnblockUser = async (userIdToUnblock: string) => {
    if (!user || !firestore) return;
    setUnblockingUserId(userIdToUnblock);
    try {
        const blockRef = doc(firestore, 'users', user.uid, 'blockedUsers', userIdToUnblock);
        await deleteDoc(blockRef);

        const unblockedUserProfile = blockedUserProfiles[userIdToUnblock];
        toast({
          title: 'Usuário Desbloqueado',
          description: `Você agora verá as mensagens de ${unblockedUserProfile?.name ?? 'este usuário'}.`,
        });
    } catch(error) {
        console.error("Error unblocking user:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Desbloquear',
            description: 'Não foi possível remover o bloqueio. Tente novamente.',
        });
    } finally {
        setUnblockingUserId(null);
    }
  };
  
  const isLoading = form.formState.isSubmitting || isUserLoading || isUploading || isProfileLoading;

  const displayName = userProfile?.name ?? user?.displayName ?? 'Usuário';
  const avatarDataUri = userProfile?.avatarDataUri ?? '';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('')
    : (user?.email?.charAt(0) ?? '').toUpperCase();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Meu Perfil</SheetTitle>
            <SheetDescription>Atualize suas informações pessoais.</SheetDescription>
          </SheetHeader>
           <ScrollArea className="flex-1">
            <div className="p-6">
                <Form {...form}>
                    <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="flex flex-col items-center space-y-4">
                        <Avatar className="h-24 w-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <AvatarImage src={avatarPreview ?? ''} alt={displayName} />
                            <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
                        </Avatar>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarChange}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                            disabled={isLoading}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Trocar Foto
                        </Button>
                    </div>

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                            <Input placeholder="Seu nome" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                            <Input type="email" value={user?.email ?? ''} disabled />
                        </FormControl>
                        <FormDescription>
                            O email não pode ser alterado.
                        </FormDescription>
                    </FormItem>
                    </form>
                </Form>
                 {blockedUserIds.size > 0 && (
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>Gerenciamento de Bloqueios</CardTitle>
                            <CardDescription>Usuários que você bloqueou no chat.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {areBlockedProfilesLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <div className="space-y-4">
                                    {Array.from(blockedUserIds).map(userId => {
                                        const blockedUser = blockedUserProfiles[userId];
                                        if (!blockedUser) return null;
                                        const isUnblocking = unblockingUserId === userId;
                                        return (
                                            <div key={userId} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={blockedUser.avatarDataUri} alt={blockedUser.name} />
                                                        <AvatarFallback>{blockedUser.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{blockedUser.name}</p>
                                                        <p className="text-sm text-muted-foreground">{blockedUser.email}</p>
                                                    </div>
                                                </div>
                                                <Button variant="outline" onClick={() => handleUnblockUser(userId)} disabled={isUnblocking}>
                                                    {isUnblocking && <Loader2 className="h-4 w-4 animate-spin"/>}
                                                    Desbloquear
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
          </ScrollArea>
           <SheetFooter className="p-4 border-t">
            <Button type="submit" form="profile-form" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Alterações
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={isCropperOpen} onOpenChange={setCropperOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[625px] max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recortar Imagem</DialogTitle>
            <DialogDescriptionComponent>
              Ajuste a imagem para recortar seu novo avatar.
            </DialogDescriptionComponent>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '55dvh', maxWidth: '100%' }}
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCropperOpen(false); setImgSrc(''); }}>Cancelar</Button>
            <Button type="button" onClick={handleApplyCrop} disabled={!completedCrop}>Aplicar Recorte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
