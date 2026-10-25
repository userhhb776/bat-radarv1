import { createServerFn } from "@tanstack/react-start";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";
import { evoGet } from "@/lib/evolution.server";

const prefixFor = (userId: string) => `br${userId.replace(/-/g, "").slice(0, 10)}-`;
function own(userId: string, name: string) {
  if (!name.startsWith(prefixFor(userId))) throw new Error("Conexão não pertence a esta conta.");
  return encodeURIComponent(name);
}

export type PlGroup = { id: string; name: string; size: number };
export type PlMember = { phone: string; name: string; admin: boolean };

export const plGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { instance: string }) => d)
  .handler(async ({ data, context }): Promise<PlGroup[]> => {
    const r = await evoGet(`/group/fetchAllGroups/${own(context.userId, data.instance)}?getParticipants=false`);
    const arr = Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [];
    return arr.map((g) => ({ id: String(g["id"] ?? ""), name: String(g["subject"] ?? "Sem nome"), size: Number(g["size"] ?? 0) }))
      .filter((g) => g.id).sort((a, b) => a.name.localeCompare(b.name));
  });

export const plGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { instance: string; groupId: string }) => d)
  .handler(async ({ data, context }) => {
    const inst = own(context.userId, data.instance);
    const r = (await evoGet(`/group/participants/${inst}?groupJid=${encodeURIComponent(data.groupId)}`)) as Record<string, unknown> | null;
    const parts = (Array.isArray(r?.["participants"]) ? r!["participants"] : []) as Array<Record<string, unknown>>;
    let ownNumber = "";
    try {
      const list = (await evoGet(`/instance/fetchInstances?instanceName=${inst}`, 20000)) as Array<Record<string, unknown>>;
      ownNumber = String(list?.[0]?.["ownerJid"] ?? "").split("@")[0] ?? "";
    } catch { /* ignore */ }
    const members: PlMember[] = [];
    let hidden = 0;
    for (const p of parts) {
      const jids = [p["phoneNumber"], p["jid"], p["id"]].map((x) => String(x ?? ""));
      const jid = jids.find((j) => j.endsWith("@s.whatsapp.net"));
      if (!jid) { hidden++; continue; }
      const phone = jid.split("@")[0]!;
      if (phone === ownNumber) continue;
      const adm = String(p["admin"] ?? "");
      members.push({ phone, name: String(p["name"] ?? p["pushName"] ?? p["notify"] ?? ""), admin: adm === "admin" || adm === "superadmin" });
    }
    return { members, hidden };
  });

// Dispara a fila na hora (em vez de esperar o ciclo de 5 min do agendador).
export const plDispatchNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const r = await fetch(`${origin}/api/public/hooks/wa-dispatch`, { method: "POST", headers: { Authorization: `Bearer ${process.env["LOVABLE_CRON_SECRET"]}` } });
    return { ok: r.ok };
  });

// Marca uma conferência extra no minuto do próximo envio (após publicar/editar), para não esperar a rodada fixa de 18 min.
export const plWake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const nowIso = new Date().toISOString();
    const [{ data: a }, { data: b }] = await Promise.all([
      sb.from("pl_queue").select("send_at").eq("status", "pendente").order("send_at").limit(1),
      sb.from("wa_scheduled").select("send_at").eq("status", "pendente").order("send_at").limit(1),
    ]);
    const cands = [a?.[0]?.send_at, b?.[0]?.send_at].filter(Boolean).map((s) => new Date(s as string).getTime());
    if (!cands.length) return { wake: null };
    const at = Math.min(...cands);
    if (at <= Date.now() + 60000) {
      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = new URL(getRequest().url).origin;
      void nowIso;
      const r = await fetch(`${origin}/api/public/hooks/wa-dispatch`, { method: "POST", headers: { Authorization: `Bearer ${process.env["LOVABLE_CRON_SECRET"]}` } });
      return { wake: r.ok ? "now" : null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).rpc("schedule_dispatch_wake", { _at: new Date(at).toISOString() });
    return { wake: data as string | null };
  });
