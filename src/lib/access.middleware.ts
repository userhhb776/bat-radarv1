import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canUsePanel } from "./access-policy";

export const requireApprovedAccount = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.from("profiles").select("approval_status").eq("id", context.userId).maybeSingle();
    if (error || !canUsePanel(data?.approval_status)) throw new Error("Sua conta ainda não foi aprovada.");
    return next();
  });