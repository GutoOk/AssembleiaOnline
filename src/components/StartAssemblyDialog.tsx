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
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createAuditLog } from '@/lib/services/audit.service';
import type { User } from 'firebase/auth';

interface StartAssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assembly: Assembly | null;
  user: User | null;
}

export function StartAssemblyDialog({ open, onOpenChange, assembly, user }: StartAssemblyDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  const handleConfirm = async () => {
    if (!firestore || !assembly || !user) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível iniciar a assembleia.',
      });
      return;
    }
    
    setIsStarting(true);
    try {
        const assemblyRef = doc(firestore, 'assemblies', assembly.id);
        await updateDoc(assemblyRef, {
        status: 'live',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        });
        
        await createAuditLog({
            firestore,
            assemblyId: assembly.id,
            actorId: user.uid,
            type: 'ASSEMBLY_STARTED',
            targetId: assembly.id,
        });

        toast({
        title: 'Assembleia Iniciada!',
        description: 'A assembleia foi marcada como "Ao Vivo".',
        });
        onOpenChange(false);
    } catch(error) {
        console.error("Error starting assembly:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Iniciar',
            description: 'Não foi possível iniciar a assembleia. Tente novamente.',
        });
    } finally {
        setIsStarting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Iniciar Assembleia?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja iniciar esta assembleia? O status será alterado
            para "Ao Vivo" e o horário de início será registrado.
            <br />
            <br />
            <span className="font-bold">⚠️ Esta ação não pode ser desfeita.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700" disabled={isStarting}>
              {isStarting && <Loader2 className="h-4 w-4 animate-spin"/>}
              Iniciar Assembleia
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
