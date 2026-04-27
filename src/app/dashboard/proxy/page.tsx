'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
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
import { createAuditLog } from '@/lib/services/audit.service';


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
    
    try {
        const assembly = assembliesForProxy?.find(a => a.id === values.assemblyId);
        if (!assembly) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Assembleia não encontrada ou não permite procuração.' });
            return;
        }

        if (assembly.status !== 'scheduled') {
            toast({
              variant: 'destructive',
              title: 'Procuração travada',
              description:
                'Procurações só podem ser concedidas antes do início da assembleia.',
            });
            return;
        }
        
        const normalizedProxyEmail = values.proxyEmail.trim().toLowerCase();
        const memberEmailRef = doc(firestore, 'memberEmails', normalizedProxyEmail);
        const memberEmailSnap = await getDoc(memberEmailRef);

        if (!memberEmailSnap.exists()) {
            toast({ variant: 'destructive', title: 'Usuário não encontrado', description: `Nenhum usuário encontrado com o email: ${values.proxyEmail}` });
            return;
        }

        const proxyUserData = memberEmailSnap.data();
        const proxyId = proxyUserData.uid;
        const proxyName = proxyUserData.name;

        if (proxyId === user.uid) {
            toast({ variant: 'destructive', title: 'Ação inválida', description: 'Você não pode dar uma procuração para si mesmo.' });
            return;
        }

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
                description: `${proxyName} já atingiu o limite de ${maxProxies} procurações para esta assembleia.` 
            });
            return;
        }

        const proxyRef = doc(firestore, 'assemblies', values.assemblyId, 'proxies', user.uid);
        const existingProxySnap = await getDoc(proxyRef);

        const data = {
            assemblyId: values.assemblyId,
            grantorId: user.uid,
            proxyId,
            status: 'active' as const,
            updatedAt: serverTimestamp(),
            ...(existingProxySnap.exists() ? {} : { createdAt: serverTimestamp() }),
            revokedAt: null,
            revokedBy: null,
        };
        
        await setDoc(proxyRef, data, { merge: true });
        
        await createAuditLog({
            firestore,
            assemblyId: values.assemblyId,
            actorId: user.uid,
            type: 'PROXY_GRANTED',
            targetId: proxyId,
            metadata: { proxyEmail: normalizedProxyEmail }
        });

        toast({ title: 'Procuração Concedida!', description: `Você concedeu procuração para ${proxyName}.` });
        form.reset();

    } catch (error) {
        console.error("Error granting proxy:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível conceder a procuração.' });
    }
  };

  const handleRevokeProxy = async (assignment: ProxyAssignment) => {
    if (!firestore || !user) return;

    const assembly = assembliesForProxy?.find(
        (item) => item.id === assignment.assemblyId
    );

    if (assembly?.status !== 'scheduled') {
        toast({
        variant: 'destructive',
        title: 'Procuração travada',
        description: 'Procurações só podem ser alteradas antes do início da assembleia.',
        });
        return;
    }
  
    try {
      const proxyRef = doc(
        firestore,
        'assemblies',
        assignment.assemblyId,
        'proxies',
        assignment.grantorId
      );
  
      await updateDoc(proxyRef, {
        status: 'revoked',
        revokedAt: serverTimestamp(),
        revokedBy: user.uid,
      });
      
      await createAuditLog({
          firestore,
          assemblyId: assignment.assemblyId,
          actorId: user.uid,
          type: 'PROXY_REVOKED',
          targetId: assignment.proxyId,
      });
  
      toast({
        title: 'Procuração Revogada',
        description: 'A procuração foi revogada com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao revogar procuração:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao revogar procuração',
        description: 'A revogação não foi confirmada pelo servidor.',
      });
    }
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
                        const canRevoke = !isRevoked && assembly.status === 'scheduled';
                        const isLocked = !isRevoked && assembly.status !== 'scheduled';

                        return (
                            <div key={proxy.id} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${isRevoked ? 'bg-muted/50' : ''}`}>
                                <div>
                                    <p className="font-semibold">{assembly.title}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        Representado por: <span className="font-medium text-foreground">{proxyUser.name}</span>
                                        {isRevoked && <Badge variant="secondary" className="ml-2">Revogada</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Data da Assembleia: {format(assembly.date.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2 self-end sm:self-center">
                                    {canRevoke && (
                                        <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Trash2 className="h-4 w-4" />
                                                Revogar
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Revogar procuração?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação só pode ser feita antes do início da assembleia.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleRevokeProxy(proxy)}>Revogar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                        </AlertDialog>
                                    )}

                                    {isLocked && (
                                        <Badge variant="outline">
                                            Procuração travada após início
                                        </Badge>
                                    )}
                                </div>
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
