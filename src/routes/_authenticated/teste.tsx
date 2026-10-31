import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search, Sparkles, Users, KanbanSquare, MessageCircle, Megaphone,
  CalendarClock, FileText, Bot, Settings, Store, BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/teste")({
  head: () => ({
    meta: [
      { title: "Painel simplificado (teste) — BatRadar" },
      { name: "description", content: "Versão de teste do BatRadar com navegação organizada em poucos grupos." },
      { property: "og:title", content: "Painel simplificado — BatRadar" },
      { property: "og:description", content: "Versão de teste com navegação mais limpa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Teste,
});

type Item = { to: string; label: string; desc: string; icon: typeof Search };
const groups: { title: string; items: Item[] }[] = [
  {
    title: "Encontrar clientes",
    items: [
      { to: "/buscar", label: "Buscar", desc: "Empresas por nicho ou loja específica", icon: Search },
      { to: "/diarios", label: "Leads do dia", desc: "Achados automáticos de hoje", icon: Sparkles },
      { to: "/externos", label: "Externos", desc: "Lojas de outros lugares", icon: Store },
    ],
  },
  {
    title: "Vender",
    items: [
      { to: "/pipeline", label: "Funil", desc: "Onde cada cliente está", icon: KanbanSquare },
      { to: "/cotacoes", label: "Orçamentos", desc: "Propostas enviadas", icon: FileText },
    ],
  },
  {
    title: "Mensagens",
    items: [
      { to: "/campanhas", label: "Campanhas", desc: "Envios em massa", icon: Megaphone },
      { to: "/whatsapp", label: "WhatsApp", desc: "Seus números conectados", icon: MessageCircle },
    ],
  },
  {
    title: "Ajuda e ajustes",
    items: [
      { to: "/argos", label: "Argos", desc: "Peça qualquer coisa", icon: Bot },
      { to: "/manual", label: "Manual", desc: "Como usar", icon: BookOpen },
      { to: "/sistema", label: "Sistema", desc: "Banco, servidor e chaves", icon: Settings },
    ],
  },
];

function Teste() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Versão de teste</p>
        <h1 className="text-2xl font-semibold">O que você quer fazer?</h1>
      </header>
      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {g.items.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to as never}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
              >
                <Icon className="h-6 w-6 shrink-0 text-primary" />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
