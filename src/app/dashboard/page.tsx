'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Pencil } from 'lucide-react';
import { useAdmin } from '@/hooks/use-admin';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Assembly } from '@/lib/data';

function AssemblyCard({ assembly, isAdmin }: { assembly: Assembly, isAdmin: boolean }) {
  const getStatusVariant = (status: Assembly['status']) => {
    switch (status) {
      case 'live':
        return 'destructive';
      case 'finished':
        return 'secondary';
      case 'scheduled':
      default:
        return 'default';
    }
  };

  const assemblyDate = assembly.date instanceof Date ? assembly.date : (assembly.date as any).toDate();

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <Image
            src={assembly.imageUrl}
            alt={assembly.title}
            fill
            className="object-cover"
            data-ai-hint="meeting conference"
          />
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            {assembly.accessMode === 'restricted_email_list' && (
              <Badge variant="outline">Restrita</Badge>
            )}
            {assembly.authorizedParticipantsImportStatus === 'failed' && isAdmin && (
              <Badge variant="destructive">Erro na lista</Badge>
            )}
            {isAdmin && (
              <Button asChild variant="secondary" size="icon" className="h-7 w-7">
                <Link href={`/dashboard/assemblies/${assembly.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Editar Assembleia</span>
                </Link>
              </Button>
            )}
            <Badge variant={getStatusVariant(assembly.status)} className="capitalize">
              {assembly.status === 'live' && <span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span>}
              {assembly.status === 'live' ? 'Ao Vivo' : assembly.status === 'scheduled' ? 'Agendada' : 'Finalizada'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg mb-2 line-clamp-2">{assembly.title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground line-clamp-3">
          {assembly.description}
        </CardDescription>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          {format(assemblyDate, "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
        <Button size="sm" asChild variant="ghost">
          <Link href={`/assemblies/${assembly.id}`}>
            Acessar <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isLoading: isAdminLoading } = useAdmin();
  const firestore = useFirestore();

  const assembliesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'assemblies'), orderBy('date', 'desc'));
  }, [firestore, user]);

  const { data: assemblies, isLoading: areAssembliesLoading } = useCollection<Assembly>(assembliesQuery);

  const isLoading = isAdminLoading || areAssembliesLoading;

  return (
    <>
      {isLoading ? (
         <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {assemblies && assemblies.length > 0 ? (
            assemblies.map((assembly) => (
              <AssemblyCard key={assembly.id} assembly={assembly} isAdmin={isAdmin} />
            ))
          ) : (
            <p>Nenhuma assembleia encontrada.</p>
          )}
        </div>
      )}
    </>
  );
}
