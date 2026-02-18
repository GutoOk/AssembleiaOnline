'use client';

import Link from 'next/link';
import { Menu, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from './user-nav';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAssemblyContext } from '@/contexts/AssemblyContext';
import { Separator } from '../ui/separator';

export function Header() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();
  const [isMounted, setIsMounted] = useState(false);
  const assemblyContext = useAssemblyContext();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showAssemblyButtons = assemblyContext?.status === 'live';
  
  const handleQueueClick = () => {
    if (assemblyContext) {
      assemblyContext.setIsQueueOpen(true);
    }
  }

  const mobileNavLinks = (
    <>
      <Link
        href="/dashboard"
        className={cn(
          "transition-colors hover:text-foreground",
          (pathname === '/dashboard' || pathname.startsWith('/dashboard/assemblies')) ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Início
      </Link>
      {isAdmin && (
        <Link
          href="/dashboard/users"
          className={cn(
            "transition-colors hover:text-foreground",
            pathname.startsWith('/dashboard/users') ? "text-foreground" : "text-muted-foreground"
          )}
        >
          Usuários
        </Link>
      )}
      {showAssemblyButtons && (
        <>
            <Separator className="my-2" />
            <Button variant="ghost" className="text-muted-foreground justify-start px-0 text-lg font-normal" disabled>Chat</Button>
            <Button variant="ghost" onClick={() => {
                handleQueueClick();
                // We assume Sheet will close itself, but good to have a way to close it if needed
            }} className="text-muted-foreground hover:text-foreground justify-start px-0 text-lg font-normal">
                Fila de Inscrição
            </Button>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <nav className="hidden flex-row items-center gap-5 text-sm font-medium md:flex lg:gap-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={28} height={28} />
          <span className="sr-only">Assembleia Mensa</span>
        </Link>
      </nav>

      {/* Mobile Navigation */}
      <div className="flex-1 md:hidden">
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
            <SheetContent side="left">
              <nav className="grid gap-6 text-lg font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={28} height={28} />
                  <span>Assembleia Mensa</span>
                </Link>
                {mobileNavLinks}
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </div>
      
      <div className="flex flex-1 items-center justify-end gap-2">
         {showAssemblyButtons && (
            <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" className="text-muted-foreground" disabled>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat
                </Button>
                <Button variant="ghost" onClick={handleQueueClick} className="text-muted-foreground hover:text-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    Fila de Inscrição
                </Button>
            </div>
         )}
        <UserNav />
      </div>
    </header>
  );
}
