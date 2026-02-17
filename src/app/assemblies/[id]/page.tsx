'use client';
import { MOCK_DATA } from '@/lib/data';
import type { Assembly, User, Poll, Speaker } from '@/lib/data';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, Mic, PlusCircle, Send, Users, Video, Link as LinkIcon, Hand } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

const getUserById = (id: string) => MOCK_DATA.users.find(u => u.id === id);

function Countdown({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState(endDate.getTime() - Date.now());

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(endDate.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate, timeLeft]);

  if (timeLeft <= 0) {
    return <span className="text-sm text-destructive">Encerrada</span>;
  }

  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  return <span className="text-sm font-mono text-muted-foreground">{`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}</span>;
}

function PollCard({ poll, user }: { poll: Poll, user: User | null }) {
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const userVote = poll.votes.find(v => v.userId === user?.id);
  const pollEnded = new Date() > poll.endDate;

  const voteData = poll.options.map(option => ({
    name: option.text,
    votos: poll.votes.filter(vote => vote.optionId === option.id).length,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{poll.question}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Users className="h-4 w-4" /> {poll.votes.length} votos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Countdown endDate={poll.endDate} />
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
            <Separator className="my-4" />
             <h3 className="font-semibold mb-2 text-sm">Votos individuais:</h3>
            <div className="space-y-2">
              {poll.votes.map(vote => {
                const voter = getUserById(vote.userId);
                const option = poll.options.find(o => o.id === vote.optionId);
                return (
                  <div key={vote.userId} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={voter?.avatarUrl} />
                        <AvatarFallback>{voter?.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{voter?.name}</span>
                    </div>
                    <span className="font-medium">{option?.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup onValueChange={setSelectedOption} value={selectedOption}>
              {poll.options.map(option => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id}>{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button disabled={!selectedOption}>
              <Send className="mr-2 h-4 w-4" />
              Votar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SpeakingQueue({ queue, assemblyId, user, isAdmin }: { queue: Speaker[], assemblyId: string, user: User | null, isAdmin: boolean }) {
  const userInQueue = queue.find(s => s.userId === user?.id);

  const renderSpeaker = (speaker: Speaker, index: number) => {
    const speakerUser = getUserById(speaker.userId);
    if (!speakerUser) return null;

    const statusBadge = (status: Speaker['status']) => {
      switch(status) {
        case 'speaking': return <Badge variant="destructive">Falando</Badge>;
        case 'next': return <Badge variant="outline" className="border-primary text-primary">Próximo</Badge>;
        case 'waiting': return <Badge variant="secondary">Aguardando</Badge>;
      }
    };

    return (
      <div key={speaker.userId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
          <Avatar className="h-9 w-9">
            <AvatarImage src={speakerUser.avatarUrl} />
            <AvatarFallback>{speakerUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{speakerUser.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(speaker.joinedAt, { locale: ptBR, addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {speaker.status === 'speaking' && speaker.zoomLink && (
            <Button size="sm" asChild>
              <Link href={speaker.zoomLink} target="_blank">
                <Video className="h-4 w-4 mr-2" /> Entrar no Zoom
              </Link>
            </Button>
          )}
          {statusBadge(speaker.status)}
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
        {isAdmin && <Button className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Gerenciar Inscrições</Button>}
        {!userInQueue && !isAdmin && <Button className="w-full"><Hand className="mr-2 h-4 w-4" /> Solicitar Palavra</Button>}
        {userInQueue && <Button variant="outline" className="w-full">Cancelar Inscrição</Button>}
        <div className="space-y-3">
          {queue.sort((a,b) => a.joinedAt.getTime() - b.joinedAt.getTime()).map(renderSpeaker)}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AssemblyPage() {
  const params = useParams<{ id: string }>();
  const assembly = MOCK_DATA.assemblies.find((a) => a.id === params.id);
  const { user, isAdmin } = useAuth();

  if (!assembly) {
    notFound();
  }

  return (
    <div className="container mx-auto p-0 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{assembly.title}</h1>
        <p className="text-muted-foreground mt-1">
          {format(assembly.date, "eeee, dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Video className="h-6 w-6" /> Transmissão ao Vivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full overflow-hidden rounded-lg border">
                <iframe
                  width="100%"
                  height="100%"
                  src={assembly.youtubeUrl}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {isAdmin && <Button><PlusCircle className="mr-2 h-4 w-4"/> Nova Votação</Button>}
            {assembly.polls.map(poll => (
              <PollCard key={poll.id} poll={poll} user={user} />
            ))}
          </div>
        </div>

        <div className="md:col-span-1 space-y-8">
            <SpeakingQueue queue={assembly.speakingQueue} assemblyId={assembly.id} user={user} isAdmin={isAdmin}/>
        </div>
      </div>
    </div>
  );
}
