import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ContactsSection, usePlInstances } from "@/components/PapaLead";

export const Route = createFileRoute("/_authenticated/papa-lead")({
  head: () => ({ meta: [
    { title: "Papa Lead — Contatos" }, { name: "description", content: "Extraia contatos de grupos, importe arquivos ou digite manualmente." },
    { property: "og:title", content: "Papa Lead — Contatos" }, { property: "og:description", content: "Extraia contatos de grupos, importe arquivos ou digite manualmente." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const instances = usePlInstances();
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Papa Lead</p>
      <h1 className="text-3xl font-bold">Contatos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Extraia contatos de grupos, importe arquivos ou digite manualmente.</p>
      <div className="mt-6"><ContactsSection instances={instances} /></div>
    </AppShell>
  );
}
