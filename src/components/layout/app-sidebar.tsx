'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Image from 'next/image';
import { LayoutDashboard, Users } from 'lucide-react';
import { useAdmin } from '@/hooks/use-admin';

export function AppSidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();

  return (
    <Sidebar className="hidden border-r bg-background sm:flex">
      <SidebarContent>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8">
                  <Image src="https://mensa.org.br/images/Mensa-logo.png" alt="Mensa Brasil Logo" width={24} height={24} />
                  <span className="sr-only">Assembleia Mensa Brasil</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarMenu className="grid gap-2 px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard' || pathname.startsWith('/dashboard/assemblies')}>
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-5 w-5" />
                      <span className="sr-only">Assembleias</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </TooltipTrigger>
              <TooltipContent side="right">Assembleias</TooltipContent>
            </Tooltip>
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/users')}>
                      <Link href="/dashboard/users">
                        <Users className="h-5 w-5" />
                        <span className="sr-only">Usuários</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </TooltipTrigger>
                <TooltipContent side="right">Usuários</TooltipContent>
              </Tooltip>
            )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
    </Sidebar>
  );
}
