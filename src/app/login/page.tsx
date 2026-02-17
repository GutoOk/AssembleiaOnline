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
import { signInWithEmailAndPassword } from 'firebase/auth';

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
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in provider will handle redirect
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Falha no Login',
        description: 'Credenciais não encontradas. Por favor, crie os usuários no seu painel do Firebase.',
      });
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
            Use 'admin' (email: admin@assembleia.dev) ou 'associado' (email: member@assembleia.dev). A senha para ambos é 'password123'.<br/> 
            <strong className="text-destructive">Importante:</strong> Crie estes usuários no seu painel do Firebase Authentication.
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
