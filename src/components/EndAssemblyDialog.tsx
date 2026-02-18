'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Assembly } from '@/lib/data';
import { useRouter } from 'next/navigation';

interface EndAssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly | null;
}

export function EndAssemblyDialog({ open, onOpenChange, assembly }: EndAssemblyDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const handleConfirm = () => {
    if (!firestore || !assembly) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível encerrar a assembleia.',
      });
      return;
    }

    const assemblyRef = doc(firestore, 'assemblies', assembly.id);
    updateDocumentNonBlocking(assemblyRef, {
      status: 'finished',
      updatedAt: serverTimestamp(),
      endedAt: serverTimestamp(),
    });

    toast({
      title: 'Assembleia Encerrada',
      description: 'A assembleia foi marcada como finalizada.',
    });
    onOpenChange(false);
    router.push('/dashboard');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar Assembleia?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja encerrar esta assembleia? Após o encerramento,
            nenhuma alteração poderá ser feita e as funcionalidades como votação
            e fila de inscrição serão desativadas permanentemente para este evento.
            <br />
            <br />
            <span className="font-bold">⚠️ Esta ação não pode ser desfeita.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleConfirm} variant="destructive">
              Encerrar Assembleia
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
