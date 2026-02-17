import Link from 'next/link';
import { MOCK_DATA } from '@/lib/data';
import type { Assembly } from '@/lib/data';
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
import { ArrowRight, PlusCircle } from 'lucide-react';

function AssemblyCard({ assembly }: { assembly: Assembly }) {
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

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <Image
            src={assembly.imageUrl}
            alt={assembly.title}
            layout="fill"
            objectFit="cover"
            data-ai-hint="meeting conference"
          />
          <div className="absolute top-2 right-2">
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
          {format(assembly.date, "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
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
  const assemblies = MOCK_DATA.assemblies;

  return (
    <div className="container mx-auto p-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Assembleias</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Criar Assembleia
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {assemblies.map((assembly) => (
          <AssemblyCard key={assembly.id} assembly={assembly} />
        ))}
      </div>
    </div>
  );
}
