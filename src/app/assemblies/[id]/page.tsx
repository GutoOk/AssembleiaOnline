'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, Mic, PlusCircle, Send, Users, Video, Hand, Loader2, Pencil } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { convertToEmbedUrl, convertToZoomEmbedUrl } from '@/lib/utils';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { useAdmin } from '@/hooks/use-admin';
import type { Assembly, UserProfile, Poll, SpeakerQueueItem, PollOption, Vote } from '@/lib/data';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

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


function PollCard({ poll, assemblyId }: { poll: Poll; assemblyId: string }) {
  const firestore = useFirestore();
  const { user } = useAdmin();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();

  const optionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'options'), orderBy('text', 'asc'));
  }, [firestore, assemblyId, poll.id, user]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'votes');
  }, [firestore, assemblyId, poll.id, user]);

  const { data: options, isLoading: isLoadingOptions } = useCollection<PollOption>(optionsQuery);
  const { data: votes, isLoading: isLoadingVotes } = useCollection<Vote>(votesQuery);

  const userVote = useMemo(() => votes?.find(v => v.id === user?.uid), [votes, user]);
  const pollEndDate = poll.endDate.toDate();
  const pollEnded = isPast(pollEndDate) || poll.status === 'closed';

  const userIdsInVotes = useMemo(() => votes?.map(v => v.userId) ?? [], [votes]);
  const { profiles: userProfiles } = useUserProfiles(userIdsInVotes);


  const handleVote = () => {
    if (!selectedOption || !user) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma opção para votar.' });
        return;
    };
    const voteRef = doc(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'votes', user.uid);
    const voteData = {
        userId: user.uid,
        pollId: poll.id,
        assemblyId: assemblyId,
        pollOptionId: selectedOption,
        timestamp: serverTimestamp(),
    };
    setDocumentNonBlocking(voteRef, voteData, {});
    toast({ title: 'Voto Registrado!', description: 'Seu voto foi computado com sucesso.' });
  };
  
  const voteData = useMemo(() => {
    if (!options || !votes) return [];
    return options.map(option => ({
      name: option.text,
      votos: votes.filter(vote => vote.pollOptionId === option.id).length,
    }));
  }, [options, votes]);

  const isLoading = isLoadingOptions || isLoadingVotes;
  if(isLoading) {
    return <Card><CardContent className="p-6"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{poll.question}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Users className="h-4 w-4" /> {votes?.length ?? 0} votos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Countdown endDate={pollEndDate} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {userVote || pollEnded ? (
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
                <div className="space-y-2 max-h-48 overflow-y-auto">
                {votes.map(vote => {
                    const voter = userProfiles[vote.userId];
                    const option = options?.find(o => o.id === vote.pollOptionId);
                    return (
                    <div key={vote.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                              <AvatarImage src={voter?.avatarDataUri} />
                              <AvatarFallback>{voter?.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{voter?.name ?? 'Carregando...'}</span>
                        </div>
                        <span className="font-medium">{option?.text}</span>
                    </div>
                    )
                })}
                </div>
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
              {isLoadingVotes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Votar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SpeakingQueue({ assemblyId }: { assemblyId: string }) {
  const firestore = useFirestore();
  const { user, isAdmin } = useAdmin();
  const { toast } = useToast();
  const [isManageQueueOpen, setManageQueueOpen] = useState(false);

  const queueQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'speakerQueue'), orderBy('joinedAt', 'asc'));
  }, [firestore, assemblyId, user]);

  const { data: queue, isLoading: isQueueLoading } = useCollection<SpeakerQueueItem>(queueQuery);

  const userIdsInQueue = useMemo(() => queue?.map(s => s.userId) ?? [], [queue]);
  const { profiles: userProfiles, isLoading: areProfilesLoading } = useUserProfiles(userIdsInQueue);

  const userInQueue = useMemo(() => queue?.find(s => s.userId === user?.uid), [queue, user]);

  const handleJoinQueue = () => {
    if (!user) return;
    const queueRef = collection(firestore, 'assemblies', assemblyId, 'speakerQueue');
    const queueItem = {
        userId: user.uid,
        assemblyId: assemblyId,
        joinedAt: serverTimestamp(),
        status: 'requested',
    };
    addDocumentNonBlocking(queueRef, queueItem);
    toast({ title: 'Inscrição Realizada', description: 'Você foi adicionado à fila para falar.' });
  };

  const handleLeaveQueue = () => {
    if (!userInQueue) return;
    const itemRef = doc(firestore, 'assemblies', assemblyId, 'speakerQueue', userInQueue.id);
    deleteDocumentNonBlocking(itemRef);
    toast({ title: 'Inscrição Cancelada', description: 'Você foi removido da fila.' });
  };
  
  const isLoading = isQueueLoading || (!!queue && queue.length > 0 && areProfilesLoading);

  const renderSpeaker = (speaker: SpeakerQueueItem) => {
    const speakerUser = userProfiles[speaker.userId];

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

    const statusBadge = (status: SpeakerQueueItem['status']) => {
      switch(status) {
        case 'speaking': return <Badge variant="destructive">Falando</Badge>;
        case 'queued': return <Badge variant="outline" className="border-primary text-primary">Na Fila</Badge>;
        case 'requested': return <Badge variant="secondary">Requisitado</Badge>;
        case 'completed': return <Badge>Finalizado</Badge>;
        case 'cancelled': return <Badge variant="secondary">Cancelado</Badge>;
      }
    };

    return (
      <div key={speaker.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={speakerUser.avatarDataUri} />
            <AvatarFallback>{speakerUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{speakerUser.name}</p>
            <p className="text-xs text-muted-foreground">{speakerUser.email}</p>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                {speaker.joinedAt && formatDistanceToNow(speaker.joinedAt.toDate(), { locale: ptBR, addSuffix: true })}
                </p>
                {statusBadge(speaker.status)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || user?.uid === speaker.userId) && speaker.status === 'speaking' && speaker.zoomLink && (
            <Button size="sm" asChild>
              <Link href={speaker.zoomLink} target="_blank">
                <Video className="h-4 w-4 mr-2" /> Entrar no Zoom
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-6 w-6" />
          Fila de Inscrição
        </CardTitle>
        <CardDescription>Membros que solicitaram a palavra.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
           <>
            <Button className="w-full" onClick={() => setManageQueueOpen(true)} disabled={!queue}>
                <PlusCircle className="mr-2 h-4 w-4" /> Gerenciar Inscrições
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
        {!userInQueue && !isAdmin && <Button className="w-full" onClick={handleJoinQueue} disabled={isQueueLoading}><Hand className="mr-2 h-4 w-4" /> Solicitar Palavra</Button>}
        {userInQueue && <Button variant="outline" className="w-full" onClick={handleLeaveQueue}>Cancelar Inscrição</Button>}
        
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
      </CardContent>
    </Card>
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

  const assemblyRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return doc(firestore, 'assemblies', params.id);
  }, [firestore, params.id, user]);

  const pollsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'polls'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user]);

  const { data: assembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);
  const { data: polls, isLoading: arePollsLoading } = useCollection<Poll>(pollsQuery);

  const displayEmbedUrl = useMemo(() => {
    return assembly ? convertToEmbedUrl(assembly.youtubeUrl) : '';
  }, [assembly]);


  useEffect(() => {
    if (assembly) {
      setNewYoutubeUrl(assembly.youtubeUrl);
      setNewZoomUrl(assembly.zoomUrl || '');
    }
  }, [assembly]);

  const handleUpdateUrl = () => {
    if (!assembly || !firestore) return;
    const assemblyDocRef = doc(firestore, 'assemblies', assembly.id);
    const youtubeEmbedUrl = convertToEmbedUrl(newYoutubeUrl);
    const zoomEmbedUrl = newZoomUrl ? convertToZoomEmbedUrl(newZoomUrl) : '';
    
    updateDocumentNonBlocking(assemblyDocRef, { 
      youtubeUrl: youtubeEmbedUrl,
      zoomUrl: zoomEmbedUrl,
    });
    toast({ title: 'Links atualizados!', description: 'Os links da transmissão foram atualizados com sucesso.' });
    setEditUrlOpen(false);
  };

  const isLoading = isAdminLoading || isAssemblyLoading;

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

  const assemblyDate = assembly.date.toDate();

  return (
    <div className="container mx-auto p-0 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{assembly.title}</h1>
        <p className="text-muted-foreground mt-1">
          {format(assemblyDate, "eeee, dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Video className="h-6 w-6" /> Transmissão ao Vivo</CardTitle>
              {isAdmin && (
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
                         <p className="text-sm text-muted-foreground pt-1">Qualquer formato de link do YouTube é aceito.</p>
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
                         <p className="text-sm text-muted-foreground pt-1">Cole o link completo da reunião do Zoom.</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditUrlOpen(false)}>Cancelar</Button>
                      <Button type="button" onClick={handleUpdateUrl}>Salvar Alterações</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full overflow-hidden rounded-lg border">
                {isAdmin && assembly.zoomUrl ? (
                   <iframe
                    width="100%"
                    height="100%"
                    src={assembly.zoomUrl}
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
             {isAdmin && (
               <>
                <Button onClick={() => setCreatePollOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Nova Votação</Button>
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
                  <PollCard key={poll.id} poll={poll} assemblyId={assembly.id} />
                ))
             ) : (
                !arePollsLoading && <p className="text-sm text-center text-muted-foreground pt-4">Nenhuma votação para esta assembleia.</p>
             )}
          </div>
        </div>

        <div className="md:col-span-1 space-y-8">
            <SpeakingQueue assemblyId={assembly.id} />
        </div>
      </div>
    </div>
  );
}
