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
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { convertToEmbedUrl } from '@/lib/utils';

const assemblySchema = z.object({
  title: z.string().min(10, 'O título deve ter pelo menos 10 caracteres.'),
  description: z.string().min(20, 'A descrição deve ter pelo menos 20 caracteres.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida.',
  }),
  youtubeUrl: z.string().min(11, 'URL ou ID do YouTube inválido.'),
  zoomMeetingId: z.string().optional(),
});

export default function CreateAssemblyPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof assemblySchema>>({
    resolver: zodResolver(assemblySchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      youtubeUrl: '',
      zoomMeetingId: '',
    },
  });

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAdminLoading, router]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          variant: 'destructive',
          title: 'Imagem muito grande',
          description: 'Por favor, selecione um arquivo com menos de 2MB.',
        });
        event.target.value = ''; // Reset input
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast({
          variant: 'destructive',
          title: 'Erro ao processar imagem',
          description: 'Não foi possível ler o arquivo da imagem.',
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const onSubmit = async (values: z.infer<typeof assemblySchema>) => {
    if (!isAdmin || !user) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description: 'Você não tem permissão para criar assembleias.',
      });
      return;
    }
    
    if (!imagePreview) {
      toast({
        variant: 'destructive',
        title: 'Imagem obrigatória',
        description: 'Por favor, faça o upload de uma imagem de capa.',
      });
      return;
    }

    const embedUrl = convertToEmbedUrl(values.youtubeUrl);
    const zoomUrl = values.zoomMeetingId ? `https://zoom.us/wc/join/${values.zoomMeetingId.replace(/\s/g, '')}` : '';

    const { zoomMeetingId, ...restOfValues } = values;

    const assembliesRef = collection(firestore, 'assemblies');
    addDocumentNonBlocking(assembliesRef, {
      ...restOfValues,
      date: new Date(values.date),
      imageUrl: imagePreview,
      youtubeUrl: embedUrl,
      zoomUrl: zoomUrl,
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
             <FormItem>
              <FormLabel>Imagem de Capa</FormLabel>
              <FormControl>
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleImageChange}
                  disabled={form.formState.isSubmitting || isUploading}
                />
              </FormControl>
              <FormDescription>
                Selecione uma imagem para a capa da assembleia (máximo 2MB).
              </FormDescription>
              <FormMessage />
            </FormItem>
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {imagePreview && !isUploading && (
              <div className="relative aspect-video w-full max-w-lg overflow-hidden rounded-md border">
                <Image src={imagePreview} alt="Pré-visualização da imagem" fill className="object-cover" />
              </div>
            )}
            <FormField
              control={form.control}
              name="youtubeUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link ou ID do Vídeo do YouTube</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                  </FormControl>
                   <FormDescription>
                    Cole qualquer link do YouTube (de vídeo, ao vivo ou de incorporação) ou apenas o ID do vídeo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zoomMeetingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID da Reunião do Zoom (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apenas o ID numérico da reunião" {...field} />
                  </FormControl>
                  <FormDescription>
                    ID da reunião do Zoom para a transmissão do administrador.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting || isUploading}>
              {(form.formState.isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Assembleia
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
