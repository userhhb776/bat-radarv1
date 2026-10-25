import { supabase } from "@/integrations/supabase/client";
import { getVapidKey } from "@/lib/mining.functions";

export type PushResult = "registered" | "unsupported" | "open-in-new-tab" | "denied" | "error";

const toBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function enablePush(): Promise<PushResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const { key } = await getVapidKey();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }));
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return "error";
    const { error } = await supabase.from("push_subscriptions").upsert({ user_id: u.user.id, endpoint: sub.endpoint }, { onConflict: "endpoint" });
    if (error) throw error;
    return "registered";
  } catch (e) {
    console.error(e);
    return "error";
  }
}

export const pushMessages: Record<PushResult, string> = {
  registered: "Notificações ativadas!",
  unsupported: "Este navegador não aceita notificações. No iPhone, instale o app na tela inicial e abra por ele.",
  "open-in-new-tab": "Abra o app publicado em uma aba própria para ativar as notificações.",
  denied: "Notificações bloqueadas. Libere nas configurações do site no navegador.",
  error: "Não foi possível ativar as notificações. Tente novamente.",
};

let lastPing = 0;
/** Marca que você está usando o painel (no máximo 1 vez a cada 10 min). */
export async function pingActivity() {
  if (Date.now() - lastPing < 10 * 60 * 1000) return;
  lastPing = Date.now();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("user_settings").upsert({ user_id: data.user.id, last_active_at: new Date().toISOString() }, { onConflict: "user_id" });
}
