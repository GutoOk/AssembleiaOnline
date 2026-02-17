'use client';

import Link from 'next/link';
import { LayoutDashboard, Menu, Users } from 'lucide-react';
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

export function Header() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="#"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={20} height={20} className="transition-all group-hover:scale-110" />
              <span className="sr-only">Assembleia Mensa</span>
            </Link>
            <Link
              href="/dashboard"
              className={`flex items-center gap-4 px-2.5 ${pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/users') ? 'text-foreground' : 'text-muted-foreground'} hover:text-foreground`}
            >
              <LayoutDashboard className="h-5 w-5" />
              Assembleias
            </Link>
             {isAdmin && (
               <Link
                href="/dashboard/users"
                className={`flex items-center gap-4 px-2.5 ${pathname.startsWith('/dashboard/users') ? 'text-foreground' : 'text-muted-foreground'} hover:text-foreground`}
              >
                <Users className="h-5 w-5" />
                Usuários
              </Link>
            )}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Breadcrumbs could go here */}
      </div>
      <UserNav />
    </header>
  );
}
