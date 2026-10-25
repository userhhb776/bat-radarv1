import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CampaignsSection, usePlInstances } from "@/components/PapaLead";

export const Route = createFileRoute("/_authenticated/papa-lead-campanhas")({
  head: () => ({ meta: [
    { title: "Papa Lead — Campanhas" }, { name: "description", content: "Crie campanhas em etapas e acompanhe enviadas, pendentes e falhas." },
    { property: "og:title", content: "Papa Lead — Campanhas" }, { property: "og:description", content: "Crie campanhas em etapas e acompanhe enviadas, pendentes e falhas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const instances = usePlInstances();
  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase text-primary">Papa Lead</p>
      <h1 className="text-3xl font-bold">Campanhas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Crie campanhas em etapas e acompanhe enviadas, pendentes e falhas.</p>
      <div className="mt-6"><CampaignsSection instances={instances} /></div>
    </AppShell>
  );
}
