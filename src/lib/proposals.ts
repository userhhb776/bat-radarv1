import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Proposal = Tables<"proposals">;
export const proposalsKey = ["proposals"] as const;

export async function listProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase.from("proposals").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveProposal(leadId: string, fields: Pick<Proposal, "amount" | "deadline" | "payment_terms" | "scope" | "completed_work" | "received_amount" | "project_cost" | "outcome">) {
  const { error } = await supabase.from("proposals").upsert({ lead_id: leadId, ...fields }, { onConflict: "user_id,lead_id" });
  if (error) throw error;
}