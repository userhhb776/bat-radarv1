import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MessagesSection } from "@/components/PapaLead";

export const Route = createFileRoute("/_authenticated/papa-lead-mensagens")({
  head: () => ({ meta: [
    { title: "Papa Lead — Mensagens" }, { name: "description", content: "Blocos de mensagens com variações para os textos não saírem iguais." },
    { property: "og:title", content: "Papa Lead — Mensagens" }, { property: "og:description", content: "Blocos de mensagens com variações para os textos não saírem iguais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Papa Lead</p>
      <h1 className="text-3xl font-bold">Mensagens</h1>
      <p className="mt-1 text-sm text-muted-foreground">Blocos de mensagens com variações para os textos não saírem iguais.</p>
      <div className="mt-6"><MessagesSection  /></div>
    </AppShell>
  );
}
