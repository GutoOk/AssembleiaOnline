'use client';

import Link from 'next/link';
import { Menu, MessageCircle, Users, Home, PlusCircle, PowerOff, Play, Download, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from './user-nav';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { downloadAta } from '@/lib/ata-generator';
import { useToast } from '@/hooks/use-toast';
import { AtaDownloadDialog } from '../AtaDownloadDialog';

export function Header() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();
  const [isMounted, setIsMounted] = useState(false);
  const assemblyContext = useAssemblyContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDownloadingAta, setIsDownloadingAta] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const assemblyStatus = assemblyContext?.assembly?.status;
  const attendeesCount = assemblyContext?.attendees?.length ?? 0;
  
  const isAssemblyActive = assemblyStatus === 'live' || assemblyStatus === 'scheduled';
  const showEndAssemblyButton = isAdmin && assemblyStatus === 'live';
  const showStartAssemblyButton = isAdmin && assemblyStatus === 'scheduled';
  
  const handleQueueClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsQueueOpen(true);
    }
  }

  const handleChatClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsChatOpen(true);
    }
  }

  const handleAttendeesClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsAttendeesSheetOpen(true);
    }
  }

  const handleStartAssemblyClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsStartAssemblyDialogOpen(true);
    }
  };
  
  const handleEndAssemblyClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsEndAssemblyDialogOpen(true);
    }
  };

  const handleDownloadAta = async () => {
    if (!firestore || !assemblyContext?.assembly || !assemblyContext?.timelineItems) return;
    setIsDownloadingAta(true);
    try {
        await downloadAta(firestore, assemblyContext.assembly, assemblyContext.timelineItems, isAdmin);
    } catch (e) {
        console.error("Failed to generate ATA document", e);
        toast({
            variant: "destructive",
            title: "Erro ao gerar Ata",
            description: "Não foi possível gerar o documento. Tente novamente.",
        });
    } finally {
        setIsDownloadingAta(false);
    }
  };

  const isAssemblyPage = pathname.startsWith('/assemblies/');
  const showCreateAssemblyButton = isAdmin && pathname === '/dashboard';
  const showDownloadAtaButton = isAssemblyPage && assemblyStatus === 'finished';

  const mobileNavLinks = (
    <>
      <Link
        href="/dashboard"
        className={cn(
          "flex items-center gap-4 text-lg font-medium transition-colors hover:text-foreground",
          (pathname === '/dashboard' || pathname.startsWith('/dashboard/assemblies')) ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <Home className="h-5 w-5" />
        {isAssemblyPage ? 'Sair' : 'Início'}
      </Link>
      {isAdmin && (
        <Link
          href="/dashboard/users"
          className={cn(
            "flex items-center gap-4 text-lg font-medium transition-colors hover:text-foreground",
            pathname.startsWith('/dashboard/users') ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Users className="h-5 w-5" />
          Gerenciar Usuários
        </Link>
      )}
       {showDownloadAtaButton && (
        <AtaDownloadDialog onConfirm={handleDownloadAta} disabled={isDownloadingAta}>
          <Button
            variant="ghost"
            disabled={isDownloadingAta}
            className="flex items-center gap-4 text-lg font-medium text-muted-foreground hover:text-foreground justify-start w-full text-left p-0"
          >
            {isDownloadingAta ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Baixar Ata
          </Button>
        </AtaDownloadDialog>
      )}
      {isAssemblyPage && isAssemblyActive && (
        <>
            <Separator className="my-2" />
            <Button variant="ghost" onClick={handleAttendeesClick} className="text-muted-foreground hover:text-foreground justify-start px-0 text-lg font-normal">Online ({attendeesCount})</Button>
            <Button variant="ghost" onClick={handleChatClick} className="text-muted-foreground hover:text-foreground justify-start px-0 text-lg font-normal">Chat</Button>
            <Button variant="ghost" onClick={handleQueueClick} className="text-muted-foreground hover:text-foreground justify-start px-0 text-lg font-normal">
                Fila de Inscrição
            </Button>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <TooltipProvider>
        {/* Left side */}
        <div className="flex items-center gap-2">
          {/* Mobile menu trigger */}
          <div className="md:hidden">
            {isMounted && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Alternar menu de navegação</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="pr-0">
                  <nav className="grid gap-6 text-lg font-medium pt-4">
                      {mobileNavLinks}
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </div>
          
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <UserNav />

            {pathname !== '/dashboard' && (
              <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Link href="/dashboard">
                  <Home className="h-5 w-5" />
                  Sair
                </Link>
              </Button>
            )}
            
            {showDownloadAtaButton && (
              <AtaDownloadDialog onConfirm={handleDownloadAta} disabled={isDownloadingAta}>
                <Button disabled={isDownloadingAta} variant="ghost" className="text-muted-foreground hover:text-foreground">
                  {isDownloadingAta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar Ata
                </Button>
              </AtaDownloadDialog>
            )}

            {isAssemblyPage && isAssemblyActive && (
              <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={handleAttendeesClick} className="text-muted-foreground hover:text-foreground">
                      <Users className="h-4 w-4" />
                      Online ({attendeesCount})
                  </Button>
                  <Button variant="ghost" onClick={handleChatClick} className="text-muted-foreground hover:text-foreground">
                      <MessageCircle className="h-4 w-4" />
                      Chat
                  </Button>
                  <Button variant="ghost" onClick={handleQueueClick} className="text-muted-foreground hover:text-foreground">
                      <Mic className="h-4 w-4" />
                      Fila de Inscrição
                  </Button>
              </div>
           )}

            {showCreateAssemblyButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                    <Link href="/dashboard/assemblies/create">
                      <PlusCircle className="h-5 w-5" />
                      <span className="sr-only">Criar Assembleia</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Criar Assembleia</p>
                </TooltipContent>
              </Tooltip>
            )}
          </nav>
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-2">
          {showStartAssemblyButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleStartAssemblyClick} variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:text-green-600 hover:bg-green-600/10">
                  <Play className="h-5 w-5" fill="currentColor"/>
                  <span className="sr-only">Iniciar Assembleia</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Iniciar Assembleia</p>
              </TooltipContent>
            </Tooltip>
          )}
           {showEndAssemblyButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleEndAssemblyClick} variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <PowerOff className="h-5 w-5" />
                  <span className="sr-only">Encerrar Assembleia</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Encerrar Assembleia</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* UserNav for mobile view is on the right */}
          <div className="md:hidden">
            <UserNav />
          </div>
        </div>
      </TooltipProvider>
    </header>
  );
}
