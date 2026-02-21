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
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface AtaDownloadDialogProps {
  onConfirmDocx: () => void;
  onConfirmPdf: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  isAdmin: boolean;
}

export function AtaDownloadDialog({ onConfirmDocx, onConfirmPdf, children, disabled, isAdmin }: AtaDownloadDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Minuta de Ata</AlertDialogTitle>
          <AlertDialogDescription asChild>
             <div className="flex items-start gap-3 text-sm text-muted-foreground pt-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
              <p>
                  Este documento é uma cópia preliminar gerada pelo sistema para simples conferência e não possui valor legal. Os registros apresentados são informativos e refletem dados brutos, não substituindo a ata oficial, que será publicada na pasta de documentos do Google Drive para conferência e eventuais pedidos de retificação. A ata definitiva somente estará consolidada após a aprovação do texto oficial na próxima assembleia.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {isAdmin ? (
            <>
              <AlertDialogAction asChild>
                <Button variant="outline" onClick={onConfirmPdf}>
                  Baixar PDF (Versão do Usuário)
                </Button>
              </AlertDialogAction>
              <AlertDialogAction asChild>
                <Button onClick={onConfirmDocx}>
                  Baixar DOCX (Editável)
                </Button>
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={onConfirmPdf}>
              Baixar Minuta
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
