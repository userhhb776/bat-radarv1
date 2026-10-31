import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

const agentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  mission: z.string().max(3000), offer: z.string().max(3000), rules: z.string().max(6000), ideal_client: z.string().max(3000),
  instance: z.string().max(120),
  ai_provider: z.enum(["native", "custom"]), ai_key: z.string().max(300).optional(), model: z.string().max(80),
  active: z.boolean(), auto_reply: z.boolean(), training_mode: z.boolean(),
});

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireApprovedAccount])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("agents").select("*").order("created_at");
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!admin, agents: (data ?? []).map((a: any) => ({ ...a, ai_key: a.ai_key ? "••••" + String(a.ai_key).slice(-4) : "" })) };
  });

export const saveAgent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => agentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (data.training_mode && !admin) throw new Error("Modo treinamento é exclusivo do administrador.");
    const { id, ai_key, ...rest } = data;
    const row: any = { ...rest, user_id: context.userId, training_phone: admin ? "5568992316302" : "" };
    if (ai_key && !ai_key.startsWith("••")) row["ai_key"] = ai_key;
    if (data.ai_provider === "native") row["ai_key"] = null;
    const q = id ? context.supabase.from("agents").update(row).eq("id", id).select("id").single() : context.supabase.from("agents").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    if (data.instance) await (await import("@/lib/wa-inbound.server")).registerInbound(data.instance).catch(() => false);
    return { id: saved.id };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("agents").delete().eq("id", data.id);
    return { ok: true };
  });

export const agentConversations = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("agent_messages").select("phone,contact_name,direction,body,hot,created_at").eq("agent_id", data.id).order("created_at", { ascending: false }).limit(300);
    return rows ?? [];
  });

export const talkToAgent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: a } = await context.supabase.from("agents").select("*").eq("id", data.id).single();
    if (!a) throw new Error("Agente não encontrado.");
    const key = await (await import("@/lib/service-config.server")).getOllamaKey();
    const { agentOwnerChat } = await import("@/lib/agents.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    return agentOwnerChat(context.supabase as any, a as any, key ?? "", data.messages, new URL(getRequest().url).origin);
  });

export const designAgent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(30),
    current: z.record(z.string(), z.any()).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const key = await (await import("@/lib/service-config.server")).getOllamaKey();
    if (!key) throw new Error("IA não configurada.");
    const system = `Você monta agentes de vendas do BatRadar conversando com o dono, em pt-BR, curto e direto. A cada resposta devolva SOMENTE um JSON: {"reply":"sua fala curta (pergunte o que faltar)","agent":{"name":"","mission":"","offer":"","ideal_client":"","rules":"","auto_reply":true}}. Preencha o agente com tudo que já sabe, mantendo o que já existe e aplicando as mudanças pedidas. As regras devem fazer o agente falar como gente, nunca como robô. Agente atual: ${JSON.stringify(data.current ?? {})}`;
    const res = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b", stream: false, format: "json", messages: [{ role: "system", content: system }, ...data.messages] }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Limite da IA atingido." : "IA indisponível, tente de novo.");
    const j: any = await res.json();
    let out: any = {};
    try { out = JSON.parse(j?.message?.content ?? "{}"); } catch { /* ignore */ }
    const a = out.agent ?? {};
    const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
    return {
      reply: s(out.reply, 2000) || "Pode me contar mais?",
      agent: { name: s(a.name, 60), mission: s(a.mission, 3000), offer: s(a.offer, 3000), ideal_client: s(a.ideal_client, 3000), rules: s(a.rules, 6000), auto_reply: a.auto_reply !== false },
    };
  });
