import { createFileRoute } from "@tanstack/react-router";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type" } });

export const Route = createFileRoute("/api/public/jarvis")({
  server: {
    handlers: {
      OPTIONS: async () => json(null, 204),
      POST: async ({ request }) => {
        const token = /^Bearer\s+(\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token || token.length < 30) return json({ ok: false, erro: "Token ausente." }, 401);
        const { hashToken, runAction } = await import("@/lib/jarvis.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
        const { data: row } = await sb.from("jarvis_tokens").select("user_id").eq("token_hash", await hashToken(token)).maybeSingle();
        if (!row) return json({ ok: false, erro: "Token inválido." }, 401);
        const { data: profile } = await sb.from("profiles").select("approval_status").eq("id", row.user_id).maybeSingle();
        if (profile?.approval_status !== "approved") return json({ ok: false, erro: "Conta sem aprovação." }, 403);
        let body: { acao?: string; params?: Record<string, unknown> } = {};
        try { body = await request.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }
        void sb.from("jarvis_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", row.user_id).then(() => null);
        try {
          await sb.from("access_events").insert({ user_id: row.user_id, kind: "jarvis", page: "/api/public/jarvis", detail: { action: String(body.acao ?? "resumo"), ...(String(body.acao ?? "").includes("buscar") ? { niche: body.params?.["nicho"], city: body.params?.["cidade"] } : {}) }, user_agent: request.headers.get("user-agent") ?? "" });
          const data = await runAction(sb, row.user_id, String(body.acao ?? "resumo"), body.params ?? {}, new URL(request.url).origin);
          return json({ ok: true, data });
        } catch (e) {
          return json({ ok: false, erro: e instanceof Error ? e.message : "Falha" }, 400);
        }
      },
    },
  },
});
