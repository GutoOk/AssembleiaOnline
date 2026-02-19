'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import type { UserProfile } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';

function AttendeeItem({ attendee }: { attendee: UserProfile }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <Avatar>
                <AvatarImage src={attendee.avatarDataUri} alt={attendee.name} />
                <AvatarFallback>{attendee.name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-medium">{attendee.name}</p>
                <p className="text-sm text-muted-foreground">{attendee.email}</p>
            </div>
        </div>
    );
}


export function AttendeesSheet() {
  const context = useAssemblyContext();

  if (!context) {
    return null;
  }
  
  const { isAttendeesSheetOpen, setIsAttendeesSheetOpen, attendees } = context;

  return (
    <Sheet open={isAttendeesSheetOpen} onOpenChange={setIsAttendeesSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="p-6 pb-2">
                <SheetTitle>Participantes Online ({attendees.length})</SheetTitle>
                <SheetDescription>
                    Membros que estão visualizando a página da assembleia.
                </SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-4">
              <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <p>
                      A lista oficial de presença e o quórum de votação são extraídos exclusivamente do total de votos registrados em cada pauta.
                  </p>
              </div>
            </div>
            <Separator />
            <ScrollArea className="flex-1 px-6">
                {attendees.length > 0 ? (
                attendees.map(attendee => <AttendeeItem key={attendee.id} attendee={attendee} />)
            ) : (
                <div className="space-y-4 py-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-[150px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                        </div>
                    ))}
                </div>
            )}
            </ScrollArea>
        </SheetContent>
    </Sheet>
  );
}
