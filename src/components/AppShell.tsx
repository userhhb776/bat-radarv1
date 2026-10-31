import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountAccess } from "@/lib/access.functions";
import { Search, KanbanSquare, LogOut, Crosshair, FilePenLine, Contact, ScrollText, Inbox, Sunrise, MessageCircle, Layers, Megaphone, CalendarClock, Send, Users, MessagesSquare, BookOpen, Brain, Bot, Gauge } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { pingActivity } from "@/lib/push-client";
import logo from "@/assets/batradar-logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  { label: "Prospecção", items: [
    { title: "Leads do dia", url: "/diarios", icon: Sunrise },
    { title: "Buscar", url: "/buscar", icon: Search },
    { title: "Comparar", url: "/comparar", icon: Crosshair },
    { title: "Leads externos", url: "/externos", icon: Inbox },
    { title: "Scripts", url: "/scripts", icon: ScrollText },
  ] },
  { label: "Automação", items: [
    { title: "Bloco de leads", url: "/blocos", icon: Layers },
    { title: "Campanhas", url: "/campanhas", icon: Megaphone },
    { title: "Agendamentos", url: "/agendamentos", icon: CalendarClock },
    { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
    { title: "Agentes", url: "/agentes", icon: Bot },
  ] },
  { label: "Vendas", items: [
    { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
    { title: "CRM", url: "/crm", icon: Contact },
    { title: "Cotações", url: "/cotacoes", icon: FilePenLine },
  ] },
  { label: "Papa Lead", items: [
    { title: "Contatos", url: "/papa-lead", icon: Users },
    { title: "Mensagens", url: "/papa-lead-mensagens", icon: MessagesSquare },
    { title: "Campanhas", url: "/papa-lead-campanhas", icon: Send },
  ] },
  { label: "Ajuda", items: [
    { title: "Manual", url: "/manual", icon: BookOpen },
    { title: "Aprendizado", url: "/aprendizado", icon: Brain },
    { title: "Argos", url: "/argos", icon: Bot },
  ] },
] as const;

function AppSidebar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accessFn = useServerFn(getAccountAccess);
  const access = useQuery({ queryKey: ["account-access"], queryFn: () => accessFn(), staleTime: 30000 });
  const { setOpenMobile } = useSidebar();
  const path = useRouterState({ select: (r) => r.location.pathname });
  async function signOut() {
    await supabase.rpc("record_access", { _kind: "logout" });
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-1 py-1 font-display font-semibold">
          <img src={logo} alt="" width={1024} height={1024} className="h-8 w-8 shrink-0 object-contain" />
          <span className="truncate group-data-[collapsible=icon]:hidden">BatRadar 5.7</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((i) => (
                  <SidebarMenuItem key={i.url}>
                    <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                      <Link to={i.url} onClick={() => setOpenMobile(false)}>
                        <i.icon className="h-4 w-4" /><span>{i.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {access.data?.admin && <SidebarMenuItem><SidebarMenuButton asChild isActive={path === "/acess"} tooltip="ACESS"><Link to="/acess" onClick={() => setOpenMobile(false)}><Contact className="h-4 w-4" /><span>ACESS</span></Link></SidebarMenuButton></SidebarMenuItem>}
          {access.data?.admin && <SidebarMenuItem><SidebarMenuButton asChild isActive={path === "/sistema"} tooltip="Sistema"><Link to="/sistema" onClick={() => setOpenMobile(false)}><Gauge className="h-4 w-4" /><span>Sistema</span></Link></SidebarMenuButton></SidebarMenuItem>}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair"><LogOut className="h-4 w-4" /><span>Sair</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const ping = () => { void pingActivity(); };
    ping();
    window.addEventListener("pointerdown", ping);
    window.addEventListener("keydown", ping);
    return () => { window.removeEventListener("pointerdown", ping); window.removeEventListener("keydown", ping); };
  }, []);
  return (
    <SidebarProvider>
      <InstallPrompt />
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-accent/20 bg-ink px-2 text-ink-foreground">
            <SidebarTrigger className="text-ink-foreground hover:bg-ink-foreground/10" />
            <span className="font-display font-semibold md:hidden">BatRadar 5.7</span>
          </header>
          <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:py-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
