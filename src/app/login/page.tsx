'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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
      setIsLoading(false);
      return;
    }

    try {
      // Try to sign in first.
      await signInWithEmailAndPassword(auth, email, password);
    } catch (signInError: any) {
      // If sign in fails, check if it's because the user doesn't exist.
      // 'auth/invalid-credential' can mean user not found OR wrong password.
      if (signInError.code === 'auth/invalid-credential') {
        try {
          // Try to create the user. This will succeed if the user does not exist.
          await createUserWithEmailAndPassword(auth, email, password);
          toast({
            title: 'Conta de teste criada!',
            description: `A conta para '${value}' foi criada com sucesso.`,
          });
        } catch (signUpError: any) {
          // This block will run if createUser fails.
          // The most likely reason is 'auth/email-already-in-use',
          // which means the user exists but the password was wrong in the first sign-in attempt.
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
        // Handle other sign-in errors (network, etc.)
        console.error('Sign-in error:', signInError);
        toast({
          variant: 'destructive',
          title: 'Erro Inesperado',
          description: 'Ocorreu um erro durante o login. Verifique sua conexão.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isUserLoading || user) {
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
             <Icons.logo className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Assembleia Mensa Brasil</CardTitle>
          <CardDescription>Acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-center mb-4">
            Use 'admin' ou 'associado'. Se a conta não existir, será criada automaticamente com a senha 'password123'.<br/> 
            <strong className="text-destructive">Importante (Admin):</strong> Após o primeiro login, crie um documento na coleção `admins` do Firestore com o UID do usuário `admin@assembleia.dev`.
          </CardDescription>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-type">Usuário</Label>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
