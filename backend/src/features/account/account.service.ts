import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { Errors } from "../../utils/errors.js";

export async function getAccount(userId: string) {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT id, email, display_name, locale, country_iso2, plan, plan_status, plan_renews_at,
            email_verified_at, phone_e164, phone_verified_at, identity_verified_at,
            quota_used, quota_period_start, created_at
     FROM users WHERE id = ? AND deleted_at IS NULL`,
    [userId],
  );
  if (!rows.length) throw Errors.notFound("User");
  return rows[0];
}

export async function updateAccount(userId: string, body: Record<string, unknown>) {
  const allowed = ["display_name", "locale", "country_iso2"] as const;
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (!updates.length) throw Errors.validation("No updatable fields provided");
  values.push(userId);
  await executeQuery<ResultSetHeader>(
    `UPDATE users SET ${updates.join(", ")}, updated_at = NOW(3) WHERE id = ?`,
    values as string[],
  );
  return getAccount(userId);
}

export async function exportAccount(userId: string) {
  const [user] = await executeQuery<RowDataPacket[]>(
    "SELECT id, email, display_name, locale, country_iso2, plan, created_at FROM users WHERE id = ?",
    [userId],
  );
  const [items] = await executeQuery<RowDataPacket[]>(
    "SELECT id, category, title, condition, status, created_at FROM items WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  const [certs] = await executeQuery<RowDataPacket[]>(
    "SELECT slug, issued_at, revoked_at FROM certificates WHERE user_id = ?",
    [userId],
  );
  return { user: user[0], items, certificates: certs, exported_at: new Date().toISOString() };
}

export async function scheduleAccountDeletion(userId: string): Promise<void> {
  await executeQuery(
    "UPDATE users SET deleted_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = ?",
    [userId],
  );
}
