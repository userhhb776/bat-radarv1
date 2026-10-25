import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { cronDenied } from "@/lib/cron-guard.server";

export const Route = createFileRoute("/api/public/hooks/access-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await cronDenied(request);
        if (denied) return denied;
        const input = z.object({ notificationId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!input.success) return Response.json({ ok: false }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: notification, error } = await supabaseAdmin.from("notifications").select("user_id,url").eq("id", input.data.notificationId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!notification || notification.url !== "/acess") return Response.json({ ok: false }, { status: 404 });
        const { data: admin } = await supabaseAdmin.rpc("has_role", { _user_id: notification.user_id, _role: "admin" });
        if (!admin) return Response.json({ ok: false }, { status: 403 });
        const { sendUserPush } = await import("@/lib/push.server");
        const sent = await sendUserPush(supabaseAdmin, notification.user_id);
        return Response.json({ ok: true, sent });
      },
    },
  },
});