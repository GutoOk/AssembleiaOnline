'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useAuth, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
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


export default function ProfilePage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (userProfile) {
      form.setValue('name', userProfile.name || '');
      setAvatarPreview(userProfile.avatarUrl || null);
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
    if (!user || !firestore || !auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Usuário não autenticado ou falha na conexão.',
      });
      return;
    }
    
    const dataToUpdate: { name: string; avatarUrl?: string } = {
      name: values.name,
    };

    if (avatarPreview && avatarPreview !== userProfile?.avatarUrl && avatarPreview !== user.photoURL) {
      dataToUpdate.avatarUrl = avatarPreview;
    }

    try {
      await updateProfile(auth.currentUser, {
          displayName: dataToUpdate.name,
      });

      const userDocRef = doc(firestore, 'users', user.uid);
      updateDocumentNonBlocking(userDocRef, dataToUpdate);

      toast({
        title: 'Perfil Atualizado!',
        description: 'Suas informações foram salvas com sucesso.',
      });
      
    } catch (error) {
        console.error("Error updating profile: ", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao atualizar',
            description: 'Não foi possível salvar suas alterações. Tente novamente.'
        });
    }
  };
  
  const isLoading = form.formState.isSubmitting || isUserLoading || isUploading || isProfileLoading;

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
   if (!user) {
    router.replace('/login');
    return null;
  }
  
  const displayName = userProfile?.name ?? user.displayName ?? 'Usuário';
  const avatarUrl = userProfile?.avatarUrl ?? user.photoURL ?? '';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('')
    : (user.email?.charAt(0) ?? '').toUpperCase();

  return (
    <>
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                    <Input type="email" value={user.email ?? ''} disabled />
                  </FormControl>
                  <FormDescription>
                      O email não pode ser alterado.
                  </FormDescription>
              </FormItem>

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Dialog open={isCropperOpen} onOpenChange={setCropperOpen}>
        <DialogContent className="sm:max-w-[625px]">
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
                  style={{ maxHeight: '70vh' }}
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
