'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MoreVertical, ShieldBan } from 'lucide-react';
import { useCollection, useFirestore, useUser, addDocumentNonBlocking, setDocumentNonBlocking, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, limit, doc } from 'firebase/firestore';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { useBlockedUsers } from '@/hooks/use-blocked-users';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage, UserProfile, Reaction } from '@/lib/data';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';
import { WhoReactedSheet } from './WhoReactedSheet';


interface ChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assemblyId: string;
}

const EMOJI_REACTIONS = ['👍', '👏', '💡', '👀', '❓', '✅'];


function ChatMessageItem({ message, sender, onBlockUser, onShowReactions }: { message: ChatMessage, sender: UserProfile | undefined, onBlockUser: (userId: string) => void, onShowReactions: (reactions: Reaction[]) => void }) {
    const { user } = useUser();
    const firestore = useFirestore();
    
    const isCurrentUser = user?.uid === sender?.id;

     const reactionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'assemblies', message.assemblyId, 'chat', message.id, 'reactions');
    }, [firestore, message.assemblyId, message.id]);
    
    const { data: reactions } = useCollection<Reaction>(reactionsQuery);

    const handleReact = (emoji: string) => {
        if (!user || !firestore) return;
        const reactionRef = doc(firestore, 'assemblies', message.assemblyId, 'chat', message.id, 'reactions', user.uid);
        const existingReaction = reactions?.find(r => r.userId === user.uid);

        if (existingReaction?.emoji === emoji) {
            deleteDocumentNonBlocking(reactionRef);
        } else {
            const reactionData = {
                userId: user.uid,
                emoji: emoji,
                messageId: message.id,
                assemblyId: message.assemblyId,
                createdAt: serverTimestamp(),
            };
            setDocumentNonBlocking(reactionRef, reactionData, { merge: true });
        }
    };

    const reactionSummary = useMemo(() => {
        if (!reactions || reactions.length === 0) return [];
        const counts: { [emoji: string]: number } = {};
        reactions.forEach(r => {
            counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        });
        return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
    }, [reactions]);


    if (!sender) {
        return (
             <div className="flex items-start gap-2.5 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-1 w-full">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4/5" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2.5 py-2 group">
            <Avatar className="w-8 h-8">
                <AvatarImage src={sender.avatarDataUri} />
                <AvatarFallback>{sender.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold">{sender.name}</p>
                    <span className="text-xs text-muted-foreground">
                        {message.timestamp ? formatDistanceToNow(message.timestamp.toDate(), { locale: ptBR, addSuffix: true }) : 'agora'}
                    </span>
                </div>
                <p className="text-sm text-foreground break-words">{message.text}</p>
                 {reactionSummary.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {reactionSummary.map(({ emoji, count }) => (
                            <button
                                key={emoji}
                                onClick={() => onShowReactions(reactions || [])}
                                className="flex items-center gap-1 rounded-full border bg-secondary/50 px-2 py-0.5 text-xs hover:bg-secondary"
                            >
                                <span>{emoji}</span>
                                <span className="font-medium text-secondary-foreground">{count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {!isCurrentUser && (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         <DropdownMenuLabel>Reagir:</DropdownMenuLabel>
                         <div className="flex justify-around px-2 py-1">
                            {EMOJI_REACTIONS.map(emoji => (
                                <button key={emoji} onClick={() => handleReact(emoji)} className="text-xl p-1 rounded-md hover:bg-accent">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onBlockUser(sender.id)} className="text-destructive">
                            <ShieldBan className="mr-2 h-4 w-4" />
                            Bloquear Usuário
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}


export function ChatSheet({ open, onOpenChange, assemblyId }: ChatSheetProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const [reactionsToShow, setReactionsToShow] = useState<Reaction[] | null>(null);

    const handleShowReactions = (reactions: Reaction[]) => {
        setReactionsToShow(reactions);
    };


    const messagesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'assemblies', assemblyId, 'chat'), orderBy('timestamp', 'desc'), limit(50));
    }, [firestore, assemblyId]);

    const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesQuery);
    const { blockedUserIds, isLoading: areBlockedUsersLoading } = useBlockedUsers();
    
    const userIdsInChat = useMemo(() => {
        if (!messages) return [];
        // This needs to be expanded to include users from reactions, so their profiles are loaded.
        const ids = new Set(messages.map(m => m.userId));
        // We will need to fetch profiles for reactions inside the WhoReactedSheet.
        return [...ids];
    }, [messages]);
    
    const { profiles: userProfiles, isLoading: areProfilesLoading } = useUserProfiles(userIdsInChat);

    const filteredMessages = useMemo(() => {
        if (!messages) return [];
        return messages.filter(m => !blockedUserIds.has(m.userId));
    }, [messages, blockedUserIds]);

    // Auto-scroll to top
    useEffect(() => {
        if (scrollAreaRef.current) {
             const { scrollTop } = scrollAreaRef.current;
            // If user is near the top, auto-scroll.
            if (scrollTop < 100) {
                 scrollAreaRef.current.scrollTop = 0;
            }
        }
    }, [filteredMessages]);


    const handleSendMessage = async () => {
        if (!firestore || !user || !newMessage.trim()) return;
        
        setIsSending(true);
        const chatColRef = collection(firestore, 'assemblies', assemblyId, 'chat');
        const messageData = {
            assemblyId,
            userId: user.uid,
            text: newMessage.trim(),
            timestamp: serverTimestamp(),
        };

        try {
            await addDocumentNonBlocking(chatColRef, messageData);
            setNewMessage('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar a mensagem.' });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleBlockUser = (userIdToBlock: string) => {
        if (!firestore || !user) return;
        
        const blockRef = doc(firestore, 'users', user.uid, 'blockedUsers', userIdToBlock);
        setDocumentNonBlocking(blockRef, {}, {});

        const blockedUserProfile = userProfiles[userIdToBlock];
        toast({
            title: 'Usuário Bloqueado',
            description: `Você não verá mais as mensagens de ${blockedUserProfile?.name ?? 'este usuário'}.`,
        });
    };

    const isLoading = areMessagesLoading || areBlockedUsersLoading;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-4 pb-2">
                    <SheetTitle>Bate-papo informal</SheetTitle>
                    <SheetDescription className="text-xs !text-destructive !mt-1">
                        Este chat não é um canal oficial! Para se pronunciar na Assembleia, utilize a Fila de Inscrição. Mantenha o respeito e o bom senso. Caso necessário, você pode bloquear usuários para ocultar mensagens indesejadas.
                    </SheetDescription>
                </SheetHeader>
                
                <div className="px-4 py-2 bg-background">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                        <Input
                            placeholder="Digite sua mensagem..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            disabled={isSending}
                            autoComplete="off"
                        />
                        <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </div>
                <Separator />

                <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 pt-2">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredMessages.length > 0 ? (
                        filteredMessages.map(msg => (
                            <ChatMessageItem 
                                key={msg.id} 
                                message={msg} 
                                sender={userProfiles[msg.userId]}
                                onBlockUser={handleBlockUser}
                                onShowReactions={handleShowReactions}
                            />
                        ))
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Seja o primeiro!</p>
                        </div>
                    )}
                </div>
                 {reactionsToShow && (
                    <WhoReactedSheet
                        isOpen={!!reactionsToShow}
                        onOpenChange={(isOpen) => { if (!isOpen) setReactionsToShow(null); }}
                        reactions={reactionsToShow || []}
                        userProfiles={userProfiles}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
