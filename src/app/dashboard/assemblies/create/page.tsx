'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/hooks/use-admin';
import { addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const assemblySchema = z.object({
  title: z.string().min(10, 'O título deve ter pelo menos 10 caracteres.'),
  description: z.string().min(20, 'A descrição deve ter pelo menos 20 caracteres.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida.',
  }),
  youtubeUrl: z.string().url('URL do YouTube inválida.'),
  imageUrl: z.string().url('URL da imagem inválida.'),
});

export default function CreateAssemblyPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof assemblySchema>>({
    resolver: zodResolver(assemblySchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      youtubeUrl: '',
      imageUrl: '',
    },
  });

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAdminLoading, router]);

  const onSubmit = async (values: z.infer<typeof assemblySchema>) => {
    if (!isAdmin || !user) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description: 'Você não tem permissão para criar assembleias.',
      });
      return;
    }
    
    const assembliesRef = collection(firestore, 'assemblies');
    addDocumentNonBlocking(assembliesRef, {
      ...values,
      date: new Date(values.date),
      administratorId: user.uid,
      status: 'scheduled',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    toast({
      title: 'Assembleia Criada!',
      description: 'A nova assembleia foi criada com sucesso.',
    });

    router.push('/dashboard');
  };

  if (isAdminLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0">
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Assembleia</CardTitle>
          <CardDescription>Preencha os detalhes abaixo para agendar uma nova assembleia.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Assembleia Geral Ordinária 2025" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva o propósito e a agenda da assembleia." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data e Hora</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="youtubeUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do YouTube</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.youtube.com/embed/..." {...field} />
                    </FormControl>
                     <FormDescription>
                      Use o link de incorporação (embed) do vídeo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da Imagem de Capa</FormLabel>
                    <FormControl>
                      <Input placeholder="https://images.unsplash.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Assembleia
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
