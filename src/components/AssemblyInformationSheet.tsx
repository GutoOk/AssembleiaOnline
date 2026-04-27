'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, FileText, Calendar, Clock, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { useAdmin } from '@/hooks/use-admin';
import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function AssemblyInformationSheet() {
  const context = useAssemblyContext();
  const { isAdmin } = useAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [zoomUrl, setZoomUrl] = useState('');
  const [ordemDoDia, setOrdemDoDia] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!context) return null;
  const { isInfoSheetOpen, setIsInfoSheetOpen, assembly, assemblyPrivateConfig } = context;

  useEffect(() => {
    if (assembly) {
      setYoutubeUrl(assembly.youtubeUrl || '');
      setOrdemDoDia(assembly.ordemDoDia || '');
    }
    if (assemblyPrivateConfig) {
      setZoomUrl(assemblyPrivateConfig.zoomUrl || '');
    }
  }, [assembly, assemblyPrivateConfig]);

  if (!assembly) return null;

  const handleSaveChanges = async () => {
    if (!firestore || !assembly) return;
    setIsSaving(true);
    
    const publicData = {
      youtubeUrl,
      ordemDoDia,
      updatedAt: serverTimestamp(),
    };
    const privateData = {
      zoomUrl,
    };
    
    const assemblyRef = doc(firestore, 'assemblies', assembly.id);
    const privateConfigRef = doc(firestore, 'assemblies', assembly.id, 'private', 'config');

    try {
      await updateDoc(assemblyRef, publicData);
      await setDoc(privateConfigRef, privateData, { merge: true });

      toast({
        title: 'Informações Atualizadas',
        description: 'Os links e a ordem do dia foram salvos.',
      });
      setIsInfoSheetOpen(false);
    } catch (error) {
      console.error('Error saving assembly info:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Salvar',
        description: 'Não foi possível salvar as alterações.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const assemblyDate = assembly.date.toDate();
  const assemblyFinished = assembly.status === 'finished';

  return (
    <Sheet open={isInfoSheetOpen} onOpenChange={setIsInfoSheetOpen}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Informações da Assembleia</SheetTitle>
          <SheetDescription>{assembly.title}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
            <div className="p-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                    <span>{format(assemblyDate, "eeee, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                    <span>Início às {format(assemblyDate, "HH:mm", { locale: ptBR })}</span>
                </div>
                {assembly.location && (
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                        <div>
                            <p>{assembly.location.address}, {assembly.location.city} - {assembly.location.state}</p>
                            {assembly.location.details && <p className="text-xs text-muted-foreground">{assembly.location.details}</p>}
                        </div>
                    </div>
                )}
                
                <Separator />

                {isAdmin && !assemblyFinished ? (
                  <div className="space-y-4">
                     <div>
                        <Label htmlFor="youtubeUrl" className="text-sm font-medium">Link do YouTube</Label>
                        <Input
                            id="youtubeUrl"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="mt-1"
                        />
                     </div>
                     <div>
                        <Label htmlFor="zoomUrl" className="text-sm font-medium">Link da Reunião do Zoom</Label>
                        <Input
                            id="zoomUrl"
                            value={zoomUrl}
                            onChange={(e) => setZoomUrl(e.target.value)}
                            placeholder="https://zoom.us/j/..."
                            className="mt-1"
                        />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="ordemDoDia" className="font-semibold flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Ordem do Dia</Label>
                       <Textarea
                         id="ordemDoDia"
                         value={ordemDoDia}
                         onChange={(e) => setOrdemDoDia(e.target.value)}
                         className="text-muted-foreground whitespace-pre-wrap"
                         rows={8}
                       />
                     </div>
                  </div>
                ) : (
                  assembly.ordemDoDia ? (
                    <div className="space-y-2">
                       <h3 className="font-semibold flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Ordem do Dia</h3>
                       <div className="text-muted-foreground whitespace-pre-wrap pl-6">{assembly.ordemDoDia}</div>
                    </div>
                  ) : null
                )}
                
            </div>
        </ScrollArea>
        {isAdmin && !assemblyFinished && (
          <div className="p-6 border-t">
            <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
