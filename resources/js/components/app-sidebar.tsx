import { Link } from '@inertiajs/react';
import { LayoutGrid } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavChats } from '@/components/nav-chats';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Separator } from '@/components/ui/separator';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
                <NavChats />
            </SidebarContent>

            <SidebarFooter>
                <Separator className="mx-auto w-[calc(100%-1rem)]" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
