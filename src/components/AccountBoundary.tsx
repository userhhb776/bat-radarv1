import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";
import { getAccountAccess } from "@/lib/access.functions";
import { canUsePanel } from "@/lib/access-policy";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Clock, RefreshCw, LogOut } from "lucide-react";

export function AccountBoundary({ children }: { children: ReactNode }) {
  const call = useServerFn(getAccountAccess);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: r => r.location.pathname });
  const account = useQuery({ queryKey: ["account-access"], queryFn: () => call(), staleTime: 30000 });
  const allowed = canUsePanel(account.data?.profile.approval_status);
  useEffect(() => {
    if (!allowed) return;
    void supabase.rpc("record_access", { _kind: "page", _page: path });
  }, [allowed, path]);
  if (allowed) return children;
  async function leave() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  return <div className="flex min-h-screen items-center justify-center bg-ink px-5 text-ink-foreground"><div className="w-full max-w-md text-center">
    <Clock className="mx-auto h-10 w-10 text-primary" />
    <h1 className="mt-5 font-display text-2xl font-semibold">{account.isPending ? "Consultando sua conta…" : account.isError ? "Não foi possível consultar sua conta" : account.data?.profile.approval_status === "rejected" ? "Solicitação não aprovada" : "Aguardando aprovação"}</h1>
    <p className="mt-3 text-sm text-muted-foreground">{account.isError ? "Tente atualizar ou entre novamente." : "Sua solicitação será analisada por Lucas. O acesso ao painel depende da aprovação."}</p>
    <div className="mt-6 flex justify-center gap-3"><Button disabled={account.isFetching} onClick={() => account.refetch()}><RefreshCw className="h-4 w-4" />Atualizar</Button><Button variant="outline" onClick={leave}><LogOut className="h-4 w-4" />Sair</Button></div>
  </div></div>;
}