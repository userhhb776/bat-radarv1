import { createServerFn } from "@tanstack/react-start";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";

// Gera um novo token (substitui o anterior). Só o hash fica salvo; o token aparece uma única vez.
export const jarvisNewToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { randomBytes } = await import("node:crypto");
    const { hashToken } = await import("@/lib/jarvis.server");
    const token = "jv_" + randomBytes(32).toString("hex");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("jarvis_tokens").upsert({ user_id: context.userId, token_hash: await hashToken(token), created_at: new Date().toISOString(), last_used_at: null });
    if (error) throw new Error(error.message);
    return { token };
  });
