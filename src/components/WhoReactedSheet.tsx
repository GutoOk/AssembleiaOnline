'use client';

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfile, Reaction } from '@/lib/data';
import { useUserProfiles } from '@/hooks/use-user-profiles';

interface WhoReactedSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    reactions: Reaction[];
    userProfiles: Record<string, UserProfile>;
}

export function WhoReactedSheet({ isOpen, onOpenChange, reactions, userProfiles: initialProfiles }: WhoReactedSheetProps) {
    const reactionUserIds = useMemo(() => reactions.map(r => r.userId), [reactions]);
    const { profiles: reactionUserProfiles } = useUserProfiles(reactionUserIds);
    
    const allProfiles = useMemo(() => ({...initialProfiles, ...reactionUserProfiles}), [initialProfiles, reactionUserProfiles]);

    const sortedReactions = useMemo(() => {
        if (!reactions || !allProfiles) return [];
        return [...reactions].sort((a, b) => {
            const nameA = allProfiles[a.userId]?.name ?? '';
            const nameB = allProfiles[b.userId]?.name ?? '';
            return nameA.localeCompare(nameB);
        });
    }, [reactions, allProfiles]);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-2/3 md:h-1/2 flex flex-col">
                <SheetHeader>
                    <SheetTitle>Reações ({reactions.length})</SheetTitle>
                </SheetHeader>
                {sortedReactions.length > 0 ? (
                    <ScrollArea className="flex-1 -mx-6">
                        <div className="space-y-1 px-6">
                            {sortedReactions.map(reaction => {
                                const user = allProfiles[reaction.userId];
                                return user ? (
                                    <div key={reaction.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatarDataUri} alt={user.name} />
                                                <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{user.name}</span>
                                        </div>
                                        <span className="text-2xl">{reaction.emoji}</span>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Nenhuma reação ainda.</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
