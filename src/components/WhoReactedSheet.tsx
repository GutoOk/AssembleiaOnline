'use client';

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfile, Reaction } from '@/lib/data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

    const groupedReactions = useMemo(() => {
        if (!reactions) return {};
        return reactions.reduce((acc, reaction) => {
            const { emoji } = reaction;
            if (!acc[emoji]) {
                acc[emoji] = [];
            }
            acc[emoji].push(reaction);
            return acc;
        }, {} as Record<string, Reaction[]>);
    }, [reactions]);
    
    const emojiTabs = Object.keys(groupedReactions);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-2/3 md:h-1/2 flex flex-col">
                <SheetHeader>
                    <SheetTitle>Reações</SheetTitle>
                </SheetHeader>
                {emojiTabs.length > 0 ? (
                    <Tabs defaultValue={emojiTabs[0]} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="flex-shrink-0">
                            {emojiTabs.map(emoji => (
                                <TabsTrigger key={emoji} value={emoji} className="flex items-center gap-2">
                                    {emoji} 
                                    <Badge variant="secondary">{groupedReactions[emoji].length}</Badge>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <ScrollArea className="flex-1 mt-2">
                             {emojiTabs.map(emoji => (
                                <TabsContent key={emoji} value={emoji} className="mt-0">
                                    <div className="space-y-4">
                                        {groupedReactions[emoji].map(reaction => {
                                            const user = allProfiles[reaction.userId];
                                            return user ? (
                                                <div key={reaction.id} className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={user.avatarDataUri} alt={user.name} />
                                                        <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{user.name}</span>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </TabsContent>
                            ))}
                        </ScrollArea>
                    </Tabs>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-muted-foreground">Nenhuma reação ainda.</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
