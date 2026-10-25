import { createFileRoute } from "@tanstack/react-router";
import { cronDenied } from "@/lib/cron-guard.server";

export const Route = createFileRoute("/api/public/hooks/daily-mining")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await cronDenied(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { mineForUser, summary } = await import("@/lib/mining.server");
        const { notifyUser } = await import("@/lib/push.server");
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 50 });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const { data: settings } = await supabaseAdmin.from("user_settings").select("*");
        const byUser = new Map((settings ?? []).map((s) => [s.user_id, s]));

        const report: Record<string, number | string> = {};
        for (const u of users.users) {
          const s = byUser.get(u.id);
          if (s && !s.mining_enabled) { report[u.id] = "desligado"; continue; }
          try {
            const chosen = await mineForUser(supabaseAdmin, u.id, { niche: s?.niche_filter, state: s?.state_filter });
            report[u.id] = chosen.length;
            if (chosen.length) await notifyUser(supabaseAdmin, u.id, "🦇 Leads do dia chegaram", summary(chosen));
          } catch (e) {
            console.error(e);
            report[u.id] = "erro";
          }
        }
        return Response.json({ ok: true, report });
      },
    },
  },
});
