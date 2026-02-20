'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, FileText, Calendar, Clock } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

export function AssemblyInformationSheet() {
  const context = useAssemblyContext();
  if (!context) return null;
  const { isInfoSheetOpen, setIsInfoSheetOpen, assembly } = context;

  if (!assembly) return null;
  const assemblyDate = assembly.date.toDate();

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
                {assembly.ordemDoDia && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                           <h3 className="font-semibold flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Ordem do Dia</h3>
                           <div className="text-muted-foreground whitespace-pre-wrap pl-6">{assembly.ordemDoDia}</div>
                        </div>
                    </>
                )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

    