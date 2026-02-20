'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  type User as FirebaseUser,
  sendEmailVerification,
  signOut,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { Icons } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const registerSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
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

function RegisterDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for image cropper
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropperOpen, setCropperOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', password: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: '', password: '' });
      setAvatarPreview(null);
      setImgSrc('');
    }
  }, [open, form]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
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
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1 / 1));
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
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível processar a imagem.',
        });
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

  const handleRegister = async (values: z.infer<typeof registerSchema>) => {
    if (!auth || !firestore) return;
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        values.password
      );
      const newUser = userCredential.user;

      const userProfile: Omit<UserProfile, 'createdAt'> = {
        id: newUser.uid,
        name: values.name,
        email: email,
        avatarDataUri:
          avatarPreview || `https://avatar.vercel.sh/${newUser.uid}.svg`,
      };

      const userDocRef = doc(firestore, 'users', newUser.uid);
      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
      });

      if (newUser.email === 'admin@assembleia.dev') {
        const adminDocRef = doc(firestore, 'admins', newUser.uid);
        await setDoc(adminDocRef, {});
      }

      await sendEmailVerification(newUser);

      toast({
        title: 'Cadastro Realizado!',
        description:
          'Um email de confirmação foi enviado. Por favor, verifique sua caixa de entrada e spam para ativar sua conta.',
      });

      await signOut(auth); // Sign out user to force email verification
      onOpenChange(false);
    } catch (error: any) {
      let description = 'Não foi possível criar a conta.';
      if (error.code === 'auth/weak-password') {
        description =
          'A senha é muito fraca. Deve ter pelo menos 6 caracteres.';
      } else if (error.code === 'auth/email-already-in-use') {
        description = 'Este email já está em uso por outra conta.';
      }
      toast({
        variant: 'destructive',
        title: 'Falha no Cadastro',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realizar Cadastro</DialogTitle>
            <DialogDescription>
              Complete os campos abaixo para criar sua conta.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleRegister)}
              className="space-y-4"
            >
              <div className="flex flex-col items-center space-y-2">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview ?? ''} />
                  <AvatarFallback className="text-2xl">
                    {(
                      form.getValues('name')?.charAt(0) ||
                      email.charAt(0) ||
                      ''
                    ).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  disabled={isLoading || isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Carregar Foto
                </Button>
                <FormDescription>
                  Opcional. Você pode adicionar uma foto depois.
                </FormDescription>
              </div>

              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" value={email} disabled />
                </FormControl>
              </FormItem>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cadastrar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCropperOpen} onOpenChange={setCropperOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Recortar Imagem</DialogTitle>
            <DialogDescription>
              Ajuste a imagem para seu novo avatar.
            </DialogDescription>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCropperOpen(false);
                setImgSrc('');
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApplyCrop}
              disabled={!completedCrop}
            >
              Aplicar Recorte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  // This effect runs once to set persistence for the session.
  useEffect(() => {
    if (auth) {
      // Use local persistence to keep the user signed in across browser sessions.
      setPersistence(auth, browserLocalPersistence);
    }
  }, [auth]);

  const processGoogleUser = useCallback(
    async (firebaseUser: FirebaseUser): Promise<boolean> => {
      if (!firestore || !auth) return false;
      try {
        if (
          firebaseUser.email &&
          !firebaseUser.email.endsWith('@mensa.org.br')
        ) {
          // This is a valid user, but not for this app. Sign them out.
          await auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Acesso Negado',
            description: 'Apenas emails do domínio @mensa.org.br são permitidos.',
          });
          return false;
        }

        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          const name =
            firebaseUser.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Novo Usuário';
          const userProfile: UserProfile = {
            id: firebaseUser.uid,
            name: name,
            email: firebaseUser.email!,
            avatarDataUri:
              firebaseUser.photoURL ||
              `https://avatar.vercel.sh/${firebaseUser.uid}.svg`,
            createdAt: serverTimestamp() as any,
          };
          await setDoc(userDocRef, userProfile);
        }
        return true;
      } catch (error: any) {
        console.error('Error processing Google user:', error);
        toast({
          variant: 'destructive',
          title: 'Erro de Processamento',
          description:
            error.message || 'Não foi possível configurar o perfil do usuário.',
        });
        if (auth.currentUser) {
          await auth.signOut();
        }
        return false;
      }
    },
    [auth, firestore, toast]
  );

  // This effect handles the result from the redirect login flow
  useEffect(() => {
    if (auth) {
      setIsProcessingRedirect(true);
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user) {
            const loginSuccessful = await processGoogleUser(result.user);
            if (loginSuccessful) {
              router.replace('/dashboard');
            }
          }
        })
        .catch((error) => {
          console.error('Google Sign-In redirect error:', error);
          toast({
            variant: 'destructive',
            title: 'Erro no Login com Google',
            description: `Ocorreu um erro: ${error.code} - ${error.message}. Tente novamente. Se o problema persistir, verifique as permissões de cookies e pop-ups no seu navegador.`,
          });
        })
        .finally(() => {
          setIsProcessingRedirect(false);
        });
    } else {
      setIsProcessingRedirect(false);
    }
  }, [auth, processGoogleUser, toast, router]);

  // This effect handles navigation *after* the user state is confirmed and any redirect is processed.
  useEffect(() => {
    if (!isProcessingRedirect && !isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, isProcessingRedirect, router]);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Serviço de autenticação indisponível.',
      });
      return;
    }
    setIsLoadingEmail(true);

    if (
      !email.endsWith('@mensa.org.br') &&
      !email.endsWith('@assembleia.dev')
    ) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description:
          'Apenas emails do domínio @mensa.org.br ou de teste são permitidos.',
      });
      setIsLoadingEmail(false);
      return;
    }

    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);

      if (signInMethods.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Usuário não cadastrado',
          description: "O e-mail informado não foi encontrado. Por favor, clique em 'Criar novo usuário' para se registrar.",
        });
      } else {
        // User exists, try to sign in
        try {
          await signInWithEmailAndPassword(auth, email, password);
          // onAuthStateChanged will handle redirect
        } catch (signInError: any) {
          // If sign-in fails now, it's almost certainly a wrong password.
          toast({
            variant: 'destructive',
            title: 'Senha incorreta',
            description: 'A senha digitada está incorreta. Se necessário, utilize a opção "Esqueci minha senha".',
          });
        }
      }
    } catch (error) {
        console.error('Login error:', error);
        toast({
          variant: 'destructive',
          title: 'Erro de Autenticação',
          description: 'Ocorreu um erro ao verificar suas credenciais. Tente novamente.',
        });
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Serviço de autenticação indisponível.',
      });
      return;
    }
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email Obrigatório',
        description:
          'Por favor, insira seu email no campo acima para redefinir a senha.',
      });
      return;
    }

    setIsLoadingEmail(true);
    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);

      if (signInMethods.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Usuário não cadastrado',
          description: "O e-mail informado não foi encontrado. Por favor, clique em 'Criar novo usuário' para se registrar.",
        });
      } else {
        await sendPasswordResetEmail(auth, email);
        toast({
          title: 'Email de Redefinição Enviado',
          description: `Um link para redefinir sua senha foi enviado para ${email}. Verifique sua caixa de entrada e spam.`,
        });
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Enviar Email',
        description:
          'Não foi possível enviar o email de redefinição. Tente novamente mais tarde.',
      });
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Serviços Firebase indisponíveis.',
      });
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    setIsLoadingGoogle(true);
    if (isMobile) {
      signInWithRedirect(auth, provider); // Use redirect for mobile
    } else {
      try {
        const result = await signInWithPopup(auth, provider);
        const loginSuccessful = await processGoogleUser(result.user);
        if (loginSuccessful) {
          router.replace('/dashboard');
        }
      } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
          console.error('Google Sign-In popup error:', error);
          toast({
            variant: 'destructive',
            title: 'Erro no Login com Google',
            description: `Ocorreu um erro: ${error.code} - ${error.message}.`,
          });
        }
      } finally {
        setIsLoadingGoogle(false);
      }
    }
  };

  const handleOpenRegisterDialog = () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email Obrigatório',
        description: 'Por favor, insira seu email no campo de email para iniciar o cadastro.',
      });
      return;
    }
    if (
      !email.endsWith('@mensa.org.br') &&
      !email.endsWith('@assembleia.dev')
    ) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description:
          'Apenas emails do domínio @mensa.org.br ou de teste são permitidos para cadastro.',
      });
      return;
    }
    setIsRegisterDialogOpen(true);
  };

  const isLoading = isLoadingEmail || isLoadingGoogle || isMobile === undefined;

  if (isProcessingRedirect || (isUserLoading && !user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="https://mensa.org.br/images/Mensa-logo.png"
              alt="Mensa Brasil Logo"
              width={48}
              height={48}
            />
          </div>
          <CardTitle className="text-2xl">Assembleia Mensa Brasil</CardTitle>
          <CardDescription>Acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@mensa.org.br"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-xs"
                  onClick={handlePasswordReset}
                  disabled={isLoading}
                >
                  Esqueci minha senha
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoadingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
          
          <Button
            variant="outline"
            className="w-full"
            type="button"
            disabled={isLoading}
            onClick={handleOpenRegisterDialog}
          >
            Criar novo usuário
          </Button>

          {!isMobile && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                disabled={isLoading}
                onClick={handleGoogleLogin}
              >
                {isLoadingGoogle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icons.google className="h-4 w-4" />
                )}
                Entrar com Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <RegisterDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        email={email}
      />
    </div>
  );
}
