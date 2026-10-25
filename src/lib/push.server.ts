// Web Push sem payload (VAPID). O service worker busca o texto da notificação em /api/public/push/latest.
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function keys() {
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("VAPID_SEED não configurado");
  const priv = sha256(new TextEncoder().encode(seed));
  return { priv, pub: p256.getPublicKey(priv, false) };
}

export function vapidPublicKey() {
  return b64url(keys().pub);
}

function vapidJwt(aud: string) {
  const { priv } = keys();
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const input = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contato@batradar.app" })}`;
  const sig = p256.sign(sha256(new TextEncoder().encode(input)), priv).toCompactRawBytes();
  return `${input}.${b64url(sig)}`;
}

export async function notifyUser(admin: SupabaseClient<Database>, userId: string, title: string, body: string, url = "/diarios") {
  const { error } = await admin.from("notifications").insert({ user_id: userId, title, body, url });
  if (error) throw new Error(error.message);
  return sendUserPush(admin, userId);
}

export async function sendUserPush(admin: SupabaseClient<Database>, userId: string) {
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint").eq("user_id", userId);
  const pub = vapidPublicKey();
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      const res = await fetch(s.endpoint, {
        method: "POST",
        headers: { Authorization: `vapid t=${vapidJwt(new URL(s.endpoint).origin)}, k=${pub}`, TTL: "86400", Urgency: "normal", "Content-Length": "0" },
      });
      if (res.status === 404 || res.status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else if (!res.ok) console.error(`Push ${res.status}: ${await res.text()}`);
      else sent++;
    } catch (e) {
      console.error(e);
    }
  }
  return sent;
}
