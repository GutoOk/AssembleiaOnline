'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import type { UserProfile } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Users } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

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
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center gap-2"><Users className="h-6 w-6" /> Lista de Presença ({attendees.length})</SheetTitle>
            <SheetDescription>Membros atualmente visualizando a assembleia.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6">
             {attendees.length > 0 ? (
                attendees.map(attendee => <AttendeeItem key={attendee.id} attendee={attendee} />)
            ) : (
                <div className="space-y-4 py-2">
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

    