'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookText } from 'lucide-react';
import type { Assembly, AtaItem } from '@/lib/data';
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { useMemo } from 'react';

interface AtaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly;
}

const ataSchema = z.object({
  text: z.string().min(1, 'O registro não pode estar vazio.'),
});

export function AtaDialog({ open, onOpenChange, assembly }: AtaDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const ataQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'assemblies', assembly.id, 'ata'), orderBy('createdAt', 'asc'));
  }, [firestore, assembly.id]);

  const { data: ataItems, isLoading: isLoadingAta } = useCollection<AtaItem>(ataQuery);
  
  const adminIds = useMemo(() => ataItems?.map(m => m.administratorId) ?? [], [ataItems]);
  const { profiles: adminProfiles } = useUserProfiles(adminIds);


  const form = useForm<z.infer<typeof ataSchema>>({
    resolver: zodResolver(ataSchema),
    defaultValues: {
      text: '',
    },
  });

  const onSubmit = (values: z.infer<typeof ataSchema>) => {
    if (!user) return;

    const ataRef = collection(firestore, 'assemblies', assembly.id, 'ata');
    addDocumentNonBlocking(ataRef, {
      text: values.text,
      assemblyId: assembly.id,
      administratorId: user.uid,
      assemblyStatus: assembly.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    toast({
      title: 'Registro de Ata Adicionado!',
    });
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookText /> Registro da Ata</DialogTitle>
          <DialogDescription>
            Adicione e visualize os registros textuais da assembleia.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea placeholder="Digite um novo registro para a ata..." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Registro
              </Button>
            </form>
          </Form>
          
          <Separator />

          <div className="space-y-4 max-h-64 overflow-y-auto pr-4">
             {isLoadingAta && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
             {ataItems && ataItems.length > 0 ? (
                ataItems.map(ataItem => {
                    const admin = adminProfiles[ataItem.administratorId];
                    return (
                        <div key={ataItem.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                                {admin ? (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={admin.avatarDataUri} />
                                            <AvatarFallback>{admin.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-foreground">{admin.name}</span>
                                    </div>
                                ) : <Loader2 className="h-4 w-4 animate-spin"/>}
                                <span>-</span>
                                <span>{ataItem.createdAt ? format(ataItem.createdAt.toDate(), "HH:mm", { locale: ptBR }) : ''}</span>
                            </div>
                            <p className="pl-7">{ataItem.text}</p>
                        </div>
                    )
                })
             ) : (
                !isLoadingAta && <p className="text-sm text-center text-muted-foreground pt-4">Nenhum registro na ata ainda.</p>
             )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
