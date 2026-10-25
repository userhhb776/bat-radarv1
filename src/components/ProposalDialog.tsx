import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SavedLead } from "@/lib/leads";
import { proposalsKey, saveProposal, type Proposal } from "@/lib/proposals";

type Fields = Pick<Proposal, "amount" | "deadline" | "payment_terms" | "scope" | "completed_work" | "received_amount" | "project_cost" | "outcome">;
const blank: Fields = { amount: 0, deadline: "", payment_terms: "", scope: "", completed_work: "", received_amount: 0, project_cost: 0, outcome: "" };

export function ProposalDialog({ lead, proposal, onClose }: { lead: SavedLead | null; proposal: Proposal | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Fields>(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFields(proposal ? {
      amount: proposal.amount, deadline: proposal.deadline, payment_terms: proposal.payment_terms,
      scope: proposal.scope, completed_work: proposal.completed_work, received_amount: proposal.received_amount,
      project_cost: proposal.project_cost, outcome: proposal.outcome,
    } : blank);
  }, [lead?.id, proposal]);
  function set<K extends keyof Fields>(key: K, value: Fields[K]) { setFields((previous) => ({ ...previous, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!lead) return;
    setSaving(true);
    try {
      await saveProposal(lead.id, fields);
      await qc.invalidateQueries({ queryKey: proposalsKey });
      toast.success("Proposta salva");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a proposta");
    } finally { setSaving(false); }
  }
  const fieldClass = "space-y-1.5 text-sm font-medium";
  return <Dialog open={!!lead} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-lg">
      <DialogHeader>
        <DialogTitle>Proposta · {lead?.name}</DialogTitle>
        <DialogDescription>Registre as condições da proposta. O resultado financeiro pode ser atualizado depois do fechamento.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={fieldClass}>Valor da proposta (R$)
            <Input type="number" min="0" step="0.01" required value={fields.amount} onChange={(e) => set("amount", Number(e.target.value))} />
          </label>
          <label className={fieldClass}>Prazo de entrega
            <Input placeholder="Ex.: 30 dias após aprovação" value={fields.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </label>
        </div>
        <label className={`block ${fieldClass}`}>Forma de pagamento
          <Input placeholder="Ex.: 50% na entrada e 50% na entrega" value={fields.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} />
        </label>
        <label className={`block ${fieldClass}`}>O que está incluído
          <Textarea placeholder="Ex.: Site profissional, otimização do perfil no Google..." value={fields.scope} onChange={(e) => set("scope", e.target.value)} />
        </label>
        {lead?.status === "fechado" && <div className="space-y-4 border-t pt-5">
          <p className="font-semibold">Acompanhamento do cliente</p>
          <label className={`block ${fieldClass}`}>O que foi feito
            <Textarea placeholder="Descreva as entregas realizadas" value={fields.completed_work} onChange={(e) => set("completed_work", e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldClass}>Valor recebido (R$)
              <Input type="number" min="0" step="0.01" value={fields.received_amount} onChange={(e) => set("received_amount", Number(e.target.value))} />
            </label>
            <label className={fieldClass}>Custos do projeto (R$)
              <Input type="number" min="0" step="0.01" value={fields.project_cost} onChange={(e) => set("project_cost", Number(e.target.value))} />
            </label>
          </div>
          <label className={`block ${fieldClass}`}>Resultado obtido
            <Textarea placeholder="Ex.: aumento de contatos, visitas ou agendamentos (apenas dados confirmados)" value={fields.outcome} onChange={(e) => set("outcome", e.target.value)} />
          </label>
        </div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar proposta"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}