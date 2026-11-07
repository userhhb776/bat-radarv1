import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";

const id = z.string().uuid();

/** Troca a foto de perfil (imagem já reduzida no navegador, ou link). */
export const setAgentAvatar = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id, avatar_url: z.string().max(400_000).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("agents").update({ avatar_url: data.avatar_url }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Move o agente entre as abas: Agentes (null), AGTS - 01 ou Agentes V2. */
export const setAgentSquad = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id, squad: z.enum(["agts01", "v2", "v3"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("agents").update({ squad: data.squad }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const personaSchema = z.object({
  role: z.string().max(1000).default(""),
  backstory: z.string().max(2000).default(""),
  personality: z.string().max(1000).default(""),
  voice: z.string().max(1000).default(""),
  formality: z.number().min(0).max(10).default(4),
  energy: z.number().min(0).max(10).default(6),
  emoji: z.enum(["nunca", "pouco", "medio"]).default("pouco"),
  length: z.enum(["curtissima", "curta", "media"]).default("curta"),
  slang: z.string().max(500).default(""),
  forbidden: z.string().max(1000).default(""),
  human_typos: z.boolean().default(false),
  never_reveal_ai: z.boolean().default(true),
  handoff: z.string().max(1000).default(""),
  examples: z.string().max(4000).default(""),
  training: z.string().max(6000).default(""),
});
export type Persona = z.infer<typeof personaSchema>;

const MARK = "### PERSONA V2";

/** Converte a persona em instruções que o cérebro dos agentes já lê (campo de regras). */
export function personaToRules(p: Persona) {
  const lines = [
    MARK,
    p.role && `Função: ${p.role}`,
    p.backstory && `Quem você é: ${p.backstory}`,
    p.personality && `Personalidade: ${p.personality}`,
    p.voice && `Jeito de falar: ${p.voice}`,
    `Formalidade ${p.formality}/10, energia ${p.energy}/10.`,
    `Emojis: ${p.emoji}. Tamanho das mensagens: ${p.length}.`,
    p.slang && `Expressões que você usa: ${p.slang}`,
    p.forbidden && `Nunca diga: ${p.forbidden}`,
    p.human_typos && "Escreva como gente no celular: às vezes minúsculas, frases soltas, sem formatação.",
    p.never_reveal_ai && "Nunca diga que é robô ou IA; se perguntarem, desvie com naturalidade.",
    p.handoff && `Passe para o dono quando: ${p.handoff}`,
    p.training && `Treinamento: ${p.training}`,
    p.examples && `Exemplos de como responder:\n${p.examples}`,
    "### FIM PERSONA",
  ].filter(Boolean);
  return lines.join("\n");
}

export const savePersona = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ id, name: z.string().trim().min(1).max(60), instance: z.string().max(120), persona: personaSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: a } = await sb.from("agents").select("rules").eq("id", data.id).single();
    const base = String(a?.rules ?? "").replace(/### PERSONA V2[\s\S]*?### FIM PERSONA\n?/g, "").trim();
    const rules = `${personaToRules(data.persona)}\n${base}`.slice(0, 6000);
    const { error } = await sb.from("agents").update({ name: data.name, instance: data.instance, persona: data.persona, rules }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.instance) await (await import("@/lib/wa-inbound.server")).registerInbound(data.instance).catch(() => false);
    return { ok: true };
  });

export const createV2Agent = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).from("agents")
      .insert({ user_id: context.userId, name: data.name, mission: "", offer: "", rules: "", ideal_client: "", instance: "", ai_provider: "native", model: "gpt-oss:120b", active: false, auto_reply: true, training_mode: false, squad: "v2" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** TESTE V1: você faz o papel do cliente aqui no painel; nada é enviado no WhatsApp. */
export const simulateV2 = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => z.object({ name: z.string().max(60), persona: personaSchema, messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(30) }).parse(d))
  .handler(async ({ data }) => {
    const key = await (await import("@/lib/service-config.server")).getOllamaKey();
    if (!key) throw new Error("IA não configurada.");
    const system = `Você é ${data.name}, uma pessoa real conversando no WhatsApp com um cliente (o usuário). Siga à risca:\n${personaToRules(data.persona)}\nResponda só a sua fala, em pt-BR, sem aspas.`;
    const res = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b", stream: false, messages: [{ role: "system", content: system }, ...data.messages] }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Limite da IA atingido." : "IA indisponível, tente de novo.");
    const j: any = await res.json();
    return { reply: String(j?.message?.content ?? "").trim().slice(0, 2000) || "..." };
  });
