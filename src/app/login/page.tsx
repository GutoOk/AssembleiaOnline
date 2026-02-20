'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
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
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { Icons } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';


export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  const [isLoadingMock, setIsLoadingMock] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const isMobile = useIsMobile();

  const processGoogleUser = useCallback(async (firebaseUser: FirebaseUser): Promise<boolean> => {
    if (!firestore || !auth) return false;
    try {
        if (firebaseUser.email && !firebaseUser.email.endsWith('@mensa.org.br')) {
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
            const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Novo Usuário';
            const userProfile: UserProfile = {
                id: firebaseUser.uid,
                name: name,
                email: firebaseUser.email!,
                avatarDataUri: firebaseUser.photoURL || `https://avatar.vercel.sh/${firebaseUser.uid}.svg`,
                createdAt: serverTimestamp() as any,
            };
            await setDoc(userDocRef, userProfile);
        }
        return true;
    } catch (error: any) {
        console.error("Error processing Google user:", error);
        toast({
            variant: 'destructive',
            title: 'Erro de Processamento',
            description: error.message || 'Não foi possível configurar o perfil do usuário.',
        });
        if (auth.currentUser) {
            await auth.signOut();
        }
        return false;
    }
  }, [auth, firestore, toast]);

  // This effect handles the result from the redirect login flow
  useEffect(() => {
    if (auth) {
        getRedirectResult(auth)
            .then(async (result) => {
                if (result?.user) {
                    await processGoogleUser(result.user);
                }
            })
            .catch((error) => {
                console.error("Google Sign-In redirect error:", error);
                toast({
                    variant: 'destructive',
                    title: 'Erro no Login com Google',
                    description: error.message || 'Não foi possível completar o login. Tente novamente.',
                });
            })
            .finally(() => {
                setIsProcessingRedirect(false);
            });
    } else {
        setIsProcessingRedirect(false);
    }
  }, [auth, processGoogleUser, toast]);

  // This effect handles navigation AFTER the user state is confirmed and any redirect is processed.
  useEffect(() => {
    if (!isProcessingRedirect && !isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, isProcessingRedirect, router]);

  const handleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !auth) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível conectar ao banco de dados.' });
        return;
    }
    setIsLoadingMock(true);

    const value = userInput.toLowerCase().trim();
    let email, password;

    if (value === 'admin') {
      email = 'admin@assembleia.dev';
      password = 'password123';
    } else if (value === 'associado') {
      email = 'member@assembleia.dev';
      password = 'password123';
    } else {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description: "Usuário inválido. Digite 'admin' ou 'associado' para entrar.",
      });
      setIsLoadingMock(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (signInError: any) {
      if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          if (newUser) {
              await newUser.getIdToken(true);
              
              const userDocRef = doc(firestore, 'users', newUser.uid);
              const name = newUser.email?.split('@')[0] ?? 'Novo Usuário';
              const userProfile: UserProfile = {
                  id: newUser.uid,
                  name: name.charAt(0).toUpperCase() + name.slice(1),
                  email: newUser.email!,
                  avatarDataUri: `https://avatar.vercel.sh/${newUser.uid}.svg`,
                  createdAt: serverTimestamp() as any,
              };
              await setDoc(userDocRef, userProfile);
              
              if (newUser.email === 'admin@assembleia.dev') {
                const adminDocRef = doc(firestore, 'admins', newUser.uid);
                await setDoc(adminDocRef, {}); 
              }
          }
          toast({
            title: 'Conta de teste criada!',
            description: `A conta para '${value}' foi criada com sucesso.`,
          });
        } catch (signUpError: any) {
          let description = 'Não foi possível fazer o login ou criar a conta de teste.';
          if (signUpError.code === 'auth/email-already-in-use') {
            description = "O usuário de teste já existe, mas a senha está incorreta. A senha deve ser 'password123'.";
          }
          toast({
            variant: 'destructive',
            title: 'Falha no Login',
            description,
          });
        }
      } else {
        console.error('Sign-in error:', signInError);
        toast({
          variant: 'destructive',
          title: 'Erro Inesperado',
          description: 'Ocorreu um erro durante o login. Verifique sua conexão.',
        });
      }
    } finally {
      setIsLoadingMock(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Serviços Firebase indisponíveis.' });
        return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      'hd': 'mensa.org.br',
      'prompt': 'select_account'
    });

    if (isMobile) {
      signInWithRedirect(auth, provider);
    } else {
      setIsLoadingGoogle(true);
      try {
          const result = await signInWithPopup(auth, provider);
          await processGoogleUser(result.user);
      } catch (error: any) {
          if (error.code !== 'auth/popup-closed-by-user') {
            console.error("Google Sign-In popup error:", error);
            toast({
                variant: 'destructive',
                title: 'Erro no Login com Google',
                description: error.message || 'Não foi possível fazer o login. Tente novamente.',
            });
          }
      } finally {
          setIsLoadingGoogle(false);
      }
    }
  };
  
  const isLoading = isLoadingMock || isLoadingGoogle || isMobile === undefined;

  if (isProcessingRedirect || isUserLoading) {
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
              <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={48} height={48} />
            </div>
            <CardTitle className="text-2xl">Assembleia Mensa Brasil</CardTitle>
            <CardDescription>Acesso ao sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" type="button" disabled={isLoading} onClick={handleGoogleLogin}>
                {isLoadingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icons.google className="h-4 w-4" />}
                Entrar com Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou para teste
                  </span>
                </div>
              </div>
            <form onSubmit={handleMockLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-type">Usuário de Teste</Label>
                <Input
                  id="user-type"
                  type="text"
                  placeholder="Digite 'admin' ou 'associado'"
                  required
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <CardDescription className="text-center text-xs">
                Se a conta não existir, será criada com a senha 'password123'.
              </CardDescription>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoadingMock ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Entrar com conta de teste"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
    </div>
  );
}
