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
import { useFirestore } from '@/firebase';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Assembly } from '@/lib/data';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface EndAssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly | null;
}

export function EndAssemblyDialog({ open, onOpenChange, assembly }: EndAssemblyDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);

  const handleConfirm = async () => {
    if (!firestore || !assembly) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível encerrar a assembleia.',
      });
      return;
    }
    
    setIsEnding(true);
    try {
        const assemblyRef = doc(firestore, 'assemblies', assembly.id);
        await updateDoc(assemblyRef, {
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
    } catch(error) {
        console.error("Error ending assembly:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Encerrar',
            description: 'Não foi possível encerrar a assembleia. Tente novamente.',
        });
    } finally {
        setIsEnding(false);
    }
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
            <Button onClick={handleConfirm} variant="destructive" disabled={isEnding}>
              {isEnding && <Loader2 className="h-4 w-4 animate-spin" />}
              Encerrar Assembleia
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
