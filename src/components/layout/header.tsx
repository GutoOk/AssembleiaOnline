'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
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

export function Header() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();

  const navLinks = (className?: string) => (
    <>
      <Link
        href="/dashboard"
        className={cn(
          "transition-colors hover:text-foreground",
          (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/users')) ? "text-foreground" : "text-muted-foreground",
          className
        )}
      >
        Assembleias
      </Link>
      {isAdmin && (
        <Link
          href="/dashboard/users"
          className={cn(
            "transition-colors hover:text-foreground",
            pathname.startsWith('/dashboard/users') ? "text-foreground" : "text-muted-foreground",
            className
          )}
        >
          Usuários
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Desktop Navigation */}
      <nav className="hidden flex-row items-center gap-5 text-sm font-medium md:flex lg:gap-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={28} height={28} />
          <span className="ml-1">Assembleia Mensa</span>
        </Link>
        {navLinks()}
      </nav>

      {/* Mobile Navigation */}
      <div className="flex-1 md:hidden">
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
                <span className="ml-1">Assembleia Mensa</span>
              </Link>
              {navLinks("text-base")}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 items-center justify-end">
        <UserNav />
      </div>
    </header>
  );
}
