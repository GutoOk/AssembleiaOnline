'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';


const proxySchema = z.object({
  assemblyId: z.string().min(1, 'Por favor, selecione uma assembleia.'),
  proxyEmail: z.string().email('Por favor, insira um email válido.'),
});

function useGrantedProxies(assemblies: Assembly[] | null) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [proxies, setProxies] = useState<Record<string, ProxyAssignment>>({});
    const [isLoading, setIsLoading] = useState(true);

    const assemblyIdsJson = useMemo(() => {
        if (!assemblies) return null;
        return JSON.stringify(assemblies.map(a => a.id).sort());
    }, [assemblies]);

    useEffect(() => {
        if (!user || !firestore || !assemblyIdsJson) {
            setProxies({});
            setIsLoading(false);
            return;
        }

        const assemblyIds = JSON.parse(assemblyIdsJson) as string[];
        if (assemblyIds.length === 0) {
            setProxies({});
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        // Reset proxies for new set of assemblies
        setProxies({});

        let initialLoadsPending = assemblyIds.length;
        if (initialLoadsPending === 0) {
            setIsLoading(false);
        }

        const unsubscribes = assemblyIds.map(assemblyId => {
            const proxyRef = doc(firestore, 'assemblies', assemblyId, 'proxies', user.uid);
            
            return onSnapshot(proxyRef, 
                (snapshot) => {
                    // Update state with new/changed profiles
                    setProxies(currentProxies => {
                        const newProxies = { ...currentProxies };
                        if (snapshot.exists()) {
                            newProxies[assemblyId] = { id: snapshot.id, ...snapshot.data() } as ProxyAssignment;
                        } else {
                            delete newProxies[assemblyId];
                        }
                        return newProxies;
                    });

                    if (initialLoadsPending > 0) {
                        initialLoadsPending--;
                        if (initialLoadsPending === 0) {
                            setIsLoading(false);
                        }
                    }
                }, 
                (error) => {
                    console.error(`Error fetching proxy for assembly ${assemblyId}:`, error);
                    if (initialLoadsPending > 0) {
                        initialLoadsPending--;
                        if (initialLoadsPending === 0) {
                            setIsLoading(false);
                        }
                    }
                }
            );
        });

        // Cleanup function to unsubscribe from all listeners.
        return () => {
            unsubscribes.forEach(unsub => unsub());
        };

    }, [assemblyIdsJson, user, firestore]);

    const proxiesArray = useMemo(() => Object.values(proxies), [proxies]);

    return { data: proxiesArray, isLoading };
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
    return query(collection(firestore, 'assemblies'), where('status', 'in', ['scheduled', 'live', 'finished']), where('allowProxyVoting', '==', true));
  }, [firestore]);

  const { data: assembliesForProxy, isLoading: areAssembliesLoading } = useCollection<Assembly>(assembliesQuery);
  const { data: grantedProxies, isLoading: areProxiesLoading } = useGrantedProxies(assembliesForProxy);
  
  const availableForGranting = useMemo(() => {
      return assembliesForProxy?.filter(a => a.status === 'scheduled');
  }, [assembliesForProxy]);

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
        const assembly = assembliesForProxy?.find(a => a.id === values.assemblyId);
        if (!assembly) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Assembleia não encontrada ou não permite procuração.' });
            return;
        }

        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('email', '==', values.proxyEmail));
        const userSnapshot = await getDocs(q);

        if (userSnapshot.empty) {
            toast({ variant: 'destructive', title: 'Usuário não encontrado', description: `Nenhum usuário encontrado com o email: ${values.proxyEmail}` });
            return;
        }

        const proxyUser = userSnapshot.docs[0];
        const proxyId = proxyUser.id;

        const maxProxies = assembly.maxProxiesPerUser ?? 4;
        const existingProxiesQuery = query(
            collection(firestore, 'assemblies', values.assemblyId, 'proxies'),
            where('proxyId', '==', proxyId),
            where('status', '==', 'active')
        );
        const existingProxiesSnapshot = await getDocs(existingProxiesQuery);
        
        if (existingProxiesSnapshot.size >= maxProxies) {
            toast({ 
                variant: 'destructive', 
                title: 'Limite Atingido', 
                description: `${proxyUser.data().name} já atingiu o limite de ${maxProxies} procurações para esta assembleia.` 
            });
            return;
        }

        const proxyRef = doc(firestore, 'assemblies', values.assemblyId, 'proxies', user.uid);
        
        const data: Omit<ProxyAssignment, 'id'> = {
            assemblyId: values.assemblyId,
            grantorId: user.uid,
            proxyId: proxyId,
            status: 'active',
            createdAt: serverTimestamp() as any,
        };
        
        setDocumentNonBlocking(proxyRef, data, { merge: true });

        toast({ title: 'Procuração Concedida!', description: `Você concedeu procuração para ${proxyUser.data().name}.` });
        form.reset();

    } catch (error) {
        console.error("Error granting proxy:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível conceder a procuração.' });
    }
  };

  const handleRevokeProxy = (assignment: ProxyAssignment) => {
      if (!firestore || !user) return;
      const proxyRef = doc(firestore, 'assemblies', assignment.assemblyId, 'proxies', assignment.grantorId);
      updateDocumentNonBlocking(proxyRef, {
          status: 'revoked',
          revokedAt: serverTimestamp(),
          revokedBy: user.uid,
      });
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
                            {availableForGranting && availableForGranting.length > 0 ? (
                                availableForGranting.map(assembly => (
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
            <CardDescription>Procurações que você concedeu. Você pode revogá-las apenas para assembleias que ainda não iniciaram.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : grantedProxies && grantedProxies.length > 0 ? (
                <div className="space-y-4">
                    {grantedProxies.map(proxy => {
                        const assembly = assembliesForProxy?.find(a => a.id === proxy.assemblyId);
                        const proxyUser = proxyUserProfiles[proxy.proxyId];
                        if (!assembly || !proxyUser) return null;
                        const isRevoked = proxy.status === 'revoked';

                        return (
                            <div key={proxy.id} className={`flex items-center justify-between rounded-lg border p-4 ${isRevoked ? 'opacity-60' : ''}`}>
                                <div>
                                    <p className="font-semibold">{assembly.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Representado por: <span className="font-medium text-foreground">{proxyUser.name}</span>
                                        {isRevoked && <Badge variant="destructive" className="ml-2">Revogada</Badge>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Data da Assembleia: {format(assembly.date.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>

                                {!isRevoked && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="icon" disabled={assembly.status !== 'scheduled'}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
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
                                )}
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
