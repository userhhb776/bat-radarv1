// Ownership of WhatsApp (Evolution) instances.
// App-created instances are prefixed with the owner's id. Instances created directly
// on the server (no app prefix, e.g. imported numbers) belong to admin accounts only.
type Ctx = { userId: string; supabase: { rpc: (...a: any[]) => any } };

export const prefixFor = (userId: string) => `br${userId.replace(/-/g, "").slice(0, 10)}`;
const APP_PREFIX = /^br[0-9a-f]{10}-/;

export function isAppInstance(name: string) {
  return APP_PREFIX.test(name);
}

export async function isAdmin(ctx: Ctx): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return data === true;
}

export function canUse(userId: string, admin: boolean, name: string) {
  return name.startsWith(prefixFor(userId) + "-") || (admin && !isAppInstance(name));
}

export async function ownInstance(ctx: Ctx, name: string) {
  if (!canUse(ctx.userId, await isAdmin(ctx), name)) throw new Error("Conexão não pertence a esta conta.");
  return encodeURIComponent(name);
}
