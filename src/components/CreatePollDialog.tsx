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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Assembly, Poll } from '@/lib/data';
import { Separator } from './ui/separator';
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const pollSchema = z.object({
  question: z.string().min(10, 'A pergunta deve ter pelo menos 10 caracteres.'),
  duration: z.coerce.number().min(1, 'A duração deve ser de pelo menos 1 minuto.'),
  type: z.enum(['proposal', 'opinion']),
  options: z.array(z.object({
    text: z.string().min(1, 'O texto da opção não pode estar vazio.'),
  })).min(1, 'A votação deve ter pelo menos 1 opção.'),
  quorumType: z.enum(['simple_majority', 'absolute_majority', 'two_thirds_majority']).optional(),
  totalActiveMembers: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'proposal') {
        if (!data.quorumType) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Selecione o quórum de aprovação.',
                path: ['quorumType'],
            });
        }
        if (data.quorumType === 'absolute_majority' && (!data.totalActiveMembers || data.totalActiveMembers <= 0)) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'O número total de associados ativos é obrigatório para Maioria Absoluta.',
                path: ['totalActiveMembers'],
            });
        }
    }
});


interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly;
}

export function CreatePollDialog({ open, onOpenChange, assembly }: CreatePollDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [pollDataToConfirm, setPollDataToConfirm] = useState<z.infer<typeof pollSchema> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<z.infer<typeof pollSchema>>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: '',
      duration: 5,
      type: 'proposal',
      options: [{ text: 'A favor' }, { text: 'Contra' }, { text: 'Abstenção' }],
      quorumType: 'simple_majority',
    },
  });
  
  const watchedPollType = form.watch('type');

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options"
  });

  useEffect(() => {
    if (open) {
      form.reset({
        question: '',
        duration: 5,
        type: 'proposal',
        options: [{ text: 'A favor' }, { text: 'Contra' }, { text: 'Abstenção' }],
        quorumType: 'simple_majority',
        totalActiveMembers: undefined
      });
    }
  }, [open, form]);
  
  useEffect(() => {
    form.clearErrors();
    if (watchedPollType === 'proposal') {
      form.setValue('options', [{ text: 'A favor' }, { text: 'Contra' }, { text: 'Abstenção' }]);
      if (!form.getValues('quorumType')) {
        form.setValue('quorumType', 'simple_majority');
      }
    } else if (watchedPollType === 'opinion') {
      form.setValue('options', [{ text: '' }]);
      form.setValue('quorumType', undefined);
      form.setValue('totalActiveMembers', undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPollType]);


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
      
      const pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'endDate' | 'status'> & { endDate: Timestamp; status: 'open'; createdAt: any } = {
        question: values.question,
        endDate: Timestamp.fromMillis(Date.now() + values.duration * 60 * 1000),
        status: 'open' as const,
        createdAt: serverTimestamp(),
        assemblyId: assembly.id,
        administratorId: assembly.administratorId,
        assemblyStatus: assembly.status,
        type: values.type,
      };

      if (values.type === 'proposal') {
          pollData.quorumType = values.quorumType;
          if (values.quorumType === 'absolute_majority' && values.totalActiveMembers) {
              pollData.totalActiveMembers = values.totalActiveMembers;
          }
      }
      
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
          createdAt: serverTimestamp(),
        };
        return addDocumentNonBlocking(optionsRef, optionData);
      });
      
      await Promise.all(optionPromises);

      toast({
        title: 'Votação Criada!',
        description: 'A nova votação já está disponível para os participantes.',
      });
      form.reset();
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
  
  const handleDialogStateChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };


  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogStateChange}>
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
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Tipo de Votação</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="proposal" id="proposal" />
                          </FormControl>
                          <FormLabel htmlFor="proposal" className="font-normal">
                            Votação de Proposta
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <RadioGroupItem value="opinion" id="opinion" />
                          </FormControl>
                          <FormLabel htmlFor="opinion" className="font-normal">
                            Consulta de Opinião
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
              
              {watchedPollType === 'proposal' && (
                <>
                 <FormField
                    control={form.control}
                    name="quorumType"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Quórum de Aprovação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o quórum" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="simple_majority">Maioria Simples</SelectItem>
                                    <SelectItem value="absolute_majority">Maioria Absoluta</SelectItem>
                                    <SelectItem value="two_thirds_majority">2/3 dos Votantes</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                  />
                  {form.watch('quorumType') === 'absolute_majority' && (
                      <FormField
                          control={form.control}
                          name="totalActiveMembers"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Total de Associados Ativos</FormLabel>
                                  <FormControl>
                                      <Input type="number" placeholder="Ex: 500" {...field} value={field.value ?? ''} />
                                  </FormControl>
                                  <FormDescription>Necessário para o cálculo de maioria absoluta.</FormDescription>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                  )}
                </>
              )}

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
                              <Input {...field} readOnly={watchedPollType === 'proposal'} />
                            </FormControl>
                            {watchedPollType === 'opinion' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                disabled={fields.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Remover opção</span>
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                {watchedPollType === 'opinion' && (
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
                )}
                  <FormMessage>{form.formState.errors.options?.root?.message || form.formState.errors.options?.message}</FormMessage>
              </div>

              <DialogFooter>
                 <DialogClose asChild>
                  <Button type="button" variant="secondary">
                      Cancelar
                  </Button>
                 </DialogClose>
                <Button type="submit">
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
