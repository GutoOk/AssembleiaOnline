'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, Mic, PlusCircle, Send, Users, Video, Hand, Loader2, Pencil, LogOut, MessageCircle, Home } from 'lucide-react';
import React, { useEffect, useState, useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { CreatePollDialog } from '@/components/CreatePollDialog';
import { ManageQueueDialog } from '@/components/ManageQueueDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDescriptionComponent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleComponent,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn, convertToEmbedUrl, convertToZoomEmbedUrl } from '@/lib/utils';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAdmin } from '@/hooks/use-admin';
import type { Assembly, UserProfile, Poll, SpeakerQueueItem, PollOption, Vote } from '@/lib/data';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { EndAssemblyDialog } from '@/components/EndAssemblyDialog';
import { StartAssemblyDialog } from '@/components/StartAssemblyDialog';

function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !userId || !user) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId, user]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

  if (isLoading) {
    return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  }

  if (!userProfile) {
    return <span>Usuário não encontrado</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={userProfile.avatarDataUri} alt={userProfile.name} />
        <AvatarFallback>{userProfile.name?.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span>{userProfile.name}</span>
    </div>
  );
}

function Countdown({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState(endDate.getTime() - Date.now());

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      const newTimeLeft = endDate.getTime() - Date.now();
      if (newTimeLeft <= 0) {
        clearInterval(timer);
      }
      setTimeLeft(newTimeLeft);
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate, timeLeft]);

  if (timeLeft <= 0) {
    return <span className="text-sm text-destructive">Encerrada</span>;
  }

  const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  return (
    <span className="text-sm font-mono text-muted-foreground">
      {hours > 0 && `${hours.toString().padStart(2, '0')}:`}
      {`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
    </span>
  );
}


function PollCard({ poll, assemblyId, assemblyStatus, isAdmin }: { poll: Poll; assemblyId: string, assemblyStatus: Assembly['status'], isAdmin: boolean }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [showAllVotes, setShowAllVotes] = useState(false);
  const [isAnnulDialogOpen, setAnnulDialogOpen] = useState(false);
  const [isAnnulConfirmOpen, setAnnulConfirmOpen] = useState(false);
  const [annulReason, setAnnulReason] = useState('');

  const optionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'options'), orderBy('text', 'asc'));
  }, [firestore, assemblyId, poll.id, user]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'votes'), orderBy('timestamp', 'desc'));
  }, [firestore, assemblyId, poll.id, user]);

  const { data: options, isLoading: isLoadingOptions } = useCollection<PollOption>(optionsQuery);
  const { data: votes, isLoading: isLoadingVotes } = useCollection<Vote>(votesQuery);

  const userVote = useMemo(() => votes?.find(v => v.id === user?.uid), [votes, user]);
  const pollEndDate = poll.endDate.toDate();
  const pollEnded = isPast(pollEndDate) || poll.status === 'closed' || assemblyStatus === 'finished';
  const pollAnnulled = poll.status === 'annulled';

  const userIdsToFetch = useMemo(() => {
      const ids = new Set<string>();
      if (poll.administratorId) ids.add(poll.administratorId);
      if (poll.annulledBy) ids.add(poll.annulledBy);
      votes?.forEach(v => ids.add(v.userId));
      return Array.from(ids);
  }, [votes, poll.administratorId, poll.annulledBy]);

  const { profiles: userProfiles } = useUserProfiles(userIdsToFetch);
  const pollCreator = userProfiles[poll.administratorId];
  const pollAnnuler = userProfiles[poll.annulledBy ?? ''];


  const handleVote = () => {
    if (!selectedOption || !user) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma opção para votar.' });
        return;
    };
    const voteRef = doc(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'votes', user.uid);
    const voteData: Omit<Vote, 'id' | 'timestamp'> = {
        userId: user.uid,
        pollId: poll.id,
        assemblyId: assemblyId,
        pollOptionId: selectedOption,
        timestamp: serverTimestamp() as any,
        assemblyStatus: assemblyStatus
    };
    setDocumentNonBlocking(voteRef, voteData, {});
    toast({ title: 'Voto Registrado!', description: 'Seu voto foi computado com sucesso.' });
  };
  
  const handleAnnulConfirm = () => {
    if (!user || !annulReason.trim()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O motivo da anulação é obrigatório.' });
        return;
    }
    const pollRef = doc(firestore, 'assemblies', assemblyId, 'polls', poll.id);
    updateDocumentNonBlocking(pollRef, {
        status: 'annulled',
        annulmentReason: annulReason,
        annulledBy: user.uid,
        annulledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    toast({ title: 'Votação Anulada', description: 'A votação foi anulada com sucesso.' });
    setAnnulConfirmOpen(false);
    setAnnulDialogOpen(false);
    setAnnulReason('');
  };

  const voteData = useMemo(() => {
    if (!options || !votes) return [];
    return options.map(option => ({
      name: option.text,
      votos: votes.filter(vote => vote.pollOptionId === option.id).length,
    }));
  }, [options, votes]);

  const sortedVotesAlphabetically = useMemo(() => {
      if (!votes || !userProfiles) return [];
      return [...votes].sort((a, b) => {
          const nameA = userProfiles[a.userId]?.name ?? '';
          const nameB = userProfiles[b.userId]?.name ?? '';
          return nameA.localeCompare(nameB);
      });
  }, [votes, userProfiles]);

  const recentVotes = useMemo(() => votes?.slice(0, 3) ?? [], [votes]);
  const votesToShow = showAllVotes ? sortedVotesAlphabetically : recentVotes;


  const isLoading = isLoadingOptions || isLoadingVotes;
  if(isLoading) {
    return <Card><CardContent className="p-6"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></CardContent></Card>
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
                <Clock className="h-4 w-4" />
                {pollAnnulled ? (
                    <span className="font-medium text-destructive">Votação Anulada</span>
                ) : pollEnded ? (
                    <span className="font-medium text-destructive">Votação encerrada</span>
                ) : (
                    <>
                        <span>Tempo restante para votar: </span>
                        <Countdown endDate={pollEndDate} />
                    </>
                )}
            </div>
            {isAdmin && !pollAnnulled && assemblyStatus !== 'finished' && (
                <Button variant="ghost" size="sm" className="h-8 -mt-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setAnnulDialogOpen(true)}>
                    Anular
                </Button>
            )}
        </div>
        <CardTitle className={cn("text-lg pt-2", pollAnnulled && "font-normal")}>{poll.question}</CardTitle>
        {!pollAnnulled && (
            <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" /> {votes?.length ?? 0} votos
            </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {pollAnnulled ? (
            <div>
                <h3 className="mb-2 text-foreground">Motivo da anulação:</h3>
                <blockquote className="mt-2 border-l-2 pl-4 italic text-muted-foreground">
                    "{poll.annulmentReason}"
                </blockquote>
            </div>
        ) : userVote || pollEnded ? (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Resultado:</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={voteData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="votos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {votes && votes.length > 0 && (
                <>
                <Separator className="my-4" />
                <h3 className="font-semibold mb-2 text-sm">Votos individuais:</h3>
                <div className={cn("space-y-2", showAllVotes && "max-h-48 overflow-y-auto pr-2")}>
                {votesToShow.map(vote => {
                    const voter = userProfiles[vote.userId];
                    const option = options?.find(o => o.id === vote.pollOptionId);
                    return (
                    <div key={vote.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                              <AvatarImage src={voter?.avatarDataUri} />
                              <AvatarFallback>{voter?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{voter?.name ?? 'Carregando...'}</span>
                        </div>
                        <span className="font-medium">{option?.text}</span>
                    </div>
                    )
                })}
                </div>
                {votes.length > 3 && (
                    <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs" onClick={() => setShowAllVotes(!showAllVotes)}>
                        {showAllVotes ? 'Ver menos' : 'Ver mais...'}
                    </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup onValueChange={setSelectedOption} value={selectedOption}>
              {options?.map(option => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id}>{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={handleVote} disabled={!selectedOption || isLoadingVotes}>
              {isLoadingVotes && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Votar
            </Button>
          </div>
        )}
      </CardContent>
      {poll.createdAt && (
        <CardFooter className="text-xs text-muted-foreground flex-col items-start gap-1 border-t pt-4">
            {pollAnnulled && poll.annulledAt ? (
                <p>Anulada por <span className="font-medium">{pollAnnuler?.name ?? '...'}</span> em {format(poll.annulledAt.toDate(), "dd/MM/yy 'às' HH:mm")}</p>
            ) : (
                <>
                    <p>Criada por: <span className="font-medium">{pollCreator ? pollCreator.name : '...'}</span> em {format(poll.createdAt.toDate(), "dd/MM/yy 'às' HH:mm")}</p>
                    <p>Encerramento em: {format(poll.endDate.toDate(), "dd/MM/yy 'às' HH:mm")}</p>
                </>
            )}
        </CardFooter>
      )}
    </Card>
    
    <Dialog open={isAnnulDialogOpen} onOpenChange={setAnnulDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular Votação</DialogTitle>
          <DialogDescription>
            Por favor, descreva o motivo para anular esta votação. Esta informação será visível para todos os participantes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Escreva o motivo aqui..."
            value={annulReason}
            onChange={(e) => setAnnulReason(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAnnulDialogOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => { if(annulReason.trim()) { setAnnulConfirmOpen(true) } else { toast({ variant: 'destructive', title: 'Motivo obrigatório' }) } }}>Anular Votação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={isAnnulConfirmOpen} onOpenChange={setAnnulConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitleComponent>Tem certeza?</AlertDialogTitleComponent>
                <AlertDialogDescriptionComponent>
                    Você está prestes a anular esta votação. Os resultados serão descartados.
                    <br /><br />
                    <span className="font-bold">⚠️ Esta ação não pode ser desfeita.</span>
                </AlertDialogDescriptionComponent>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleAnnulConfirm} asChild>
                  <Button variant="destructive">Confirmar Anulação</Button>
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  )
}

function SpeakingQueue({ 
    assemblyId, 
    assemblyZoomUrl,
    assemblyFinished,
    onEnterSpeakerMode,
    onJoinQueue,
    onLeaveQueue,
    queue,
    userInQueue,
    userProfiles,
    isLoading
  }: { 
    assemblyId: string; 
    assemblyZoomUrl?: string;
    assemblyFinished: boolean;
    onEnterSpeakerMode: (zoomLink: string, queueItem: SpeakerQueueItem) => void;
    onJoinQueue: () => void;
    onLeaveQueue: () => void;
    queue: SpeakerQueueItem[] | null;
    userInQueue: SpeakerQueueItem | undefined;
    userProfiles: Record<string, UserProfile>;
    isLoading: boolean;
  }) {
  const { user, isAdmin } = useAdmin();
  const [isManageQueueOpen, setManageQueueOpen] = useState(false);
  
  const getStatusBadge = (status: SpeakerQueueItem['status']) => {
      switch (status) {
        case 'Com a Fala':
            return <Badge variant="default" className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3"/>{status}</Badge>;
        case 'Entrada Autorizada':
            return <Badge variant="secondary">{status}</Badge>;
        case 'Na Fila':
        default:
            return <Badge variant="outline">{status}</Badge>;
      }
  }

  const renderSpeaker = (speaker: SpeakerQueueItem) => {
    const speakerUser = userProfiles[speaker.userId];
    const isCurrentUser = speaker.userId === user?.uid;

    if (!speakerUser) {
       return (
        <div key={speaker.id} className="flex items-start p-3 bg-muted/50 rounded-lg gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      );
    }

    return (
      <div key={speaker.id} className="flex items-start p-3 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={speakerUser.avatarDataUri} />
            <AvatarFallback>{speakerUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{speakerUser.name}</p>
            <p className="text-xs text-muted-foreground">{speakerUser.email}</p>
             {isCurrentUser && speaker.status === 'Entrada Autorizada' && assemblyZoomUrl && userInQueue ? (
                <Button size="sm" onClick={() => onEnterSpeakerMode(assemblyZoomUrl, userInQueue)} className="mt-2">
                    <Video className="h-4 w-4" /> Entrar para Falar
                </Button>
            ) : (
                <div className="mt-1">{getStatusBadge(speaker.status)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1.5">
            {speaker.joinedAt && formatDistanceToNow(speaker.joinedAt.toDate(), { locale: ptBR, addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    );
  };
  
  return (
      <div className="space-y-4">
        {isAdmin && (
           <>
            <Button className="w-full" onClick={() => setManageQueueOpen(true)} disabled={!queue || assemblyFinished}>
                <PlusCircle className="h-4 w-4" /> Gerenciar Inscrições
            </Button>
            {queue && (
              <ManageQueueDialog
                open={isManageQueueOpen}
                onOpenChange={setManageQueueOpen}
                assemblyId={assemblyId}
                queue={queue}
                userProfiles={userProfiles}
              />
            )}
          </>
        )}
        {!userInQueue && !isAdmin && <Button className="w-full" onClick={onJoinQueue} disabled={isLoading || assemblyFinished}><Hand className="h-4 w-4" /> Solicitar Palavra</Button>}
        {userInQueue && <Button variant="outline" className="w-full" onClick={onLeaveQueue}>Cancelar Inscrição</Button>}
        
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(queue?.length || 2)].map((_, i) => (
               <div key={i} className="flex items-start p-3 bg-muted/50 rounded-lg gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="space-y-3">
            {queue && queue.length > 0 ? queue.map(renderSpeaker) : <p className="text-sm text-muted-foreground text-center pt-4">Ninguém na fila.</p>}
            </div>
        )}
      </div>
  )
}


export default function AssemblyPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { toast } = useToast();
  const [isCreatePollOpen, setCreatePollOpen] = useState(false);
  const [isEditUrlOpen, setEditUrlOpen] = useState(false);
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newZoomUrl, setNewZoomUrl] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerZoomLink, setSpeakerZoomLink] = useState('');

  const assemblyContext = useAssemblyContext();
  const { setAssembly, isQueueOpen, setIsQueueOpen, isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen, isStartAssemblyDialogOpen, setIsStartAssemblyDialogOpen } = assemblyContext!;


  const assemblyRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return doc(firestore, 'assemblies', params.id);
  }, [firestore, params.id, user]);

  const pollsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'polls'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user]);
  
  const queueQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'speakerQueue'), orderBy('joinedAt', 'asc'));
  }, [firestore, params.id, user]);

  const { data: assembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);
  const { data: polls, isLoading: arePollsLoading } = useCollection<Poll>(pollsQuery);
  const { data: queue, isLoading: isQueueLoading } = useCollection<SpeakerQueueItem>(queueQuery);

  const userIdsInQueue = useMemo(() => queue?.map(s => s.userId) ?? [], [queue]);
  const { profiles: userProfiles, isLoading: areProfilesLoading } = useUserProfiles(userIdsInQueue);
  const userInQueue = useMemo(() => queue?.find(s => s.userId === user?.uid), [queue, user]);
  
  useEffect(() => {
    if (assembly) {
      setAssembly(assembly);
    }
    return () => {
      setAssembly(null);
    };
  }, [assembly, setAssembly]);


  const handleJoinQueue = () => {
    if (!user || !assembly) return;
    const queueItemRef = doc(firestore, 'assemblies', assembly.id, 'speakerQueue', user.uid);
    const queueItem: Omit<SpeakerQueueItem, 'id' | 'joinedAt'> & { joinedAt: any } = {
        userId: user.uid,
        assemblyId: assembly.id,
        joinedAt: serverTimestamp(),
        status: 'Na Fila',
        administratorId: assembly.administratorId,
        assemblyStatus: assembly.status,
    };
    setDocumentNonBlocking(queueItemRef, queueItem, { merge: true });
    toast({ title: 'Inscrição Realizada', description: 'Você foi adicionado à fila para falar.' });
  };

  const handleLeaveQueue = () => {
    if (!userInQueue) return;
    const itemRef = doc(firestore, 'assemblies', userInQueue.assemblyId, 'speakerQueue', userInQueue.id);
    deleteDocumentNonBlocking(itemRef);
    toast({ title: 'Inscrição Cancelada', description: 'Você foi removido da fila.' });
  };

  const handleEnterSpeakerMode = (zoomLink: string, queueItem: SpeakerQueueItem) => {
      if(!zoomLink) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O administrador ainda não forneceu um link do Zoom.' });
        return;
      }
      const itemRef = doc(firestore, 'assemblies', queueItem.assemblyId, 'speakerQueue', queueItem.id);
      updateDocumentNonBlocking(itemRef, { status: 'Com a Fala' });
      
      setSpeakerZoomLink(zoomLink);
      setIsSpeaking(true);
  };
  
  const handleEndParticipation = () => {
      if (!userInQueue) return;
      const itemRef = doc(firestore, 'assemblies', userInQueue.assemblyId, 'speakerQueue', userInQueue.id);
      deleteDocumentNonBlocking(itemRef);
      setIsSpeaking(false);
      setSpeakerZoomLink('');
      toast({ title: 'Participação Encerrada', description: 'Você saiu da chamada e foi removido da fila.' });
  };

  const displayEmbedUrl = useMemo(() => {
    return assembly ? convertToEmbedUrl(assembly.youtubeUrl) : '';
  }, [assembly]);

  const zoomEmbedUrlWithUser = useMemo(() => {
    if (!assembly?.zoomUrl || !user?.displayName) {
      return assembly?.zoomUrl || '';
    }
    // `btoa` can't handle non-latin1 characters. The common workaround is to use `unescape` and `encodeURIComponent`.
    const userNameBase64 = btoa(unescape(encodeURIComponent(user.displayName)));
    const joiner = assembly.zoomUrl.includes('?') ? '&' : '?';
    return `${assembly.zoomUrl}${joiner}uname=${userNameBase64}`;
  }, [assembly?.zoomUrl, user?.displayName]);


  useEffect(() => {
    if (assembly) {
      setNewYoutubeUrl(assembly.youtubeUrl);
      setNewZoomUrl(assembly.zoomUrl || '');
    }
  }, [assembly]);

  const handleUpdateUrl = () => {
    if (!assembly || !firestore) return;
    const assemblyDocRef = doc(firestore, 'assemblies', assembly.id);
    
    updateDocumentNonBlocking(assemblyDocRef, { 
      youtubeUrl: newYoutubeUrl,
      zoomUrl: newZoomUrl,
    });
    toast({ title: 'Links atualizados!', description: 'Os links da transmissão foram atualizados com sucesso.' });
    setEditUrlOpen(false);
  };

  const isLoading = isAdminLoading || isAssemblyLoading;
  const isQueueComponentLoading = isQueueLoading || (!!queue && queue.length > 0 && areProfilesLoading);
  const assemblyFinished = assembly?.status === 'finished';

  if (isLoading) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assembly) {
    notFound();
  }
  
  const assemblyId = assembly.id;
  const assemblyDate = assembly.date.toDate();

  return (
    <>
    <StartAssemblyDialog
      open={isStartAssemblyDialogOpen}
      onOpenChange={setIsStartAssemblyDialogOpen}
      assembly={assembly}
    />
    <EndAssemblyDialog
      open={isEndAssemblyDialogOpen}
      onOpenChange={setIsEndAssemblyDialogOpen}
      assembly={assembly}
    />
    <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center gap-2"><Mic className="h-6 w-6" /> Fila de Inscrição</SheetTitle>
            <SheetDescription>Membros que solicitaram a palavra.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-0">
             <SpeakingQueue 
              assemblyId={assembly.id}
              assemblyZoomUrl={assembly.zoomUrl}
              assemblyFinished={assemblyFinished}
              queue={queue}
              userInQueue={userInQueue}
              userProfiles={userProfiles}
              isLoading={isQueueComponentLoading}
              onJoinQueue={handleJoinQueue}
              onLeaveQueue={handleLeaveQueue}
              onEnterSpeakerMode={handleEnterSpeakerMode}
            />
          </div>
        </SheetContent>
      </Sheet>
      <div className="container mx-auto p-0 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{assembly.title}</h1>
          <p className="text-muted-foreground mt-1">
            {format(assemblyDate, "eeee, dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        <div className="space-y-8">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Video className="h-6 w-6" /> Transmissão ao Vivo</CardTitle>
                <div className="flex items-center gap-2">
                  {isSpeaking && (
                      <Button onClick={handleEndParticipation} variant="destructive">
                          <LogOut className="h-4 w-4" />
                          Encerrar Participação
                      </Button>
                  )}
                  {isAdmin && !assemblyFinished && (
                    <Dialog open={isEditUrlOpen} onOpenChange={setEditUrlOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar links de transmissão</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                            <DialogTitle>Editar Links de Transmissão</DialogTitle>
                            <DialogDescription>
                              Cole os novos links abaixo. O do YouTube é para membros, e o do Zoom para a tela do administrador.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div>
                            <Label htmlFor="youtubeUrl" className="text-sm font-medium">Link do YouTube</Label>
                            <Input
                                id="youtubeUrl"
                                value={newYoutubeUrl}
                                onChange={(e) => setNewYoutubeUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="zoomUrl" className="text-sm font-medium">Link da Reunião do Zoom</Label>
                            <Input
                                id="zoomUrl"
                                value={newZoomUrl}
                                onChange={(e) => setNewZoomUrl(e.target.value)}
                                placeholder="https://zoom.us/j/..."
                                className="mt-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setEditUrlOpen(false)}>Cancelar</Button>
                          <Button type="button" onClick={handleUpdateUrl}>Salvar Alterações</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full overflow-hidden rounded-lg border">
                  {isSpeaking && speakerZoomLink ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={convertToZoomEmbedUrl(speakerZoomLink)}
                      title="Zoom Meeting"
                      allow="fullscreen; microphone; camera; display-capture"
                    ></iframe>
                  ) : isAdmin && assembly.zoomUrl ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={zoomEmbedUrlWithUser}
                      title="Zoom Meeting"
                      allow="fullscreen; microphone; camera; display-capture"
                    ></iframe>
                  ) : (
                    <iframe
                      width="100%"
                      height="100%"
                      src={displayEmbedUrl}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {isAdmin && !assemblyFinished &&(
                <>
                  <Button onClick={() => setCreatePollOpen(true)}><PlusCircle className="h-4 w-4"/> Nova Votação</Button>
                  <CreatePollDialog 
                    open={isCreatePollOpen}
                    onOpenChange={setCreatePollOpen}
                    assembly={assembly}
                  />
                </>
              )}
              {arePollsLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
              
              {polls && polls.length > 0 ? (
                  polls.map(poll => (
                    <PollCard key={poll.id} poll={poll} assemblyId={assembly.id} assemblyStatus={assembly.status} isAdmin={isAdmin} />
                  ))
              ) : (
                  !arePollsLoading && <p className="text-sm text-center text-muted-foreground pt-4">Nenhuma votação para esta assembleia.</p>
              )}
            </div>
        </div>
      </div>
    </>
  );
}
