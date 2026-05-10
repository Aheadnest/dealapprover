import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { getPresignedGetUrl } from "../../integrations/s3/s3.js";
import { sendEmail, certificateRevokedHtml } from "../../integrations/resend/email.js";
import { Errors, AppError } from "../../utils/errors.js";
import { env } from "../../config/env.js";

interface CertRow extends RowDataPacket {
  id: string;
  slug: string;
  item_id: string;
  user_id: string;
  version: number;
  signing_key_id: string;
  payload_canonical: string;
  payload_sha256: Buffer;
  signature: Buffer;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  qr_s3_key: string | null;
  pdf_s3_key: string | null;
}

export async function getCertificate(slug: string, userId: string): Promise<CertRow> {
  const [rows] = await executeQuery<CertRow[]>(
    "SELECT * FROM certificates WHERE slug = ? AND user_id = ?",
    [slug, userId],
  );
  if (!rows.length) throw Errors.notFound("Certificate");
  return rows[0];
}

export async function revokeCertificate(
  slug: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT c.id, c.revoked_at, c.item_id, u.email, u.display_name, i.title
     FROM certificates c
     JOIN users u ON u.id = c.user_id
     JOIN items i ON i.id = c.item_id
     WHERE c.slug = ? AND c.user_id = ?`,
    [slug, userId],
  );
  if (!rows.length) throw Errors.notFound("Certificate");
  const row = rows[0] as {
    id: string;
    revoked_at: string | null;
    item_id: string;
    email: string;
    display_name: string;
    title: string;
  };
  if (row.revoked_at) {
    throw new AppError("ALREADY_REVOKED", "Certificate is already revoked", 409);
  }
  await executeQuery<ResultSetHeader>(
    "UPDATE certificates SET revoked_at = NOW(3), revoke_reason = ? WHERE slug = ? AND user_id = ?",
    [reason ?? null, slug, userId],
  );
  // Move item back to draft so it can be re-issued
  await executeQuery(
    "UPDATE items SET status = 'draft' WHERE id = ?",
    [row.item_id],
  );
  await executeQuery(
    `INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, metadata)
     VALUES (?, 'certificate.revoked', 'certificate', ?, ?)`,
    [userId, row.id, JSON.stringify({ slug, reason: reason ?? null })],
  );

  // Fire-and-forget email
  setImmediate(() => {
    void sendEmail({
      to: row.email,
      subject: `Certificate revoked — ${row.title}`,
      html: certificateRevokedHtml(row.display_name, row.title, reason ?? ""),
    }).catch((e) => console.error("[revoke] email failed:", e));
  });
}

export async function getCertQrUrl(
  slug: string,
  userId: string,
  format: "png" | "svg" | "pdf",
): Promise<string> {
  const [rows] = await executeQuery<CertRow[]>(
    "SELECT qr_s3_key, pdf_s3_key FROM certificates WHERE slug = ? AND user_id = ?",
    [slug, userId],
  );
  if (!rows.length) throw Errors.notFound("Certificate");

  let key: string | null;
  if (format === "png") key = rows[0].qr_s3_key;
  else if (format === "svg") key = rows[0].qr_s3_key?.replace(".png", ".svg") ?? null;
  else key = rows[0].pdf_s3_key;

  if (!key) throw new AppError("RENDER_NOT_READY", "Asset is still being generated", 202);

  return getPresignedGetUrl(env.awsS3BucketRenders, key, 900);
}
