'use client';

import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Assembly } from '@/lib/data';
import { Separator } from './ui/separator';
import React, { useState, useEffect } from 'react';

const pollSchema = z.object({
  question: z.string().min(10, 'A pergunta deve ter pelo menos 10 caracteres.'),
  duration: z.coerce.number().min(1, 'A duração deve ser de pelo menos 1 minuto.'),
  options: z.array(z.object({
    text: z.string().min(1, 'O texto da opção não pode estar vazio.'),
  })).min(2, 'A votação deve ter pelo menos 2 opções.'),
});

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly;
  initialQuestion?: string;
  onSuccess?: () => void;
}

export function CreatePollDialog({ open, onOpenChange, assembly, initialQuestion, onSuccess }: CreatePollDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pollDataToConfirm, setPollDataToConfirm] = useState<z.infer<typeof pollSchema> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<z.infer<typeof pollSchema>>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: '',
      duration: 5,
      options: [{ text: 'Sim' }, { text: 'Não' }, { text: 'Abstenção' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options"
  });

  useEffect(() => {
    if (open && initialQuestion) {
      form.setValue('question', initialQuestion);
    }
  }, [open, initialQuestion, form]);


  const onSubmit = (values: z.infer<typeof pollSchema>) => {
    setPollDataToConfirm(values);
  };

  const handleCreatePoll = async () => {
    if (!pollDataToConfirm || !assembly) return;

    setIsCreating(true);
    const values = pollDataToConfirm;

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

      // 2. Create Poll Options from form
      const optionsRef = collection(firestore, 'assemblies', assembly.id, 'polls', pollDocRef.id, 'options');
      const optionPromises = values.options.map(option => {
        const optionData = {
          text: option.text,
          pollId: pollDocRef.id,
          assemblyId: assembly.id,
          assemblyStatus: assembly.status,
        };
        return addDocumentNonBlocking(optionsRef, optionData);
      });
      
      await Promise.all(optionPromises);

      toast({
        title: 'Votação Criada!',
        description: 'A nova votação já está disponível para os participantes.',
      });
      form.reset({
        question: '',
        duration: 5,
        options: [{ text: 'Sim' }, { text: 'Não' }, { text: 'Abstenção' }],
      });
      onSuccess?.();
      onOpenChange(false); // Close main dialog
    } catch (error) {
      console.error("Error creating poll:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar votação',
        description: 'Não foi possível criar a votação. Tente novamente.',
      });
    } finally {
        setIsCreating(false);
        setPollDataToConfirm(null); // Close confirmation dialog
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          form.reset({
            question: '',
            duration: 5,
            options: [{ text: 'Sim' }, { text: 'Não' }, { text: 'Abstenção' }],
          });
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Votação</DialogTitle>
            <DialogDescription>
              Defina a pergunta, a duração e as opções de resposta para a votação.
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

              <Separator />
              
              <div className="space-y-2">
                <FormLabel>Opções de Resposta</FormLabel>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`options.${index}.text`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 2}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Remover opção</span>
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => append({ text: '' })}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Adicionar Opção
                  </Button>
                  <FormMessage>{form.formState.errors.options?.root?.message}</FormMessage>
              </div>

              <DialogFooter>
                 <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>
                      Cancelar
                  </Button>
                 </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Publicar Votação
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!pollDataToConfirm} onOpenChange={(open) => !open && setPollDataToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar Votação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja iniciar esta votação? Uma vez iniciada, os membros poderão votar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPollDataToConfirm(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreatePoll} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Publicar Votação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
