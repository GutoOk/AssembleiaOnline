'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, deleteDoc, writeBatch, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import type { SpeakerQueueItem, UserProfile } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from 'react';

interface ManageQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assemblyId: string;
  queue: SpeakerQueueItem[];
  userProfiles: Record<string, UserProfile>;
}

export function ManageQueueDialog({ open, onOpenChange, assemblyId, queue, userProfiles }: ManageQueueDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Store ID of item being processed

  const handleStatusChange = async (item: SpeakerQueueItem, newStatus: SpeakerQueueItem['status']) => {
    if (!firestore || !user) return;
    setIsSubmitting(item.id);
    
    try {
        const batch = writeBatch(firestore);
        const itemRef = doc(firestore, 'assemblies', assemblyId, 'speakerQueue', item.id);
        
        const shouldGrantZoomAccess =
            (newStatus === 'Entrada Autorizada' || newStatus === 'Com a Fala') &&
            item.status === 'Na Fila';
        
        const wasAuthorized =
            item.status === 'Entrada Autorizada' || item.status === 'Com a Fala';
        const willBeUnauthorized = newStatus === 'Na Fila';
        
        if (shouldGrantZoomAccess) {
            const configRef = doc(firestore, 'assemblies', assemblyId, 'private', 'config');
            const configSnap = await getDoc(configRef);
            const zoomUrl = configSnap.exists() ? configSnap.data().zoomUrl : null;

            if (!zoomUrl) {
                toast({
                    variant: 'destructive',
                    title: 'Zoom não configurado',
                    description: 'Cadastre o link do Zoom privado antes de autorizar um participante.',
                });
                setIsSubmitting(null);
                return;
            }

            const accessRef = doc(firestore, 'assemblies', assemblyId, 'speakerAccess', item.userId);
            batch.set(accessRef, {
                userId: item.userId,
                zoomUrl,
                active: true,
                createdAt: serverTimestamp(),
                createdBy: user.uid,
                expiresAt: null,
            }, { merge: true });

            const auditRef = doc(collection(firestore, 'assemblies', assemblyId, 'auditLogs'));
            batch.set(auditRef, {
              type: 'ZOOM_ACCESS_GRANTED',
              assemblyId: assemblyId,
              actorId: user.uid,
              targetId: item.id,
              metadata: { queueItemId: item.id },
              createdAt: serverTimestamp(),
            });
        }
        
        if (wasAuthorized && willBeUnauthorized) {
            const accessRef = doc(firestore, 'assemblies', assemblyId, 'speakerAccess', item.userId);
            batch.set(accessRef, {
                active: false,
                zoomUrl: null,
                revokedAt: serverTimestamp(),
                revokedBy: user.uid,
            }, { merge: true });
            
             const auditRef = doc(collection(firestore, 'assemblies', assemblyId, 'auditLogs'));
              batch.set(auditRef, {
                type: 'ZOOM_ACCESS_REVOKED',
                assemblyId: assemblyId,
                actorId: user.uid,
                targetId: item.id,
                metadata: { queueItemId: item.id, reason: 'Status changed back to queue' },
                createdAt: serverTimestamp(),
              });
        }

        batch.update(itemRef, { status: newStatus });
        await batch.commit();
        toast({ title: 'Status Atualizado', description: 'O status do participante foi alterado.' });
    } catch(error) {
        console.error("Error changing status:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível alterar o status.' });
    } finally {
        setIsSubmitting(null);
    }
  };

  const handleDelete = async (item: SpeakerQueueItem) => {
    if (!firestore || !user) return;
    setIsSubmitting(item.id);
    try {
        const batch = writeBatch(firestore);
        const itemRef = doc(firestore, 'assemblies', assemblyId, 'speakerQueue', item.id);
        batch.delete(itemRef);

        if (item.status === 'Entrada Autorizada' || item.status === 'Com a Fala') {
            const accessRef = doc(firestore, 'assemblies', assemblyId, 'speakerAccess', item.id);
            batch.set(accessRef, {
                active: false,
                zoomUrl: null,
                revokedAt: serverTimestamp(),
                revokedBy: user.uid,
            }, { merge: true });

            const auditRef = doc(collection(firestore, 'assemblies', assemblyId, 'auditLogs'));
            batch.set(auditRef, {
                type: 'ZOOM_ACCESS_REVOKED',
                assemblyId: assemblyId,
                actorId: user.uid,
                targetId: item.id,
                metadata: { queueItemId: item.id, reason: 'Removed from queue' },
                createdAt: serverTimestamp(),
            });
        }

        await batch.commit();

        toast({ title: 'Participante Removido', description: 'O participante foi removido da fila.' });
    } catch(error) {
        console.error("Error deleting from queue:", error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o participante.' });
    } finally {
        setIsSubmitting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Fila de Inscrição</DialogTitle>
          <DialogDescription>
            Altere o status e remova participantes da fila.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length > 0 ? queue.map(item => {
                const userProfile = userProfiles[item.userId];
                const isProcessing = isSubmitting === item.id;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {userProfile ? (
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={userProfile.avatarDataUri} alt={userProfile.name} />
                            <AvatarFallback>{userProfile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{userProfile.name}</span>
                        </div>
                      ) : <Loader2 className="h-4 w-4 animate-spin" />}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(newStatus: SpeakerQueueItem['status']) => handleStatusChange(item, newStatus)}
                        disabled={!!isSubmitting}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Na Fila">Na Fila</SelectItem>
                          <SelectItem value="Entrada Autorizada">Entrada Autorizada</SelectItem>
                          <SelectItem value="Com a Fala">Com a Fala</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} disabled={!!isSubmitting}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                        <span className="sr-only">Remover</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Nenhum participante na fila.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
