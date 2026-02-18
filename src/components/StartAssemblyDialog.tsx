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

interface StartAssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly | null;
}

export function StartAssemblyDialog({ open, onOpenChange, assembly }: StartAssemblyDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!firestore || !assembly) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível iniciar a assembleia.',
      });
      return;
    }

    const assemblyRef = doc(firestore, 'assemblies', assembly.id);
    updateDocumentNonBlocking(assemblyRef, {
      status: 'live',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    toast({
      title: 'Assembleia Iniciada!',
      description: 'A assembleia foi marcada como "Ao Vivo".',
    });
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Iniciar Assembleia?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja iniciar esta assembleia? O status será alterado
            para "Ao Vivo" e o horário de início será registrado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
              Iniciar Assembleia
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

    