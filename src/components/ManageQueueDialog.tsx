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
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
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

interface ManageQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assemblyId: string;
  queue: SpeakerQueueItem[];
  userProfiles: Record<string, UserProfile>;
}

export function ManageQueueDialog({ open, onOpenChange, assemblyId, queue, userProfiles }: ManageQueueDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleStatusChange = (itemId: string, newStatus: SpeakerQueueItem['status']) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'assemblies', assemblyId, 'speakerQueue', itemId);
    updateDocumentNonBlocking(itemRef, { status: newStatus });
    toast({ title: 'Status Atualizado', description: 'O status do participante foi alterado.' });
  };

  const handleDelete = (itemId: string) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'assemblies', assemblyId, 'speakerQueue', itemId);
    deleteDocumentNonBlocking(itemRef);
    toast({ title: 'Participante Removido', description: 'O participante foi removido da fila.' });
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
                const user = userProfiles[item.userId];
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {user ? (
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarDataUri} alt={user.name} />
                            <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      ) : <Loader2 className="h-4 w-4 animate-spin" />}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(newStatus: SpeakerQueueItem['status']) => handleStatusChange(item.id, newStatus)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Na Fila">Na Fila</SelectItem>
                          <SelectItem value="Entrada Autorizada">Entrada Autorizada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
