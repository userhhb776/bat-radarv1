import { createServerFn } from "@tanstack/react-start";
import { requireApprovedAccount as requireSupabaseAuth } from "@/lib/access.middleware";

export const regenerateDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mineForUser } = await import("./mining.server");
    const { data: s } = await context.supabase.from("user_settings").select("niche_filter, state_filter").eq("user_id", context.userId).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chosen = await mineForUser(supabaseAdmin, context.userId, { niche: s?.niche_filter, state: s?.state_filter, replaceToday: true });
    return { count: chosen.length };
  });

export const getVapidKey = createServerFn({ method: "GET" }).handler(async () => {
  const { vapidPublicKey } = await import("./push.server");
  return { key: vapidPublicKey() };
});

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { notifyUser } = await import("./push.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sent = await notifyUser(supabaseAdmin, context.userId, "BatRadar 5.7", "Notificações ativadas! Você será avisado quando os leads do dia chegarem.");
    return { sent };
  });
