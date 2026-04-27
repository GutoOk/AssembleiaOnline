'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, Mic, PlusCircle, Send, Users, Video, Hand, Loader2, Pencil, LogOut, MessageCircle, Home, BookText, Trash2, Info, CheckCircle2, MapPin, FileText, XCircle, MoreVertical, ShieldBan, Play, AlertTriangle } from 'lucide-react';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { CreatePollSheet } from '@/components/CreatePollSheet';
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
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, where, writeBatch, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useAdmin } from '@/hooks/use-admin';
import type { Assembly, UserProfile, Poll, SpeakerQueueItem, PollOption, Vote, AtaItem, ProxyAssignment, AssemblyPresence, Reaction } from '@/lib/data';
import { useUserProfiles } from '@/hooks/use-user-profiles';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { EndAssemblyDialog } from '@/components/EndAssemblyDialog';
import { StartAssemblyDialog } from '@/components/StartAssemblyDialog';
import { z } from 'zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ChatSheet } from '@/components/ChatSheet';
import { AttendeesSheet } from '@/components/AttendeesSheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WhoReactedSheet } from '@/components/WhoReactedSheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculatePollResult } from '@/lib/domain/quorum';
import { createAuditLog } from '@/lib/services/audit.service';


const LinkifiedText = ({ text, className }: { text: string; className?: string }) => {
  if (!text) {
    return null;
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <div className={cn('text-sm text-muted-foreground whitespace-pre-wrap', className)}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 break-all"
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

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


function PollCard({ poll, assemblyId, assemblyStatus, isAdmin, representedAssignments, userProxyGrant, userProfiles }: { poll: Poll; assemblyId: string, assemblyStatus: Assembly['status'], isAdmin: boolean, representedAssignments: ProxyAssignment[] | null, userProxyGrant: ProxyAssignment | null, userProfiles: Record<string, UserProfile> }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [showAllVotes, setShowAllVotes] = useState(false);
  const [isAnnulDialogOpen, setAnnulDialogOpen] = useState(false);
  const [isAnnulConfirmOpen, setAnnulConfirmOpen] = useState(false);
  const [annulReason, setAnnulReason] = useState('');
  const [isEditingAnnulment, setIsEditingAnnulment] = useState(false);
  const [editTextAnnulment, setEditTextAnnulment] = useState(poll.annulmentReason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedOptionsByVoterId, setSelectedOptionsByVoterId] = useState<Record<string, string>>({});
  const [isVotingByVoterId, setIsVotingByVoterId] = useState<Record<string, boolean>>({});
  const [isWithdrawingByVoterId, setIsWithdrawingByVoterId] = useState<Record<string, boolean>>({});

  const pollEndDate = poll.endDate.toDate();
  const [isTimeUp, setIsTimeUp] = useState(() => isPast(pollEndDate));

  useEffect(() => {
    if (isTimeUp) return;
    const timer = setInterval(() => {
      if (isPast(pollEndDate)) {
        setIsTimeUp(true);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimeUp, pollEndDate]);


  const optionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'options'), orderBy('createdAt', 'asc'));
  }, [firestore, assemblyId, poll.id, user]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies', assemblyId, 'polls', poll.id, 'votes'), orderBy('timestamp', 'desc'));
  }, [firestore, assemblyId, poll.id, user]);

  const { data: rawOptions, isLoading: isLoadingOptions } = useCollection<PollOption>(optionsQuery);
  const { data: votes, isLoading: isLoadingVotes } = useCollection<Vote>(votesQuery);
  
  const options = useMemo(() => {
    if (!rawOptions) return null;
    return [...rawOptions].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // Fallback to createdAt if order is not defined
      const dateA = a.createdAt?.toDate() ?? new Date(0);
      const dateB = b.createdAt?.toDate() ?? new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [rawOptions]);

  const hasActiveProxyGrant = userProxyGrant?.status === 'active';
  const pollEnded = isTimeUp || poll.status === 'closed' || assemblyStatus === 'finished';
  const pollAnnulled = poll.status === 'annulled';
  
  const pollCreator = userProfiles[poll.administratorId];
  const pollAnnuler = userProfiles[poll.annulledBy ?? ''];
  const proxyGranteeProfile = hasActiveProxyGrant ? userProfiles[userProxyGrant.proxyId] : null;
  const activeVotes = useMemo(() => votes?.filter((vote) => vote.status === 'active') ?? [], [votes]);

  type EffectiveVoter = {
    effectiveVoterId: string;
    representedUserId: string | null;
    label: string;
    isOwnVote: boolean;
  };
  
  const activeRepresentedAssignments =
    representedAssignments?.filter((assignment) => assignment.status === 'active') ?? [];
  
  const effectiveVoters: EffectiveVoter[] = [
    ...(!hasActiveProxyGrant && user
      ? [
          {
            effectiveVoterId: user.uid,
            representedUserId: null,
            label: 'Seu Voto',
            isOwnVote: true,
          },
        ]
      : []),
    ...activeRepresentedAssignments.map((assignment) => ({
      effectiveVoterId: assignment.grantorId,
      representedUserId: assignment.grantorId,
      label: userProfiles[assignment.grantorId]?.name ?? `Representado ${assignment.grantorId.slice(0, 6)}`,
      isOwnVote: false,
    })),
  ];

  const getVoteFor = (effectiveVoterId: string) => {
    return votes?.find((vote) => vote.effectiveVoterId === effectiveVoterId);
  };
  
  const handleSelectedOptionChange = (effectiveVoterId: string, optionId: string) => {
    setSelectedOptionsByVoterId((current) => ({
      ...current,
      [effectiveVoterId]: optionId,
    }));
  };

  const pollResult = useMemo(() => {
    if (poll.type !== 'proposal' || !pollEnded || !options || !activeVotes || poll.status === 'annulled') {
      return null;
    }

    const favorOption = options.find(o => o.text.trim().toLowerCase() === 'a favor');
    const contraOption = options.find(o => o.text.trim().toLowerCase() === 'contra');
    const abstencaoOption = options.find(o => o.text.trim().toLowerCase() === 'abstenção');


    if (!favorOption || !contraOption) {
      return { status: 'Indeterminado' as const, message: 'Não é uma votação de proposta padrão (A favor/Contra).' };
    }

    const favorVotes = activeVotes.filter(v => v.pollOptionId === favorOption.id).length;
    const contraVotes = activeVotes.filter(v => v.pollOptionId === contraOption.id).length;
    const abstentionVotes = abstencaoOption ? activeVotes.filter(v => v.pollOptionId === abstencaoOption.id).length : 0;
    
    return calculatePollResult({
        quorumType: poll.quorumType,
        favorVotes,
        contraVotes,
        abstentionVotes,
        totalActiveMembers: poll.totalActiveMembers,
    });
  }, [poll, options, activeVotes, pollEnded]);
  
  const handleVoteFor = async (voter: EffectiveVoter) => {
    if (!user || !firestore) return;
  
    const selectedOption = selectedOptionsByVoterId[voter.effectiveVoterId];
  
    if (!selectedOption) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma opção',
        description: `Selecione uma opção para ${voter.label}.`,
      });
      return;
    }
  
    if (poll.status !== 'open' || pollEnded || pollAnnulled) {
      toast({
        variant: 'destructive',
        title: 'Votação indisponível',
        description: 'Esta votação não está aberta para novos votos.',
      });
      return;
    }
  
    const existingVote = getVoteFor(voter.effectiveVoterId);
  
    if (existingVote?.status === 'active') {
      toast({
        variant: 'destructive',
        title: 'Voto já registrado',
        description: `Para votar novamente por ${voter.label}, retire o voto atual primeiro.`,
      });
      return;
    }
  
    try {
      setIsVotingByVoterId((current) => ({
        ...current,
        [voter.effectiveVoterId]: true,
      }));
  
      const voteRef = doc(
        firestore,
        'assemblies',
        assemblyId,
        'polls',
        poll.id,
        'votes',
        voter.effectiveVoterId
      );
  
      if (!existingVote) {
        await setDoc(voteRef, {
          effectiveVoterId: voter.effectiveVoterId,
          userId: user.uid,
          representedUserId: voter.representedUserId,
          pollId: poll.id,
          assemblyId,
          pollOptionId: selectedOption,
          previousPollOptionId: null,
          status: 'active',
          assemblyStatus,
          timestamp: serverTimestamp(),
          withdrawnAt: null,
          withdrawnBy: null,
          votedAgainAt: null,
          votedAgainBy: null,
        });
  
        await createAuditLog({
          firestore,
          assemblyId,
          actorId: user.uid,
          type: 'VOTE_CAST',
          targetId: poll.id,
          metadata: {
            pollId: poll.id,
            effectiveVoterId: voter.effectiveVoterId,
            representedUserId: voter.representedUserId,
            optionId: selectedOption,
          },
        });
      }
  
      if (existingVote?.status === 'withdrawn') {
        await updateDoc(voteRef, {
          status: 'active',
          pollOptionId: selectedOption,
          votedAgainAt: serverTimestamp(),
          votedAgainBy: user.uid,
          withdrawnAt: null,
          withdrawnBy: null,
        });
  
        await createAuditLog({
          firestore,
          assemblyId,
          actorId: user.uid,
          type: 'VOTE_RECAST',
          targetId: poll.id,
          metadata: {
            pollId: poll.id,
            effectiveVoterId: voter.effectiveVoterId,
            representedUserId: voter.representedUserId,
            optionId: selectedOption,
            previousPollOptionId: existingVote.previousPollOptionId ?? null,
          },
        });
      }
  
      toast({
        title: existingVote?.status === 'withdrawn' ? 'Voto registrado novamente' : 'Voto registrado',
        description: `O voto de ${voter.label} foi computado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao votar:', error);
  
      toast({
        variant: 'destructive',
        title: 'Erro ao votar',
        description: `O voto de ${voter.label} não foi confirmado pelo servidor.`,
      });
    } finally {
      setIsVotingByVoterId((current) => ({
        ...current,
        [voter.effectiveVoterId]: false,
      }));
    }
  };

  const handleWithdrawVoteFor = async (voter: EffectiveVoter) => {
    if (!user || !firestore) return;
  
    const existingVote = getVoteFor(voter.effectiveVoterId);
  
    if (!existingVote || existingVote.status !== 'active') {
      toast({
        variant: 'destructive',
        title: 'Nenhum voto ativo',
        description: `${voter.label} não tem voto ativo para retirar.`,
      });
      return;
    }
  
    if (poll.status !== 'open' || pollEnded || pollAnnulled) {
      toast({
        variant: 'destructive',
        title: 'Votação indisponível',
        description: 'Não é possível retirar voto de uma votação encerrada.',
      });
      return;
    }
  
    try {
      setIsWithdrawingByVoterId((current) => ({
        ...current,
        [voter.effectiveVoterId]: true,
      }));
  
      const voteRef = doc(
        firestore,
        'assemblies',
        assemblyId,
        'polls',
        poll.id,
        'votes',
        voter.effectiveVoterId
      );
  
      await updateDoc(voteRef, {
        status: 'withdrawn',
        pollOptionId: null,
        previousPollOptionId: existingVote.pollOptionId,
        withdrawnAt: serverTimestamp(),
        withdrawnBy: user.uid,
      });
  
      await createAuditLog({
        firestore,
        assemblyId,
        actorId: user.uid,
        type: 'VOTE_WITHDRAWN',
        targetId: poll.id,
        metadata: {
          pollId: poll.id,
          effectiveVoterId: voter.effectiveVoterId,
          representedUserId: voter.representedUserId,
          previousPollOptionId: existingVote.pollOptionId,
        },
      });
  
      toast({
        title: 'Voto retirado',
        description: `O voto de ${voter.label} foi retirado. Será possível votar novamente enquanto a votação estiver aberta.`,
      });
    } catch (error) {
      console.error('Erro ao retirar voto:', error);
  
      toast({
        variant: 'destructive',
        title: 'Erro ao retirar voto',
        description: `A retirada do voto de ${voter.label} não foi confirmada pelo servidor.`,
      });
    } finally {
      setIsWithdrawingByVoterId((current) => ({
        ...current,
        [voter.effectiveVoterId]: false,
      }));
    }
  };

  const handleAnnulConfirm = async () => {
    if (!user || !annulReason.trim() || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O motivo da anulação é obrigatório.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const pollRef = doc(firestore, 'assemblies', assemblyId, 'polls', poll.id);
        await updateDoc(pollRef, {
            status: 'annulled',
            annulmentReason: annulReason,
            annulledBy: user.uid,
            annulledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await createAuditLog({
            firestore,
            assemblyId: assemblyId,
            actorId: user.uid,
            type: 'POLL_ANNULLED',
            targetId: poll.id,
            metadata: { reason: annulReason }
        });

        toast({ title: 'Votação Anulada', description: 'A votação foi anulada com sucesso.' });
        setAnnulConfirmOpen(false);
        setAnnulDialogOpen(false);
        setAnnulReason('');
    } catch (error) {
        console.error("Error annulling poll:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível anular a votação.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUpdateAnnulmentReason = async () => {
    if (!editTextAnnulment.trim() || !firestore) {
        toast({ variant: 'destructive', title: 'O motivo não pode estar vazio.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const pollRef = doc(firestore, 'assemblies', assemblyId, 'polls', poll.id);
        await updateDoc(pollRef, { 
            annulmentReason: editTextAnnulment,
            updatedAt: serverTimestamp() 
        });
        toast({ title: 'Motivo da anulação atualizado.' });
        setIsEditingAnnulment(false);
    } catch(error) {
        console.error("Error updating annulment reason:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o motivo.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const voteData = useMemo(() => {
    if (!options || !activeVotes) return [];
    return options.map(option => ({
      name: option.text,
      votos: activeVotes.filter(vote => vote.pollOptionId === option.id).length,
    }));
  }, [options, activeVotes]);

  const sortedVotesAlphabetically = useMemo(() => {
    if (!votes || !userProfiles) return [];
    return [...votes].sort((a, b) => {
        const nameA = userProfiles[a.effectiveVoterId]?.name ?? '';
        const nameB = userProfiles[b.effectiveVoterId]?.name ?? '';
        return nameA.localeCompare(nameB);
    });
}, [votes, userProfiles]);

  const recentVotes = useMemo(() => votes?.slice(0, 3) ?? [], [votes]);
  const votesToShow = showAllVotes ? sortedVotesAlphabetically : recentVotes;


  const isLoading = isLoadingOptions || isLoadingVotes;
  
  const quorumTextMap: Record<string, string> = {
    simple_majority: 'Maioria Simples',
    absolute_majority: 'Maioria Absoluta',
    two_thirds_majority: '2/3 dos Votantes',
  };

  const quorumText = poll.quorumType ? quorumTextMap[poll.quorumType] : '';
  let fullQuorumText = quorumText;
  if (poll.type === 'proposal' && poll.quorumType === 'absolute_majority' && poll.totalActiveMembers) {
    fullQuorumText = `${quorumText} (${poll.totalActiveMembers} membros)`;
  }
  
  if(isLoading) {
    return <Card><CardContent className="p-4"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></CardContent></Card>
  }

  return (
    <>
    <Card className="group relative">
        {isAdmin && pollAnnulled && !isEditingAnnulment && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingAnnulment(true)} disabled={isSubmitting}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar Motivo</span>
                </Button>
            </div>
        )}
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={poll.type === 'proposal' && !pollEnded ? 'default' : 'secondary'}>
                        {poll.type === 'proposal' ? 'Votação de Proposta' : 'Consulta de Opinião'}
                    </Badge>
                    {pollAnnulled && (
                        <span className="font-medium text-destructive">Votação Anulada</span>
                    )}
                </div>
                {!pollAnnulled && !pollEnded && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Tempo restante para votar: </span>
                        <Countdown endDate={pollEndDate} />
                    </div>
                )}
            </div>
            {isAdmin && !pollAnnulled && assemblyStatus !== 'finished' && (
                <Button variant="ghost" size="sm" className="h-8 -mt-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setAnnulDialogOpen(true)}>
                    Anular
                </Button>
            )}
        </div>
        {!pollAnnulled && 
          <>
            <CardTitle className="text-lg">{poll.question}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap !mt-1">
                <CardDescription className="flex items-center gap-1">
                    <Users className="h-4 w-4" /> {activeVotes.length ?? 0} votos
                </CardDescription>
                {poll.type === 'proposal' && fullQuorumText && (
                    <>
                        <Separator orientation="vertical" className="h-4" />
                        <CardDescription className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-primary/80" />
                            <span className="text-primary/90">{fullQuorumText}</span>
                        </CardDescription>
                    </>
                )}
            </div>
          </>
        }
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {pollAnnulled ? (
            isEditingAnnulment ? (
              <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{poll.question}</p>
                   <Textarea
                      placeholder="Escreva o motivo aqui..."
                      value={editTextAnnulment}
                      onChange={(e) => setEditTextAnnulment(e.target.value)}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  <div className="flex justify-end gap-1 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setIsEditingAnnulment(false); setEditTextAnnulment(poll.annulmentReason || ''); }} disabled={isSubmitting}>Cancelar</Button>
                    <Button size="sm" onClick={handleUpdateAnnulmentReason} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Salvar
                    </Button>
                  </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{poll.question}</p>
                  <div>
                      <p className="text-foreground">Motivo da anulação:</p>
                      <LinkifiedText text={poll.annulmentReason || ''} className="mt-1" />
                  </div>
              </div>
            )
        ) : !pollEnded ? (
          <div className="space-y-3">
              {hasActiveProxyGrant && (
                <div className="mb-2 p-3 flex items-start gap-3 rounded-md bg-blue-50 border-blue-200 text-blue-900 text-sm">
                    <Info className="h-5 w-5 mt-0.5 text-blue-700 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Sua procuração foi concedida.</p>
                        <p className="text-blue-800">
                           Você concedeu seu direito de voto para <span className="font-bold">{proxyGranteeProfile?.name ?? 'outro membro'}</span>, que votará em seu nome nesta assembleia. Seu voto pessoal está desabilitado.
                        </p>
                    </div>
                </div>
              )}
              {effectiveVoters.map((voter) => {
                  const vote = getVoteFor(voter.effectiveVoterId);
                  const selectedOption = selectedOptionsByVoterId[voter.effectiveVoterId] ?? '';
                  const isVoting = isVotingByVoterId[voter.effectiveVoterId] ?? false;
                  const isWithdrawing = isWithdrawingByVoterId[voter.effectiveVoterId] ?? false;
                  const hasActiveVote = vote?.status === 'active';
                  const hasWithdrawnVote = vote?.status === 'withdrawn';
              
                  return (
                    <div
                      key={voter.effectiveVoterId}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{voter.label}</p>
              
                          {!vote && (
                            <p className="text-xs text-muted-foreground">
                              Ainda sem voto registrado.
                            </p>
                          )}
              
                          {hasActiveVote && (
                            <p className="text-xs text-muted-foreground">
                              Voto ativo registrado. Para votar novamente, retire este voto primeiro.
                            </p>
                          )}
              
                          {hasWithdrawnVote && (
                            <p className="text-xs text-muted-foreground">
                              Voto retirado. Pode votar novamente enquanto a votação estiver aberta.
                            </p>
                          )}
                        </div>
                      </div>
              
                      {!hasActiveVote && options && (
                        <RadioGroup
                          value={selectedOption}
                          onValueChange={(optionId) =>
                            handleSelectedOptionChange(voter.effectiveVoterId, optionId)
                          }
                          className="space-y-2"
                        >
                          {options.map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center space-x-2"
                            >
                              <RadioGroupItem
                                value={option.id}
                                id={`${poll.id}-${voter.effectiveVoterId}-${option.id}`}
                              />
                              <Label htmlFor={`${poll.id}-${voter.effectiveVoterId}-${option.id}`} className="font-normal">
                                {option.text}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
              
                      <div className="flex gap-2">
                        {!hasActiveVote && (
                          <Button
                            onClick={() => handleVoteFor(voter)}
                            disabled={!selectedOption || isVoting}
                            size="sm"
                          >
                            {isVoting && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Send className="h-4 w-4" />
                            Votar
                          </Button>
                        )}
              
                        {hasActiveVote && (
                          <Button
                            variant="outline"
                            onClick={() => handleWithdrawVoteFor(voter)}
                            disabled={isWithdrawing}
                            size="sm"
                          >
                            {isWithdrawing && <Loader2 className="h-4 w-4 animate-spin" />}
                            Retirar voto
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
        ) : (
          <div>
            {poll.type === 'proposal' && pollResult && (
              <div className={`mb-4 p-3 rounded-md text-sm border ${
                  pollResult.status === 'Aprovada'
                  ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-500/30 dark:text-green-200'
                  : pollResult.status === 'Reprovada'
                  ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-500/30 dark:text-green-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-200'
              }`}>
              <div className="flex items-center gap-2">
                  {pollResult.status === 'Aprovada' && <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400" />}
                  {pollResult.status === 'Reprovada' && <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />}
                  {pollResult.status !== 'Aprovada' && pollResult.status !== 'Reprovada' && <Info className="h-5 w-5 text-amber-700 dark:text-amber-400" />}
                  <p className="font-semibold">Proposta {pollResult.status}</p>
              </div>
              <p className={`mt-1 text-xs ${
                  pollResult.status === 'Aprovada'
                  ? 'text-green-800 dark:text-green-300'
                  : pollResult.status === 'Reprovada'
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>{pollResult.message}</p>
              </div>
            )}

            <h3 className="mb-2 text-sm font-normal">Resultado Final:</h3>
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
            
            {activeVotes && activeVotes.length > 0 && (
                <>
                <Separator className="my-2" />
                <h3 className="mb-2 text-sm font-normal">Votos individuais:</h3>
                <div className={cn("space-y-1", showAllVotes && "max-h-48 overflow-y-auto pr-2")}>
                {votesToShow.map(vote => {
                    const voteBelongsToUser = userProfiles[vote.effectiveVoterId];
                    const option = options?.find(o => o.id === vote.pollOptionId);
                    const castByUser = vote.representedUserId ? userProfiles[vote.userId] : undefined;

                    return (
                    <div key={vote.id} className="flex items-start justify-between text-sm p-1.5 rounded-md bg-muted/50">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={voteBelongsToUser?.avatarDataUri} />
                                    <AvatarFallback>{voteBelongsToUser?.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{voteBelongsToUser?.name ?? 'Carregando...'}</span>
                            </div>
                            {castByUser && (
                                <p className="text-xs text-muted-foreground pl-8">
                                    → por procuração a <span className="font-medium">{castByUser.name}</span>
                                </p>
                            )}
                        </div>
                         <div className="flex flex-col text-right self-center">
                            {vote.status === 'active' ? (
                                <span className="font-medium">{option?.text}</span>
                            ) : (
                                <Badge variant="outline" className="text-xs">Retirado</Badge>
                            )}
                        </div>
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
        )}
      </CardContent>
      {poll.createdAt && (
        <CardFooter className="text-xs text-muted-foreground border-t p-2 flex-wrap justify-between items-center gap-x-4 gap-y-1">
            {pollAnnulled && poll.annulledAt ? (
                <>
                    <span>Anulada por <span className="font-medium">{pollAnnuler?.name ?? '...'}</span></span>
                    <span>às {format(poll.annulledAt.toDate(), "HH:mm")}</span>
                </>
            ) : (
                <div className='flex justify-between w-full'>
                    <span>Criada por <span className="font-medium">{pollCreator ? pollCreator.name : '...'}</span></span>
                    <div className="flex items-center gap-1">
                         <span>Início: {format(poll.createdAt.toDate(), "HH:mm")}</span>
                         <Separator orientation="vertical" className="h-3"/>
                         <span>Término: {format(poll.endDate.toDate(), "HH:mm")}</span>
                    </div>
                </div>
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
                  <Button variant="destructive" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar Anulação
                  </Button>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const getStatusBadge = (status: SpeakerQueueItem['status']) => {
      switch (status) {
        case 'Com a Fala':
            return <Badge variant="default" className="flex items-center gap-1"><MessageCircle className="h-3 w-3"/>{status}</Badge>;
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
        <div key={speaker.id} className="flex items-start p-2 bg-muted/50 rounded-lg gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      );
    }

    return (
      <div key={speaker.id} className="flex items-start p-2 bg-muted/50 rounded-lg gap-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={speakerUser.avatarDataUri} />
            <AvatarFallback>{speakerUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{speakerUser.name}</p>
            <p className="text-xs text-muted-foreground">{speakerUser.email}</p>
             {isCurrentUser && speaker.status === 'Entrada Autorizada' && assemblyZoomUrl && userInQueue ? (
                <Button size="sm" onClick={() => onEnterSpeakerMode(assemblyZoomUrl, userInQueue)} className="mt-2" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Video className="h-4 w-4" />} Entrar para Falar
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
      <div className="space-y-2">
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
        {!userInQueue && !isAdmin && <Button className="w-full" onClick={onJoinQueue} disabled={isLoading || assemblyFinished || isSubmitting}> <Hand className="h-4 w-4" /> Solicitar Palavra</Button>}
        {userInQueue && <Button variant="outline" className="w-full" onClick={onLeaveQueue} disabled={isSubmitting}>Cancelar Inscrição</Button>}
        
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(queue?.length || 2)].map((_, i) => (
               <div key={i} className="flex items-start p-2 bg-muted/50 rounded-lg gap-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="space-y-2">
            {queue && queue.length > 0 ? queue.map(renderSpeaker) : <p className="text-sm text-muted-foreground text-center pt-4">Ninguém na fila.</p>}
            </div>
        )}
      </div>
  )
}

const ataSchema = z.object({
  text: z.string().min(1, 'O registro não pode estar vazio.'),
});

function AdminActionCard({
  assembly,
  user,
}: {
  assembly: Assembly;
  user: any;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof ataSchema>>({
    resolver: zodResolver(ataSchema),
    defaultValues: { text: '' },
  });

  const onSubmit = async (values: z.infer<typeof ataSchema>) => {
    if (!user || !firestore) return;
    try {
        const ataRef = collection(firestore, 'assemblies', assembly.id, 'ata');
        const newAtaRef = await addDoc(ataRef, {
            text: values.text,
            assemblyId: assembly.id,
            administratorId: user.uid,
            assemblyStatus: assembly.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        await createAuditLog({
            firestore,
            assemblyId: assembly.id,
            actorId: user.uid,
            type: 'ATA_ITEM_CREATED',
            targetId: newAtaRef.id,
            metadata: { textLength: values.text.length }
        });

        toast({ title: 'Registro de Ata Publicado!' });
        form.reset();
    } catch (error) {
        console.error("Error adding to minutes:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível publicar o registro.' });
    }
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-1 text-lg"><BookText className="h-5 w-5" /> Adicionar na Ata</CardTitle>
        <CardDescription>Registre um fato ou deliberação para que conste na ata da assembleia.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="p-4 pt-0">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Ex: O membro X levantou a questão sobre o orçamento..." {...field} rows={3} disabled={form.formState.isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="p-4 pt-0 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Publicar Registro
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function AtaCard({ ataItem, isAdmin, user, assemblyFinished, userProfiles }: { ataItem: AtaItem, isAdmin: boolean, user: any, assemblyFinished: boolean, userProfiles: Record<string, UserProfile> }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(ataItem.text);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const admin = userProfiles[ataItem.administratorId];

  const handleUpdate = async () => {
    if (!editText.trim() || !firestore || !user) {
      toast({ variant: 'destructive', title: 'O registro não pode estar vazio.' });
      return;
    }
    setIsSubmitting(true);
    try {
        const itemRef = doc(firestore, 'assemblies', ataItem.assemblyId, 'ata', ataItem.id);
        await updateDoc(itemRef, { text: editText, updatedAt: serverTimestamp() });
        
        await createAuditLog({
            firestore,
            assemblyId: ataItem.assemblyId,
            actorId: user.uid,
            type: 'ATA_ITEM_UPDATED',
            targetId: ataItem.id,
        });

        toast({ title: 'Registro atualizado!' });
        setIsEditing(false);
    } catch(error) {
        console.error("Error updating minutes item:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o registro.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
        const itemRef = doc(firestore, 'assemblies', ataItem.assemblyId, 'ata', ataItem.id);
        await deleteDoc(itemRef);
        toast({ title: 'Registro removido.' });
        setIsDeleteDialogOpen(false);
    } catch (error) {
        console.error("Error deleting minutes item:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o registro.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="group relative">
         {isAdmin && !assemblyFinished && !isEditing && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remover</span>
                </Button>
            </div>
        )}
        <CardContent className="p-4">
          {isEditing ? (
            <div className="space-y-1">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} disabled={isSubmitting} />
              <div className="flex justify-end gap-1 pt-1">
                <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditText(ataItem.text); }} disabled={isSubmitting}>Cancelar</Button>
                <Button size="sm" onClick={handleUpdate} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin"/>}
                    Salvar
                </Button>
              </div>
            </div>
          ) : (
            <LinkifiedText text={ataItem.text} className="text-sm text-muted-foreground" />
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground border-t p-2">
          <div className="flex items-center gap-1">
            {admin ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={admin.avatarDataUri} />
                  <AvatarFallback>{admin.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{admin.name}</span>
              </>
            ) : <Loader2 className="h-4 w-4 animate-spin"/>}
            <span>às {ataItem.createdAt ? format(ataItem.createdAt.toDate(), "HH:mm") : '...'}</span>
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitleComponent>Tem certeza?</AlertDialogTitleComponent>
            <AlertDialogDescriptionComponent>
              Você está prestes a remover este registro da ata.
              <br /><br />
              <span className="font-bold">⚠️ Esta ação não pode ser desfeita.</span>
            </AlertDialogDescriptionComponent>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} asChild>
              <Button variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin"/>}
                Remover Registro
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


export default function AssemblyPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { toast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerZoomLink, setSpeakerZoomLink] = useState('');
  const [adminVideoSource, setAdminVideoSource] = useState<'youtube' | 'zoom'>('zoom');
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [isSubmittingQueue, setIsSubmittingQueue] = useState(false);

  const assemblyContext = useAssemblyContext();
  const { setAssembly, isQueueOpen, setIsQueueOpen, isChatOpen, setIsChatOpen, isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen, isStartAssemblyDialogOpen, setIsStartAssemblyDialogOpen, setAttendees, setTimelineItems, isCreatePollOpen, setIsCreatePollOpen } = assemblyContext!;

  // --- Data Fetching ---
  const assemblyRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return doc(firestore, 'assemblies', params.id);
  }, [firestore, params.id, user]);

  const { data: assembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);
  const assemblyId = assembly?.id;

  const pollsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'polls'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user]);
  
  const queueQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'speakerQueue'), orderBy('joinedAt', 'asc'));
  }, [firestore, params.id, user]);

  const ataQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(collection(firestore, 'assemblies', params.id, 'ata'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user]);
  
  // Proxy Voting Data
  const representedUsersQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return query(
        collection(firestore, 'assemblies', params.id, 'proxies'), 
        where('proxyId', '==', user.uid),
        where('status', '==', 'active')
    );
  }, [firestore, params.id, user]);

  const userProxyGrantQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user) return null;
    return doc(firestore, 'assemblies', params.id, 'proxies', user.uid);
  }, [firestore, params.id, user]);

  const { data: polls, isLoading: arePollsLoading } = useCollection<Poll>(pollsQuery);
  const { data: queue, isLoading: isQueueLoading } = useCollection<SpeakerQueueItem>(queueQuery);
  const { data: ataItems, isLoading: areAtaItemsLoading } = useCollection<AtaItem>(ataQuery);
  const { data: representedAssignments } = useCollection<ProxyAssignment>(representedUsersQuery);
  const { data: userProxyGrant } = useDoc<ProxyAssignment>(userProxyGrantQuery);


  const userIdsInQueue = useMemo(() => queue?.map(s => s.userId) ?? [], [queue]);
  const userIdsInAta = useMemo(() => ataItems?.map(a => a.administratorId) ?? [], [ataItems]);
  const proxyGranteeId = userProxyGrant?.proxyId;
  const grantorIds = useMemo(() => representedAssignments?.map(a => a.grantorId) ?? [], [representedAssignments]);

  const allUserIdsToFetch = useMemo(() => {
      const ids = new Set([...userIdsInQueue, ...userIdsInAta, ...grantorIds]);
      if (proxyGranteeId) ids.add(proxyGranteeId);
      return Array.from(ids);
  }, [userIdsInQueue, userIdsInAta, proxyGranteeId, grantorIds]);

  const { profiles: userProfiles, isLoading: areProfilesLoading } = useUserProfiles(allUserIdsToFetch);
  const userInQueue = useMemo(() => queue?.find(s => s.userId === user?.uid), [queue, user]);

  const timelineItems = useMemo(() => {
    const combined = [
      ...(polls || []),
      ...(ataItems || [])
    ];
    
    combined.sort((a, b) => {
        const dateA = a.createdAt?.toDate() ?? new Date(0);
        const dateB = b.createdAt?.toDate() ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    return combined;
  }, [polls, ataItems]);

  const hasOpenPolls = useMemo(() => {
    return polls?.some(p => p.status === 'open' && !isPast(p.endDate.toDate())) ?? false;
  }, [polls]);
  
  useEffect(() => {
    if (assembly) {
      setAssembly(assembly);
    }
    return () => {
      setAssembly(null);
    };
  }, [assembly, setAssembly]);

  useEffect(() => {
    if (timelineItems) {
        setTimelineItems(timelineItems);
    }
    return () => {
        setTimelineItems([]);
    }
  }, [timelineItems, setTimelineItems]);

  // Show welcome dialog when member enters a live assembly
  useEffect(() => {
    if (assembly?.status === 'live' && !isAdmin && !isAdminLoading) {
      const welcomeKey = `welcome-shown-${assembly.id}`;
      if (!sessionStorage.getItem(welcomeKey)) {
        setShowWelcomeDialog(true);
        sessionStorage.setItem(welcomeKey, 'true');
      }
    }
  }, [assembly?.status, assembly?.id, isAdmin, isAdminLoading]);

  // --- Presence Logic (Heartbeat) ---
  useEffect(() => {
    if (!firestore || !user || !assemblyId) return;

    const presenceRef = doc(firestore, 'assemblies', assemblyId, 'presence', user.uid);

    setDoc(presenceRef, { 
        joinedAt: serverTimestamp(), 
        lastSeen: serverTimestamp() 
    }, { merge: true });

    const interval = setInterval(() => {
        updateDoc(presenceRef, { lastSeen: serverTimestamp() });
    }, 15000);

    const handleBeforeUnload = () => {
      deleteDoc(presenceRef);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        deleteDoc(presenceRef);
    };
  }, [firestore, user, assemblyId]);

  const presenceQuery = useMemoFirebase(() => {
      if (!firestore || !assemblyId) return null;
      return collection(firestore, 'assemblies', assemblyId, 'presence');
  }, [firestore, assemblyId]);

  const { data: allPresenceData } = useCollection<AssemblyPresence>(presenceQuery);

  const activePresenceData = useMemo(() => {
      if (!allPresenceData) return [];
      const now = Date.now();
      const thirtySecondsAgo = now - 30000;
      return allPresenceData.filter(p => p.lastSeen && p.lastSeen.toDate().getTime() > thirtySecondsAgo);
  }, [allPresenceData]);

  const attendeeIds = useMemo(() => activePresenceData?.map(p => p.id) ?? [], [activePresenceData]);
  const { profiles: attendeeProfiles } = useUserProfiles(attendeeIds);

  useEffect(() => {
      if (attendeeProfiles) {
          const profilesArray = Object.values(attendeeProfiles);
          profilesArray.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setAttendees(profilesArray);
      } else {
        setAttendees([]);
      }
  }, [attendeeProfiles, setAttendees]);


  const handleJoinQueue = async () => {
    if (!user || !assembly || !firestore) return;
    setIsSubmittingQueue(true);
    try {
        const queueItemRef = doc(firestore, 'assemblies', assembly.id, 'speakerQueue', user.uid);
        const queueItem: Omit<SpeakerQueueItem, 'id' | 'joinedAt'> & { joinedAt: any } = {
            userId: user.uid,
            assemblyId: assembly.id,
            joinedAt: serverTimestamp(),
            status: 'Na Fila',
            administratorId: assembly.administratorId,
            assemblyStatus: assembly.status,
        };
        await setDoc(queueItemRef, queueItem, { merge: true });
        toast({ title: 'Inscrição Realizada', description: 'Você foi adicionado à fila para falar.' });
    } catch (error) {
        console.error("Error joining queue:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível realizar a inscrição.' });
    } finally {
        setIsSubmittingQueue(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!userInQueue || !firestore) return;
    setIsSubmittingQueue(true);
    try {
        const itemRef = doc(firestore, 'assemblies', userInQueue.assemblyId, 'speakerQueue', userInQueue.id);
        await deleteDoc(itemRef);
        toast({ title: 'Inscrição Cancelada', description: 'Você foi removido da fila.' });
    } catch (error) {
        console.error("Error leaving queue:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar a inscrição.' });
    } finally {
        setIsSubmittingQueue(false);
    }
  };

  const handleEnterSpeakerMode = async (zoomLink: string, queueItem: SpeakerQueueItem) => {
      if(!zoomLink) {
        toast({ variant: 'destructive', title: 'Erro', description: 'O administrador ainda não forneceu um link do Zoom.' });
        return;
      }
      if (!firestore) return;
      setIsSubmittingQueue(true);
      try {
          const itemRef = doc(firestore, 'assemblies', queueItem.assemblyId, 'speakerQueue', queueItem.id);
          await updateDoc(itemRef, { status: 'Com a Fala' });
          
          setSpeakerZoomLink(zoomLink);
          setIsSpeaking(true);
      } catch (error) {
          console.error("Error entering speaker mode:", error);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível alterar seu status.' });
      } finally {
          setIsSubmittingQueue(false);
      }
  };
  
  const handleEndParticipation = async () => {
      if (!userInQueue || !firestore) return;
      setIsSubmittingQueue(true);
      try {
          const itemRef = doc(firestore, 'assemblies', userInQueue.assemblyId, 'speakerQueue', userInQueue.id);
          await deleteDoc(itemRef);
          setIsSpeaking(false);
          setSpeakerZoomLink('');
          toast({ title: 'Participação Encerrada', description: 'Você saiu da chamada e foi removido da fila.' });
      } catch (error) {
          console.error("Error ending participation:", error);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível encerrar a participação.' });
      } finally {
          setIsSubmittingQueue(false);
      }
  };

  const displayEmbedUrl = useMemo(() => {
    return assembly ? convertToEmbedUrl(assembly.youtubeUrl) : '';
  }, [assembly]);

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
  
  return (
    <>
    <StartAssemblyDialog
      open={isStartAssemblyDialogOpen}
      onOpenChange={setIsStartAssemblyDialogOpen}
      assembly={assembly}
      user={user}
    />
    <EndAssemblyDialog
      open={isEndAssemblyDialogOpen}
      onOpenChange={setIsEndAssemblyDialogOpen}
      assembly={assembly}
      user={user}
    />
    <ChatSheet
      open={isChatOpen}
      onOpenChange={setIsChatOpen}
      assemblyId={assembly.id}
    />
    <AttendeesSheet />
    <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center gap-1"><Mic className="h-6 w-6" /> Fila de Inscrição</SheetTitle>
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

      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assembleia em Andamento</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Seja bem-vindo! Você está visualizando a transmissão ao vivo da assembleia.
              </p>
              <p>
                Para participar com **voz e vídeo**, você deve solicitar a palavra na **Fila de Inscrição** e aguardar a autorização do administrador.
              </p>
              <p>
                Leia também a **minuta da ata**, que é atualizada em tempo real por nossa equipe, e fique atento às **votações** que aparecerão nos registros da ata durante o evento.
              </p>
              <p>
                Utilize o **Chat** interno do sistema para interagir informalmente com outros membros, pedir ajuda ou informar qualquer instabilidade técnica.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcomeDialog(false)} className="w-full">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto p-0 md:space-y-4">
        <div className="space-y-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex-1">
                   {isSpeaking && (
                      <Alert variant="default" className="bg-blue-50 border-blue-200">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800 text-sm font-semibold">Modo de Fala Ativado</AlertTitle>
                        <AlertDescription className="text-blue-700 text-xs">
                          Você está prestes a entrar na sala do Zoom. Por favor, **permita o acesso à sua câmera e microfone** no aviso que aparecerá no seu navegador. O sistema não armazena essas permissões permanentemente.
                        </AlertDescription>
                      </Alert>
                   )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  {isSpeaking && (
                      <Button onClick={handleEndParticipation} variant="destructive" size="sm" disabled={isSubmittingQueue}>
                          {isSubmittingQueue ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogOut className="h-4 w-4" />}
                          Encerrar Participação
                      </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  {isAdmin && assembly.status === 'live' && (
                    <div className="absolute top-2 right-2 z-20 flex gap-1 bg-black/20 p-1 rounded-md backdrop-blur-sm">
                      <Button 
                        size="sm" 
                        variant={adminVideoSource === 'zoom' ? 'default' : 'secondary'}
                        onClick={() => setAdminVideoSource('zoom')}
                        className="h-7 px-3 text-xs"
                      >
                        <Video className="h-3 w-3 mr-1" /> Zoom
                      </Button>
                      <Button 
                        size="sm" 
                        variant={adminVideoSource === 'youtube' ? 'default' : 'secondary'}
                        onClick={() => setAdminVideoSource('youtube')}
                        className="h-7 px-3 text-xs"
                      >
                        <Play className="h-3 w-3 mr-1" fill="currentColor" /> YouTube
                      </Button>
                    </div>
                  )}

                  {assembly.status === 'finished' ? (
                    displayEmbedUrl ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={displayEmbedUrl}
                        title="Gravação da Assembleia"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="border-0"
                      ></iframe>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center bg-muted gap-2">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">A gravação desta assembleia não está disponível</p>
                      </div>
                    )
                  ) : isAdmin && assembly.status === 'live' ? (
                    adminVideoSource === 'zoom' && assembly.zoomUrl ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={convertToZoomEmbedUrl(assembly.zoomUrl)}
                        title="Zoom Meeting"
                        allow="fullscreen; microphone; camera; display-capture; autoplay"
                        className="border-0"
                      ></iframe>
                    ) : displayEmbedUrl ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={displayEmbedUrl}
                        title="YouTube Stream Preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="border-0"
                      ></iframe>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted">
                        <p className="text-muted-foreground">Vídeo indisponível</p>
                      </div>
                    )
                  ) : isSpeaking && speakerZoomLink ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={convertToZoomEmbedUrl(speakerZoomLink)}
                      title="Zoom Meeting"
                      allow="fullscreen; microphone; camera; display-capture; autoplay"
                      className="border-0"
                    ></iframe>
                  ) : displayEmbedUrl ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={displayEmbedUrl}
                      title="YouTube Live Stream"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="border-0"
                    ></iframe>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                        <p className="text-muted-foreground">A transmissão ainda não está disponível</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {isAdmin && assembly.status === 'live' && (
              <AdminActionCard
                assembly={assembly}
                user={user}
              />
            )}
            
            {isAdmin && assembly.status === 'live' && (
              <CreatePollSheet
                open={isCreatePollOpen}
                onOpenChange={setIsCreatePollOpen}
                assembly={assembly}
                user={user}
              />
            )}

            <div className="flex items-center gap-2 pt-4 pb-2">
                <BookText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold tracking-tight">Ata da Assembleia</h2>
                {hasOpenPolls && (
                  <Badge variant="destructive" className="animate-pulse ml-2">
                    VOTAÇÃO EM ANDAMENTO
                  </Badge>
                )}
            </div>

            <div className="space-y-4">
              {(arePollsLoading || areAtaItemsLoading) && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
              
              {timelineItems && timelineItems.length > 0 ? (
                  timelineItems.map(item => (
                     'question' in item
                      ? <PollCard key={item.id} poll={item as Poll} assemblyId={assembly.id} assemblyStatus={assembly.status} isAdmin={isAdmin} representedAssignments={representedAssignments} userProxyGrant={userProxyGrant} userProfiles={userProfiles} />
                      : <AtaCard key={item.id} ataItem={item as AtaItem} isAdmin={isAdmin} user={user} assemblyFinished={assemblyFinished} userProfiles={userProfiles} />
                  ))
              ) : (
                  !arePollsLoading && !areAtaItemsLoading && <p className="text-sm text-center text-muted-foreground pt-4">Nenhuma votação ou registro na ata para esta assembleia.</p>
              )}
            </div>
        </div>
      </div>
    </>
  );
}
