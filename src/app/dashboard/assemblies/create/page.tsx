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
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
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
import { saveAssemblyPrivateConfig } from '@/lib/services/zoom-access.service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { parseEmailList } from '@/lib/utils/email-list';
import { saveAuthorizedParticipants } from '@/lib/services/assembly-access.service';


const assemblySchema = z.object({
  title: z.string().min(10, 'O título deve ter pelo menos 10 caracteres.'),
  description: z.string().min(20, 'A descrição deve ter pelo menos 20 caracteres.'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida.',
  }),
  youtubeUrl: z.string().optional().or(z.literal('')),
  zoomUrl: z.string().url("Por favor, insira um link de reunião válido.").optional().or(z.literal('')),
  allowProxyVoting: z.boolean().default(false),
  maxProxiesPerUser: z.coerce.number().int().min(0, "O valor deve ser positivo.").default(2),
  ordemDoDia: z.string().optional(),
  locationAddress: z.string().optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationZip: z.string().optional(),
  locationDetails: z.string().optional(),
  accessMode: z.enum(['all_verified_members', 'restricted_email_list']).default('all_verified_members'),
  authorizedEmailsRaw: z.string().optional(),
}).refine((data) => {
  if (data.accessMode === 'restricted_email_list') {
    return !!data.authorizedEmailsRaw?.trim();
  }
  return true;
}, {
  message: 'Informe a lista de e-mails autorizados.',
  path: ['authorizedEmailsRaw'],
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

export default function CreateAssemblyPage() {
  const router = useRouter();
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


  const form = useForm<z.infer<typeof assemblySchema>>({
    resolver: zodResolver(assemblySchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      youtubeUrl: '',
      zoomUrl: '',
      allowProxyVoting: false,
      maxProxiesPerUser: 2,
      ordemDoDia: '',
      locationAddress: '',
      locationCity: '',
      locationState: '',
      locationZip: '',
      locationDetails: '',
      accessMode: 'all_verified_members',
      authorizedEmailsRaw: '',
    },
  });

  const accessMode = form.watch('accessMode');

  useEffect(() => {
    if (!isAdminLoading && user && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [user, isAdmin, isAdminLoading, router]);

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
    if (!isAdmin || !user || !firestore) {
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
        description: 'Por favor, faça o upload e recorte uma imagem de capa.',
      });
      return;
    }

    let authorizedEmails: string[] = [];
    const accessMode = values.accessMode ?? 'all_verified_members';

    if (accessMode === 'restricted_email_list') {
      const parsed = parseEmailList(values.authorizedEmailsRaw ?? '');
      if (parsed.invalidEmails.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Lista de e-mails inválida',
          description: `Corrija os seguintes e-mails: ${parsed.invalidEmails.slice(0, 5).join(', ')}${parsed.invalidEmails.length > 5 ? '...' : ''}`,
        });
        return;
      }
      if (parsed.validEmails.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Lista vazia',
          description: 'Informe ao menos um e-mail @mensa.org.br autorizado.',
        });
        return;
      }
      authorizedEmails = parsed.validEmails;
    }

    try {
        const { locationAddress, locationCity, locationState, locationZip, locationDetails, zoomUrl, authorizedEmailsRaw, ...publicValues } = values;

        const location = locationAddress && locationCity && locationState && locationZip
            ? {
                address: locationAddress,
                city: locationCity,
                state: locationState,
                zip: locationZip,
                details: locationDetails || '',
            } : null;

        const assembliesRef = collection(firestore, 'assemblies');
        const newAssemblyRef = await addDoc(assembliesRef, {
            ...publicValues,
            accessMode,
            authorizedParticipantsCount: 0,
            authorizedParticipantsUploadedAt: null,
            authorizedParticipantsUploadedBy: null,
            authorizedParticipantsImportStatus: accessMode === 'restricted_email_list' ? 'processing' : 'none',
            authorizedParticipantsImportError: null,
            ...(location && { location }),
            date: new Date(values.date),
            imageUrl: imagePreview,
            administratorId: user.uid,
            status: 'scheduled',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        await saveAssemblyPrivateConfig({
          firestore,
          assemblyId: newAssemblyRef.id,
          zoomUrl: zoomUrl || null,
        });

        if (accessMode === 'restricted_email_list') {
            try {
                await saveAuthorizedParticipants({
                    firestore,
                    assemblyId: newAssemblyRef.id,
                    emails: authorizedEmails,
                    adminId: user.uid,
                });

                await createAuditLog({
                    firestore,
                    assemblyId: newAssemblyRef.id,
                    actorId: user.uid,
                    type: 'AUTHORIZED_PARTICIPANTS_UPLOADED',
                    targetId: newAssemblyRef.id,
                    metadata: { count: authorizedEmails.length },
                });
            } catch (error: any) {
                console.error('Erro ao salvar participantes autorizados:', error);

                await updateDoc(newAssemblyRef, {
                    authorizedParticipantsImportStatus: 'failed',
                    authorizedParticipantsImportError: error?.message || 'Erro ao salvar participantes autorizados.',
                    updatedAt: serverTimestamp(),
                });

                toast({
                    variant: 'destructive',
                    title: 'Erro ao salvar lista',
                    description: 'A assembleia foi criada, mas houve erro ao salvar a lista de participantes autorizados.',
                });
                return;
            }
        }
        
        await createAuditLog({
            firestore,
            assemblyId: newAssemblyRef.id, 
            actorId: user.uid,
            type: 'ASSEMBLY_CREATED',
            targetId: newAssemblyRef.id,
            metadata: { 
              title: values.title,
              accessMode,
              authorizedParticipantsCount: authorizedEmails.length
            }
        });

        toast({
        title: 'Assembleia Criada!',
        description: 'A nova assembleia foi criada com sucesso.',
        });

        router.push('/dashboard');
    } catch (error) {
        console.error("Error creating assembly: ", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Criar',
            description: 'Não foi possível criar a assembleia. Tente novamente.',
        });
    }
  };

  if (isAdminLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
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
                    Cole o link completo de entrada da reunião do Zoom. Este link será privado e visível apenas para administradores e para quem for falar.
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
            
            <FormField
              control={form.control}
              name="accessMode"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Quem pode participar?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="space-y-2"
                    >
                      <div className="flex items-start gap-2 rounded-md border p-3">
                        <RadioGroupItem value="all_verified_members" id="access-all" className="mt-1" />
                        <Label htmlFor="access-all" className="space-y-1">
                          <span className="block font-medium">Todos os associados verificados</span>
                          <span className="block text-sm text-muted-foreground">
                            Qualquer usuário com e-mail @mensa.org.br verificado poderá acessar.
                          </span>
                        </Label>
                      </div>

                      <div className="flex items-start gap-2 rounded-md border p-3">
                        <RadioGroupItem value="restricted_email_list" id="access-restricted" className="mt-1" />
                        <Label htmlFor="access-restricted" className="space-y-1">
                          <span className="block font-medium">Apenas lista de e-mails autorizados</span>
                          <span className="block text-sm text-muted-foreground">
                            Somente os e-mails carregados poderão acessar esta assembleia.
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {accessMode === 'restricted_email_list' && (
              <FormField
                control={form.control}
                name="authorizedEmailsRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lista de e-mails autorizados</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`Cole os e-mails autorizados, um por linha.\nExemplo:\nfulano@mensa.org.br\nciclano@mensa.org.br`}
                        className="min-h-40 font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A lista será privada. E-mails podem ser separados por linha, vírgula, ponto e vírgula ou espaço.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      O número máximo de pessoas que um único membro pode representar (padrão: 2).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <Button type="submit" disabled={form.formState.isSubmitting || isUploading}>
              {(form.formState.isSubmitting || isUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Assembleia
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
      
    <Dialog open={isCropperOpen} onOpenChange={setCropperOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[625px] max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
                  style={{ maxHeight: '55dvh', maxWidth: '100%' }}
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
