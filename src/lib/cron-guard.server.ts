import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Aceita o segredo do cron da plataforma OU o token privado guardado em public.cron_tokens
// (lido só pelo servidor). Protege contra o segredo do agendador ficar dessincronizado.
export async function cronDenied(request: Request): Promise<Response | null> {
  const denied = await authenticateCronRequest(request);
  if (!denied || denied.status !== 401) return denied;
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("cron_tokens").select("token").eq("name", "scheduler").maybeSingle();
  if (!data?.token) return denied;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const h = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(h(token), h(data.token)) ? null : denied;
}
