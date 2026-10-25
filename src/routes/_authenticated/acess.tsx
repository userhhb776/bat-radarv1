import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, Check, X, RefreshCw, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccountAccess, listAccessAccounts, listAccessHistory, reviewAccessAccount } from "@/lib/access.functions";
import { toast } from "sonner";
import { enablePush, pushMessages } from "@/lib/push-client";

export const Route = createFileRoute("/_authenticated/acess")({
  head: () => ({ meta: [ { title: "ACESS — Contas e acessos | BatRadar 5.7" }, { name: "description", content: "Administração de solicitações e histórico de atividade do BatRadar." }, { property: "og:title", content: "ACESS — BatRadar 5.7" }, { property: "og:description", content: "Área exclusiva de administração de contas e acessos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: AccessPage,
});
const when = (s: string) => new Date(s).toLocaleString("pt-BR");
const statuses: Record<string,string> = { pending: "Pendente", approved: "Aprovada", rejected: "Recusada" };
const kinds: Record<string,string> = { login: "Entrou", logout: "Saiu", page: "Página", search: "Pesquisa", insert: "Criou", update: "Alterou", delete: "Excluiu", approval: "Aprovação", jarvis: "Jarvis" };
function AccessPage() {
  const [filter, setFilter] = useState(""); const [userId, setUserId] = useState<string | undefined>(); const [offset,setOffset] = useState(0);
  const qc = useQueryClient();
  const accountFn = useServerFn(getAccountAccess), accountsFn = useServerFn(listAccessAccounts), historyFn = useServerFn(listAccessHistory), reviewFn = useServerFn(reviewAccessAccount);
  const own = useQuery({ queryKey: ["account-access"], queryFn: () => accountFn() });
  const accounts = useQuery({ queryKey: ["access-accounts"], queryFn: () => accountsFn(), enabled: own.data?.admin === true });
  const history = useQuery({ queryKey: ["access-history",userId,offset], queryFn: () => historyFn({ data: { userId,offset } }), enabled: own.data?.admin === true });
  const review = useMutation({ mutationFn: (data: { userId: string; decision: "approved" | "rejected" }) => reviewFn({ data }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["access-accounts"] }); void qc.invalidateQueries({ queryKey: ["access-history"] }); toast.success("Solicitação atualizada."); }, onError: (e) => toast.error(e.message) });
  const names = new Map(accounts.data?.map(a => [a.id,a.name || a.email]));
  if (!own.data?.admin) return <AppShell><h1 className="text-xl font-semibold">Acesso exclusivo da conta principal</h1></AppShell>;
  const visible = accounts.data?.filter(a => `${a.name} ${a.email}`.toLowerCase().includes(filter.toLowerCase())) ?? [];
  return <AppShell><div className="flex items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 font-display text-3xl font-semibold"><ShieldCheck className="h-7 w-7 text-primary" />ACESS</h1><p className="mt-1 text-sm text-muted-foreground">Contas, solicitações e histórico de atividade</p></div><Button variant="outline" size="icon" aria-label="Atualizar contas e histórico" onClick={() => { void accounts.refetch(); void history.refetch(); }}><RefreshCw className="h-4 w-4" /></Button></div>
    <h2 className="mt-8 text-lg font-semibold">Contas · {accounts.data?.length ?? 0} <span className="text-sm text-primary">{accounts.data?.filter(a => a.approval_status === "pending").length ?? 0} solicitações</span></h2>
    <Button className="mt-3" variant="outline" onClick={async () => { const result = await enablePush(); (result === "registered" ? toast.success : toast.error)(pushMessages[result]); }}><Bell className="h-4 w-4" />Ativar notificações neste celular</Button>
    <Input className="mt-3 max-w-md" placeholder="Pesquisar nome ou e-mail" aria-label="Pesquisar contas" value={filter} onChange={e => setFilter(e.target.value)} />
    {accounts.isError && <p role="alert" className="mt-3 text-destructive">{accounts.error.message}</p>}
    <div className="mt-4 divide-y divide-border">{visible.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-semibold">{a.name || "Nome não informado"}</p><p className="break-all text-sm text-muted-foreground">{a.email}</p><p className="mt-1 text-xs text-muted-foreground">{statuses[a.approval_status]} · Cadastro {when(a.created_at)}</p></div><div className="flex flex-wrap gap-2"><Button variant={userId===a.id ? "secondary" : "outline"} size="sm" onClick={() => { setUserId(a.id); setOffset(0); }}>Histórico</Button>{a.approval_status === "pending" && <><Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ userId:a.id,decision:"approved" })}><Check className="h-4 w-4" />Aprovar</Button><Button variant="outline" size="sm" disabled={review.isPending} onClick={() => review.mutate({ userId:a.id,decision:"rejected" })}><X className="h-4 w-4" />Recusar</Button></>}</div></div>)}</div>
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Histórico {userId ? `· ${names.get(userId) ?? "Conta"}` : "· Todas as contas"}</h2>{userId && <Button variant="ghost" size="sm" onClick={() => { setUserId(undefined); setOffset(0); }}>Todas as contas</Button>}</div>
    <p className="mt-2 text-xs text-muted-foreground">Registros desde a ativação do ACESS. Dispositivo identificado pelo navegador; não inclui senhas ou conversas privadas.</p>
    {history.isError && <p role="alert" className="mt-3 text-destructive">{history.error.message}</p>}
    <div className="mt-4 divide-y divide-border">{history.data?.rows.map(e => <div className="py-3" key={e.id}><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{names.get(e.user_id) ?? "Conta"} · {kinds[e.kind] ?? e.kind}</strong><time className="text-muted-foreground">{when(e.created_at)}</time></div><p className="mt-1 break-words text-sm">{e.page}</p>{JSON.stringify(e.detail) !== "{}" && <p className="mt-1 break-all text-xs text-muted-foreground">{JSON.stringify(e.detail)}</p>}<p className="mt-1 break-all text-xs text-muted-foreground">{e.user_agent || "Servidor"}</p></div>)}</div>
    {!history.isPending && !history.data?.rows.length && <p className="py-8 text-sm text-muted-foreground">Nenhum registro neste filtro.</p>}
    <div className="mt-5 flex items-center justify-between"><p className="text-xs text-muted-foreground">{history.data?.count ?? 0} registros</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={!offset || history.isFetching} onClick={() => setOffset(n=>Math.max(0,n-50))}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{offset/50+1}</span><Button variant="outline" size="icon" aria-label="Próxima página" disabled={offset+50 >= (history.data?.count ?? 0) || history.isFetching} onClick={() => setOffset(n=>n+50)}><ChevronRight className="h-4 w-4" /></Button></div></div>
  </AppShell>;
}