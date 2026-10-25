import { createFileRoute } from "@tanstack/react-router";

// Chamado pelo service worker ao receber um push: devolve só o título/texto da última notificação
// do dono daquela inscrição (o endpoint de push é um identificador secreto do navegador).
export const Route = createFileRoute("/api/public/push/latest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
        const fallback = { title: "BatRadar 5.7", body: "Novidades no seu radar.", url: "/diarios" };
        if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return Response.json(fallback);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sub } = await supabaseAdmin.from("push_subscriptions").select("user_id").eq("endpoint", endpoint).maybeSingle();
        if (!sub) return Response.json(fallback);
        const { data: n } = await supabaseAdmin.from("notifications").select("title, body, url").eq("user_id", sub.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        return Response.json(n ?? fallback);
      },
    },
  },
});
