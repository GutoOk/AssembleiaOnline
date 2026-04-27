'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useParams, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/hooks/use-admin';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { Assembly } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { createAuditLog } from '@/lib/services/audit.service';

const assemblySchema = z.object({
  title: z.string().min(10, 'O título deve ter pelo menos 10 caracteres.'),
  description: z.string().min(20, 'A descrição deve ter pelo menos 20 caracteres.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida.',
  }),
  youtubeUrl: z.string().optional().or(z.literal('')),
  zoomUrl: z.string().url("Por favor, insira um link de reunião válido.").optional().or(z.literal('')),
  allowProxyVoting: z.boolean().default(false),
  maxProxiesPerUser: z.coerce.number().int().min(0, "O valor deve ser positivo.").default(4),
  ordemDoDia: z.string().optional(),
  locationAddress: z.string().optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationZip: z.string().optional(),
  locationDetails: z.string().optional(),
});

// Helper function for cropping
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function EditAssemblyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State for image cropper
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropperOpen, setCropperOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);


  const assemblyRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'assemblies', params.id);
  }, [firestore, params.id]);

  const { data: assembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);
  const isFinished = assembly?.status === 'finished';

  const form = useForm<z.infer<typeof assemblySchema>>({
    resolver: zodResolver(assemblySchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      youtubeUrl: '',
      zoomUrl: '',
      allowProxyVoting: false,
      maxProxiesPerUser: 4,
      ordemDoDia: '',
      locationAddress: '',
      locationCity: '',
      locationState: '',
      locationZip: '',
      locationDetails: '',
    },
  });

  useEffect(() => {
    if (!isAdminLoading && user && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [user, isAdmin, isAdminLoading, router]);

  // When assembly data loads, populate the form
  useEffect(() => {
    if (assembly) {
        const assemblyDate = assembly.date.toDate();
        // Format date to 'YYYY-MM-DDTHH:mm' for the datetime-local input
        const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        const localISOTime = (new Date(assemblyDate.getTime() - tzoffset)).toISOString().slice(0, 16);

      form.reset({
        title: assembly.title,
        description: assembly.description,
        date: localISOTime,
        youtubeUrl: assembly.youtubeUrl || '',
        zoomUrl: assembly.zoomUrl || '',
        allowProxyVoting: assembly.allowProxyVoting || false,
        maxProxiesPerUser: assembly.maxProxiesPerUser || 4,
        ordemDoDia: assembly.ordemDoDia || '',
        locationAddress: assembly.location?.address || '',
        locationCity: assembly.location?.city || '',
        locationState: assembly.location?.state || '',
        locationZip: assembly.location?.zip || '',
        locationDetails: assembly.location?.details || '',
      });
      setImagePreview(assembly.imageUrl);
    }
  }, [assembly, form]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          variant: 'destructive',
          title: 'Imagem muito grande',
          description: 'Por favor, selecione um arquivo com menos de 5MB.',
        });
        event.target.value = ''; // Reset input
        return;
      }
      setIsUploading(true);
      setCrop(undefined); // Reset crop
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setCropperOpen(true);
        setIsUploading(false);
      });
      reader.readAsDataURL(file);
      event.target.value = ''; // Reset file input
    }
  };
  
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
      imgRef.current = e.currentTarget;
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, 16 / 9));
  }
  
  const handleApplyCrop = async () => {
      if (completedCrop && imgRef.current) {
          const canvas = document.createElement('canvas');
          const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
          const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
          canvas.width = completedCrop.width;
          canvas.height = completedCrop.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
              toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível processar a imagem.' });
              return;
          }

          ctx.drawImage(
              imgRef.current,
              completedCrop.x * scaleX,
              completedCrop.y * scaleY,
              completedCrop.width * scaleX,
              completedCrop.height * scaleY,
              0,
              0,
              completedCrop.width,
              completedCrop.height
          );

          // Compress to JPEG with 80% quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setImagePreview(compressedDataUrl);
          setCropperOpen(false);
          setImgSrc('');
      }
  };
  
  const onSubmit = async (values: z.infer<typeof assemblySchema>) => {
    if (!isAdmin || !user || !assemblyRef || !firestore || !assembly) {
      toast({
        variant: 'destructive',
        title: 'Acesso Negado',
        description: 'Você não tem permissão para editar assembleias.',
      });
      return;
    }
    
    if (!imagePreview) {
      toast({
        variant: 'destructive',
        title: 'Imagem obrigatória',
        description: 'Por favor, mantenha ou faça o upload de uma imagem de capa.',
      });
      return;
    }
    
    try {
        const { locationAddress, locationCity, locationState, locationZip, locationDetails, ...restOfValues } = values;

        const location = locationAddress && locationCity && locationState && locationZip
            ? {
                address: locationAddress,
                city: locationCity,
                state: locationState,
                zip: locationZip,
                details: locationDetails || '',
            } : null;

        const dataToUpdate: any = {
            ...restOfValues,
            date: new Date(values.date),
            imageUrl: imagePreview,
            updatedAt: serverTimestamp(),
        };
        
        dataToUpdate.location = location;

        await updateDoc(assemblyRef, dataToUpdate);
        
        await createAuditLog({
            firestore,
            assemblyId: assembly.id,
            actorId: user.uid,
            type: 'ASSEMBLY_UPDATED',
            targetId: assembly.id,
            metadata: { updatedFields: Object.keys(values) }
        });

        toast({
        title: 'Assembleia Atualizada!',
        description: 'A assembleia foi atualizada com sucesso.',
        });

        router.push('/dashboard');
    } catch (error) {
        console.error("Error updating assembly:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Atualizar',
            description: 'Não foi possível salvar as alterações. Tente novamente.',
        });
    }
  };

  const isLoading = isAdminLoading || isAssemblyLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }

  if (!assembly) {
      return notFound();
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Editar Assembleia</CardTitle>
        <CardDescription>
          {isFinished
            ? 'Esta assembleia foi finalizada e não pode mais ser editada.'
            : 'Atualize os detalhes abaixo para esta assembleia.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <fieldset disabled={isFinished || form.formState.isSubmitting || isUploading}>
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
                    <FormLabel>Data e Hora Previstas</FormLabel>
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
                  Selecione uma imagem para a capa. Você poderá cortá-la em seguida (máx 5MB).
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
                    <FormLabel>Link ou ID do Vídeo do YouTube (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                    </FormControl>
                     <FormDescription>
                      Cole o link ou ID do vídeo do YouTube para a transmissão.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zoomUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link da Reunião do Zoom (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://zoom.us/j/..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Cole o link completo de entrada da reunião do Zoom.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ordemDoDia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem do Dia</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Liste os tópicos a serem discutidos..." {...field} rows={5} />
                    </FormControl>
                    <FormDescription>
                      Descreva a pauta da assembleia. Cada tópico pode ser separado por uma nova linha.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-6" />

              <div className="space-y-4">
                  <div className='space-y-1'>
                      <h3 className="text-lg font-medium">Local Físico (Opcional)</h3>
                      <p className="text-sm text-muted-foreground">Preencha se a assembleia for híbrida e tiver um local para participação presencial.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="locationAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input placeholder="Av. Paulista, 123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="São Paulo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input placeholder="SP" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="locationZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input placeholder="01311-000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  </div>
                  <FormField
                    control={form.control}
                    name="locationDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detalhes Adicionais do Local</FormLabel>
                        <FormControl>
                          <Input placeholder="Andar, sala, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              <Separator className="my-6" />

              <FormField
                  control={form.control}
                  name="allowProxyVoting"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Permitir Voto por Procuração</FormLabel>
                        <FormDescription>
                          Permite que membros designem outros para votar em seu nome.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxProxiesPerUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máximo de Representados por Pessoa</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        O número máximo de pessoas que um único membro pode representar (padrão: 4).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <div className="flex gap-2">
                  <Button type="submit" disabled={isFinished || form.formState.isSubmitting || isUploading}>
                  {(form.formState.isSubmitting || isUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Alterações
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                      {isFinished ? 'Voltar' : 'Cancelar'}
                  </Button>
              </div>
            </form>
          </fieldset>
        </Form>
      </CardContent>
    </Card>
    
    <Dialog open={isCropperOpen} onOpenChange={setCropperOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Recortar Imagem</DialogTitle>
            <DialogDescriptionComponent>
              Ajuste a imagem para a capa da assembleia (16:9).
            </DialogDescriptionComponent>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
                minWidth={320}
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '70vh' }}
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCropperOpen(false); setImgSrc(''); }}>Cancelar</Button>
            <Button type="button" onClick={handleApplyCrop} disabled={!completedCrop}>Aplicar Recorte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
