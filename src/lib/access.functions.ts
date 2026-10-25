import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canManageAccess } from "./access-policy";

export const getAccountAccess = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [{ data: profile, error }, { data: admin }] = await Promise.all([
    context.supabase.from("profiles").select("id,name,email,approval_status,created_at").eq("id", context.userId).single(),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
  ]);
  if (error) throw new Error("Não foi possível consultar a aprovação. Tente novamente.");
  return { profile, admin: canManageAccess(admin === true, profile.approval_status) };
});

export const listAccessAccounts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!admin) throw new Error("Acesso exclusivo da conta principal.");
  const { data, error } = await context.supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
});

export const listAccessHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid().optional(), offset: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Acesso exclusivo da conta principal.");
    let q = context.supabase.from("access_events").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id").range(data.offset, data.offset + 49);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows, count: count ?? 0 };
  });

export const reviewAccessAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Acesso exclusivo da conta principal.");
    if (data.userId === context.userId) throw new Error("Não é possível alterar a conta principal.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error } = await supabaseAdmin.from("profiles").update({ approval_status: data.decision, reviewed_at: new Date().toISOString() }).eq("id", data.userId).eq("approval_status", "pending").select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new Error("Esta solicitação já foi analisada. Atualize a lista.");
    await supabaseAdmin.from("access_events").insert({ user_id: context.userId, kind: "approval", page: "/acess", detail: { account: data.userId, decision: data.decision } });
    return { ok: true };
  });