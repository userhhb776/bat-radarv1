import { Star, Phone, MapPin, Globe, GlobeLock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { opportunityOf, type PlaceLead } from "@/lib/types";
import { Button } from "@/components/ui/button";

const oppStyle = {
  quente: "bg-hot/15 text-hot",
  morna: "bg-warm/20 text-foreground",
  fria: "bg-cold/15 text-cold",
};

export function OpportunityBadge({ lead }: { lead: PlaceLead }) {
  const o = opportunityOf(lead);
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", oppStyle[o.level])}>{o.label}</span>;
}

export function LeadCard({ lead, saved, agent, onOpen }: { lead: PlaceLead; saved?: boolean; agent?: string; onOpen: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onOpen}
      className="group flex h-auto w-full min-w-0 flex-col items-stretch justify-start gap-0 whitespace-normal rounded-lg bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-lg sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-base font-semibold leading-snug">{lead.name}</h3>
        {agent && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">agente usad: {agent}</span>}
        {saved && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <Check className="h-3 w-3" /> Salvo
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm">
        <Star className="h-4 w-4 fill-warm text-warm" />
        <span className="font-semibold">{lead.rating?.toFixed(1) ?? "—"}</span>
        <span className="text-muted-foreground">({lead.reviews} avaliações)</span>
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0" /> {lead.phone ?? "Sem telefone"}
        </p>
        <p className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-2">{lead.address}</span>
        </p>
        <p className={cn("flex min-w-0 items-center gap-2", !lead.website && "font-medium text-hot")}>
          {lead.website ? <Globe className="h-3.5 w-3.5" /> : <GlobeLock className="h-3.5 w-3.5" />}
          <span className="min-w-0 truncate">{lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "") : "Sem site cadastrado"}</span>
        </p>
      </div>
       <div className="mt-4 flex w-full items-center justify-between border-t pt-3">
        <OpportunityBadge lead={lead} />
        <span className="text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">Analisar →</span>
      </div>
    </Button>
  );
}
