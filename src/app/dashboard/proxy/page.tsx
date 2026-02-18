'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { Assembly, ProxyAssignment, UserProfile } from '@/lib/data';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const proxySchema = z.object({
  assemblyId: z.string().min(1, 'Por favor, selecione uma assembleia.'),
  proxyEmail: z.string().email('Por favor, insira um email válido.'),
});

function useGrantedProxies(assemblies: Assembly[] | null) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [proxies, setProxies] = useState<ProxyAssignment[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const assemblyIdsJson = useMemo(() => {
        if (!assemblies) return null;
        return JSON.stringify(assemblies.map(a => a.id).sort());
    }, [assemblies]);


    useEffect(() => {
        if (!user || !firestore || !assemblyIdsJson) {
            setProxies(null);
            setIsLoading(false);
            return;
        }

        const assemblyIds = JSON.parse(assemblyIdsJson);
        if (assemblyIds.length === 0) {
            setProxies([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const fetchProxies = async () => {
            try {
                const proxyPromises = assemblyIds.map((assemblyId: string) => {
                    const proxyRef = doc(firestore, 'assemblies', assemblyId, 'proxies', user.uid);
                    return getDoc(proxyRef);
                });

                const proxySnapshots = await Promise.all(proxyPromises);
                const foundProxies = proxySnapshots
                    .filter(snap => snap.exists())
                    .map(snap => snap.data() as ProxyAssignment);
                
                setProxies(foundProxies);
            } catch (error) {
                console.error("Error fetching granted proxies:", error);
                setProxies([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProxies();

    }, [assemblyIdsJson, user, firestore]);

    return { data: proxies, isLoading };
}


export default function ProxyPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof proxySchema>>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      assemblyId: '',
      proxyEmail: '',
    },
  });

  const assembliesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'assemblies'), where('status', '==', 'scheduled'), where('allowProxyVoting', '==', true));
  }, [firestore]);

  const { data: scheduledAssemblies, isLoading: areAssembliesLoading } = useCollection<Assembly>(assembliesQuery);
  const { data: grantedProxies, isLoading: areProxiesLoading } = useGrantedProxies(scheduledAssemblies);

  const proxyUserIds = useMemo(() => {
      if (!grantedProxies) return [];
      return grantedProxies.map(p => p.proxyId);
  }, [grantedProxies]);
  
  const { profiles: proxyUserProfiles, isLoading: areProfilesLoading } = useUserProfiles(proxyUserIds);


  const onSubmit = async (values: z.infer<typeof proxySchema>) => {
    if (!user || !firestore) return;
    
    if (user.email === values.proxyEmail) {
        toast({ variant: 'destructive', title: 'Ação inválida', description: 'Você não pode dar uma procuração para si mesmo.' });
        return;
    }

    try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('email', '==', values.proxyEmail));
        const userSnapshot = await getDocs(q);

        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: 'Usuário não encontrado', description: `Nenhum usuário encontrado com o email: ${values.proxyEmail}` });
            return;
        }

        const proxyUser = userSnapshot.docs[0];
        const proxyId = proxyUser.id;

        const proxyRef = doc(firestore, 'assemblies', values.assemblyId, 'proxies', user.uid);
        
        const data: Omit<ProxyAssignment, 'id'> & { id: string } = {
            id: user.uid,
            assemblyId: values.assemblyId,
            grantorId: user.uid,
            proxyId: proxyId,
            createdAt: serverTimestamp() as any,
        };
        
        setDocumentNonBlocking(proxyRef, data, {});

        toast({ title: 'Procuração Concedida!', description: `Você concedeu procuração para ${proxyUser.data().name}.` });
        form.reset();

    } catch (error) {
        console.error("Error granting proxy:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível conceder a procuração.' });
    }
  };

  const handleRevokeProxy = (assignment: ProxyAssignment) => {
      if (!firestore) return;
      const proxyRef = doc(firestore, 'assemblies', assignment.assemblyId, 'proxies', assignment.id);
      deleteDocumentNonBlocking(proxyRef);
      toast({ title: 'Procuração Revogada', description: 'A procuração foi revogada com sucesso.' });
  };


  const isLoading = isUserLoading || areAssembliesLoading || areProxiesLoading || areProfilesLoading;

  return (
    <div className="grid gap-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Conceder Procuração</CardTitle>
          <CardDescription>Designe outro membro para votar em seu nome em uma assembleia futura.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="assemblyId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Selecione a Assembleia</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={areAssembliesLoading}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Escolha uma assembleia agendada..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {scheduledAssemblies && scheduledAssemblies.length > 0 ? (
                                scheduledAssemblies.map(assembly => (
                                    <SelectItem key={assembly.id} value={assembly.id}>{assembly.title}</SelectItem>
                                ))
                            ) : (
                                <div className="p-4 text-sm text-muted-foreground">Nenhuma assembleia com voto por procuração agendada.</div>
                            )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              <FormField
                control={form.control}
                name="proxyEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email do Representante</FormLabel>
                    <FormControl>
                      <Input placeholder="email.do.membro@mensa.org.br" {...field} />
                    </FormControl>
                    <FormDescription>Insira o email do membro que irá lhe representar.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Conceder Procuração
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Minhas Procurações Concedidas</CardTitle>
            <CardDescription>Procurações que você concedeu para assembleias futuras. Você pode revogá-las a qualquer momento antes do início da assembleia.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : grantedProxies && grantedProxies.length > 0 ? (
                <div className="space-y-4">
                    {grantedProxies.map(proxy => {
                        const assembly = scheduledAssemblies?.find(a => a.id === proxy.assemblyId);
                        const proxyUser = proxyUserProfiles[proxy.proxyId];
                        if (!assembly || !proxyUser) return null; // Only show for scheduled assemblies

                        return (
                            <div key={proxy.id} className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <p className="font-semibold">{assembly.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Representado por: <span className="font-medium text-foreground">{proxyUser.name}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Data da Assembleia: {format(assembly.date.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revogar Procuração?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja revogar esta procuração? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRevokeProxy(proxy)}>Revogar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center p-8">Você não concedeu nenhuma procuração.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
