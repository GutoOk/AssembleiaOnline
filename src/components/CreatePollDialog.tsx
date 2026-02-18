'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Assembly } from '@/lib/data';

const pollSchema = z.object({
  question: z.string().min(10, 'A pergunta deve ter pelo menos 10 caracteres.'),
  duration: z.coerce.number().min(1, 'A duração deve ser de pelo menos 1 minuto.'),
});

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly;
}

export function CreatePollDialog({ open, onOpenChange, assembly }: CreatePollDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof pollSchema>>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: '',
      duration: 5,
    },
  });

  const onSubmit = async (values: z.infer<typeof pollSchema>) => {
    if (!assembly) return;

    try {
      // 1. Create Poll Document
      const pollsRef = collection(firestore, 'assemblies', assembly.id, 'polls');
      const pollData = {
        question: values.question,
        endDate: Timestamp.fromMillis(Date.now() + values.duration * 60 * 1000),
        status: 'open' as const,
        createdAt: serverTimestamp(),
        assemblyId: assembly.id,
        administratorId: assembly.administratorId,
        assemblyStatus: assembly.status,
      };
      
      const pollDocRef = await addDocumentNonBlocking(pollsRef, pollData);
      
      if (!pollDocRef) {
          throw new Error("Failed to create poll document.");
      }

      // 2. Create Poll Options
      const optionsRef = collection(firestore, 'assemblies', assembly.id, 'polls', pollDocRef.id, 'options');
      const options = ['Sim', 'Não', 'Abstenção'];
      
      await Promise.all(options.map(optionText => {
        const optionData = {
          text: optionText,
          pollId: pollDocRef.id,
          assemblyId: assembly.id,
          assemblyStatus: assembly.status,
        };
        return addDocumentNonBlocking(optionsRef, optionData);
      }));

      toast({
        title: 'Votação Criada!',
        description: 'A nova votação já está disponível para os participantes.',
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating poll:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar votação',
        description: 'Não foi possível criar a votação. Tente novamente.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Votação</DialogTitle>
          <DialogDescription>
            Defina a pergunta e a duração da votação. As opções serão "Sim", "Não" e "Abstenção".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ex: Você aprova a proposta X?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (em minutos)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
               <DialogClose asChild>
                <Button type="button" variant="secondary">
                    Cancelar
                </Button>
               </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Criar Votação
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
