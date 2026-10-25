import { it } from "node:test";
import { strict as assert } from "node:assert";
import postgres from "postgres";

const databaseUrl = process.env["SUPABASE_DB_URL"];

it("each pending request notifies approved administrators only; approved profiles do not notify", { skip: !databaseUrl }, async () => {
  if (!databaseUrl) return;
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const rollback = new Error("rollback test");
  try {
    await sql.begin(async (tx) => {
      await tx`CREATE TEMP TABLE access_notification_test (name text, approval_status text)`;
      const [definition] = await tx<{ definition: string }[]>`SELECT pg_get_functiondef('public.notify_pending_access_request()'::regprocedure) AS definition`;
      assert.ok(definition);
      // Execute an exact temporary copy because the test role cannot attach a
      // trigger using the protected production function. Everything rolls back.
      await tx.unsafe(definition.definition.replace('public.notify_pending_access_request()', 'pg_temp.notify_pending_access_request()'));
      await tx`CREATE TRIGGER access_notification_test_trigger AFTER INSERT ON access_notification_test FOR EACH ROW EXECUTE FUNCTION pg_temp.notify_pending_access_request()`;
      const [admins] = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role='admin' AND p.approval_status='approved'`;
      assert.ok(admins);
      assert.ok(admins.total > 0);
      const [before] = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM public.notifications`;
      assert.ok(before);
      await tx`INSERT INTO access_notification_test VALUES ('Teste transacional de solicitação', 'pending')`;
      const alerts = await tx<{ user_id: string }[]>`SELECT n.user_id FROM public.notifications n WHERE n.body='Teste transacional de solicitação solicitou uma conta. Abra o ACESS para analisar.' AND n.url='/acess'`;
      assert.equal(alerts.length, admins.total);
      for (const alert of alerts) {
        const [recipient] = await tx<{ admin: boolean; approved: boolean }[]>`SELECT public.has_role(${alert.user_id}::uuid,'admin') AS admin, public.is_approved(${alert.user_id}::uuid) AS approved`;
        assert.ok(recipient);
        assert.equal(recipient.admin, true);
        assert.equal(recipient.approved, true);
      }
      await tx`INSERT INTO access_notification_test VALUES ('Sem solicitação', 'approved')`;
      const [after] = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM public.notifications`;
      assert.ok(after);
      assert.equal(after.total - before.total, admins.total);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});