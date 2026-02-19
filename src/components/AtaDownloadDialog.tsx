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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import React from 'react';

interface AtaDownloadDialogProps {
  onConfirm: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function AtaDownloadDialog({ onConfirm, children, disabled }: AtaDownloadDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Minuta de Ata</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground">
            Este documento é uma cópia preliminar gerada pelo sistema para simples conferência e não possui valor legal. Os registros apresentados são informativos e refletem dados brutos, não substituindo a ata oficial, que será publicada na pasta de documentos do Google Drive para conferência e eventuais pedidos de retificação. A ata definitiva somente passará a existir após a aprovação do texto oficial na próxima assembleia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Baixar Minuta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
