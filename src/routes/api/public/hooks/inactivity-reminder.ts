import { createFileRoute } from "@tanstack/react-router";
import { cronDenied } from "@/lib/cron-guard.server";

export const Route = createFileRoute("/api/public/hooks/inactivity-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await cronDenied(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyUser } = await import("@/lib/push.server");
        const cutoff = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
        const { data: idle } = await supabaseAdmin.from("user_settings").select("user_id, last_active_at, last_reminder_at").lt("last_active_at", cutoff);
        let sent = 0;
        for (const s of idle ?? []) {
          // um lembrete por período parado
          if (s.last_reminder_at && s.last_reminder_at > (s.last_active_at ?? "")) continue;
          const { count } = await supabaseAdmin.from("daily_leads").select("id", { count: "exact", head: true }).eq("user_id", s.user_id);
          const hours = Math.floor((Date.now() - new Date(s.last_active_at!).getTime()) / 3600000);
          await notifyUser(
            supabaseAdmin, s.user_id, "🦇 O radar está esperando você",
            `Faz ${hours}h que você não prospecta. ${count ? `Há ${count} empresas sem site nos Leads do dia` : "Abra o painel e garimpe novas empresas"} — 10 minutos de abordagem hoje já fazem diferença.`,
          );
          await supabaseAdmin.from("user_settings").update({ last_reminder_at: new Date().toISOString() }).eq("user_id", s.user_id);
          sent++;
        }
        return Response.json({ ok: true, sent });
      },
    },
  },
});
