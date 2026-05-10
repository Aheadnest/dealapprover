import { randomBytes } from "crypto";

// Minimal RFC 8785 JCS implementation: object keys sorted lexicographically,
// no whitespace. Sufficient for our payload schema (no special floats / unicode
// edge cases). Replace with the `canonicalize` npm package if those arise.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { executeQuery, mysqlPool } from "../../integrations/mysql/pool.js";
import {
  getPresignedPutUrl,
  sha256OfS3Object,
  putObject,
  getObjectBuffer,
  deleteObject,
} from "../../integrations/s3/s3.js";
import { encryptField } from "../../lib/crypto/aes.js";
import { loadActiveSigningKey, sha256, ed25519Sign } from "../../lib/crypto/signing.js";
import { generateQrPng, generateQrSvg } from "../../lib/qr/qr.js";
import { renderStickerPdf } from "../../lib/pdf/sticker.js";
import { processPhoto } from "../../lib/image/sharp.js";
import { allocateUniqueSlug } from "../../lib/slug/slug.js";
import {
  validateCategoryExtra,
  categoryMinPhotos,
  validateImei,
  CATEGORY_KEYS,
  type CategoryKey,
} from "../../lib/categories/index.js";
import { isProhibited } from "../../lib/categories/prohibited.js";
import { Errors, AppError } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { sendEmail, certificateIssuedHtml } from "../../integrations/resend/email.js";

interface ItemRow extends RowDataPacket {
  id: string;
  user_id: string;
  category: string;
  title: string;
  brand: string | null;
  model: string | null;
  serial_number_enc: Buffer | null;
  serial_number_hash: Buffer | null;
  imei_enc: Buffer | null;
  gtin: string | null;
  condition: string;
  description: string;
  price_minor: number | null;
  currency: string | null;
  extra: string;
  status: "draft" | "active" | "revoked";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PhotoRow extends RowDataPacket {
  id: string;
  item_id: string;
  position: number;
  s3_key: string;
  thumb_s3_key: string | null;
  sha256: Buffer;
  width: number;
  height: number;
  bytes: number;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  display_name: string;
  plan: "free" | "pro" | "business";
  plan_status: "active" | "past_due" | "canceled";
  email_verified_at: string | null;
  phone_verified_at: string | null;
  identity_verified_at: string | null;
  quota_used: number;
  quota_period_start: string;
}

export async function listItems(params: {
  userId: string;
  status?: string;
  category?: string;
  q?: string;
  cursor?: string;
}) {
  const conditions: string[] = ["user_id = ?", "deleted_at IS NULL"];
  const values: (string | number)[] = [params.userId];

  if (params.status) {
    conditions.push("status = ?");
    values.push(params.status);
  }
  if (params.category) {
    conditions.push("category = ?");
    values.push(params.category);
  }
  if (params.q) {
    conditions.push("title LIKE ?");
    values.push(`%${params.q}%`);
  }

  const [rows] = await executeQuery<ItemRow[]>(
    `SELECT id, category, title, brand, model, \`condition\`, status, created_at, updated_at
     FROM items WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 50`,
    values,
  );
  return rows;
}

export async function createItem(userId: string, body: Record<string, unknown>) {
  const {
    category, title, condition, description, brand, model,
    price_minor, currency, serial_number, imei, gtin, extra,
  } = body;

  if (!category || !title || !condition) {
    throw Errors.validation("category, title, and condition are required");
  }
  if (!CATEGORY_KEYS.includes(category as CategoryKey)) {
    throw Errors.validation(`Invalid category. Must be one of: ${CATEGORY_KEYS.join(", ")}`);
  }
  if (isProhibited(category as string)) {
    throw Errors.validation("This category is prohibited");
  }

  const parsedExtra = extra && typeof extra === "object" ? extra : {};
  const extraValidation = validateCategoryExtra(category as CategoryKey, parsedExtra);
  if (!extraValidation.success) {
    throw Errors.validation(`Invalid category fields: ${extraValidation.error}`);
  }

  if (imei && !validateImei(String(imei))) {
    throw Errors.validation("Invalid IMEI (failed Luhn check)");
  }

  let serialEncBuf: Buffer | null = null;
  let serialHashBuf: Buffer | null = null;
  if (serial_number) {
    const normalized = String(serial_number).toUpperCase().replace(/[^A-Z0-9]/g, "");
    serialEncBuf = encryptField(String(serial_number));
    serialHashBuf = sha256(Buffer.from(normalized));
  }

  let imeiEncBuf: Buffer | null = null;
  if (imei) imeiEncBuf = encryptField(String(imei));

  const id = uuidv4();
  await executeQuery<ResultSetHeader>(
    `INSERT INTO items
       (id, user_id, category, title, brand, model, \`condition\`, description,
        price_minor, currency, serial_number_enc, serial_number_hash,
        imei_enc, gtin, extra, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [
      id, userId, category as string, title as string,
      (brand as string) ?? null, (model as string) ?? null,
      condition as string, (description as string) ?? "",
      (price_minor as number) ?? null, (currency as string) ?? null,
      serialEncBuf, serialHashBuf, imeiEncBuf, (gtin as string) ?? null,
      JSON.stringify(extraValidation.data),
    ],
  );

  return getItem(id, userId);
}

export async function getItem(id: string, userId: string) {
  const [rows] = await executeQuery<ItemRow[]>(
    "SELECT * FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    [id, userId],
  );
  if (!rows.length) throw Errors.notFound("Item");

  const [photos] = await executeQuery<PhotoRow[]>(
    "SELECT id, position, s3_key, thumb_s3_key, width, height, bytes FROM item_photos WHERE item_id = ? ORDER BY position",
    [id],
  );

  return { ...rows[0], photos };
}

export async function updateItem(id: string, userId: string, body: Record<string, unknown>) {
  const [rows] = await executeQuery<ItemRow[]>(
    "SELECT status FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    [id, userId],
  );
  if (!rows.length) throw Errors.notFound("Item");
  if (rows[0].status !== "draft") {
    throw new AppError("ITEM_NOT_DRAFT", "Only draft items can be edited", 400);
  }

  const allowed = ["title", "brand", "model", "condition", "description", "price_minor", "currency", "extra"] as const;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      // `condition` is a reserved word in MySQL
      const column = key === "condition" ? "`condition`" : key;
      updates.push(`${column} = ?`);
      values.push(key === "extra" ? JSON.stringify(body[key]) : body[key]);
    }
  }
  if (!updates.length) throw Errors.validation("No updatable fields provided");

  values.push(id, userId);
  await executeQuery<ResultSetHeader>(
    `UPDATE items SET ${updates.join(", ")}, updated_at = NOW(3) WHERE id = ? AND user_id = ?`,
    values as string[],
  );
  return getItem(id, userId);
}

export async function deleteItem(id: string, userId: string): Promise<void> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM certificates c WHERE c.item_id = i.id AND c.revoked_at IS NULL) AS active_certs
     FROM items i WHERE i.id = ? AND i.user_id = ? AND i.deleted_at IS NULL`,
    [id, userId],
  );
  if (!rows.length) throw Errors.notFound("Item");
  if ((rows[0] as { active_certs: number }).active_certs > 0) {
    throw new AppError("ITEM_HAS_ACTIVE_CERT", "Revoke the active certificate before deleting this item", 409);
  }
  await executeQuery("UPDATE items SET deleted_at = NOW(3) WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function signPhotoUpload(
  itemId: string,
  userId: string,
  contentType: string,
  filename: string,
): Promise<{ uploadKey: string; presignedUrl: string }> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    [itemId, userId],
  );
  if (!rows.length) throw Errors.notFound("Item");

  if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(contentType)) {
    throw Errors.validation("Content type must be image/jpeg, image/png, or image/heic");
  }

  const key = `tmp/${itemId}/${randomBytes(16).toString("hex")}/${filename}`;
  const presignedUrl = await getPresignedPutUrl(env.awsS3BucketUploads, key, contentType);
  return { uploadKey: key, presignedUrl };
}

export async function finalizePhoto(
  itemId: string,
  userId: string,
  input: { uploadKey: string; position: number },
): Promise<PhotoRow> {
  const [rows] = await executeQuery<ItemRow[]>(
    "SELECT id, status FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    [itemId, userId],
  );
  if (!rows.length) throw Errors.notFound("Item");
  if (rows[0].status !== "draft") {
    throw new AppError("ITEM_NOT_DRAFT", "Only draft items can have photos modified", 400);
  }

  const [count] = await executeQuery<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM item_photos WHERE item_id = ?",
    [itemId],
  );
  if ((count[0] as { cnt: number }).cnt >= 8) {
    throw Errors.validation("Maximum 8 photos per item");
  }

  // Fetch original upload, strip EXIF, generate thumbnails
  const rawBuf = await getObjectBuffer(env.awsS3BucketUploads, input.uploadKey);
  if (rawBuf.length > 10 * 1024 * 1024) {
    throw Errors.validation("Photo exceeds 10 MB limit");
  }
  const processed = await processPhoto(rawBuf);
  if (processed.width < 800 || processed.height < 800) {
    throw Errors.validation("Photo must be at least 800×800 pixels");
  }

  const imageHash = sha256(processed.full);
  const hashHex = imageHash.toString("hex");
  const fullKey = `photos/${hashHex}.jpg`;
  const thumbKey = `photos/${hashHex}_thumb800.jpg`;

  await putObject(env.awsS3BucketPhotos, fullKey, processed.full, "image/jpeg");
  await putObject(env.awsS3BucketPhotos, thumbKey, processed.thumb800, "image/jpeg");
  await deleteObject(env.awsS3BucketUploads, input.uploadKey).catch(() => {});

  const photoId = uuidv4();
  await executeQuery<ResultSetHeader>(
    `INSERT INTO item_photos (id, item_id, position, s3_key, thumb_s3_key, sha256, width, height, bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photoId, itemId, input.position, fullKey, thumbKey, imageHash,
      processed.width, processed.height, processed.full.length,
    ],
  );

  const [photo] = await executeQuery<PhotoRow[]>("SELECT * FROM item_photos WHERE id = ?", [photoId]);
  return photo[0];
}

export async function deletePhoto(itemId: string, photoId: string, userId: string): Promise<void> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT p.id FROM item_photos p
     JOIN items i ON i.id = p.item_id
     WHERE p.id = ? AND p.item_id = ? AND i.user_id = ? AND i.status = 'draft'`,
    [photoId, itemId, userId],
  );
  if (!rows.length) throw Errors.notFound("Photo");
  await executeQuery("DELETE FROM item_photos WHERE id = ?", [photoId]);
}

export async function issueItem(itemId: string, userId: string) {
  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.execute<UserRow[]>(
      `SELECT id, email, display_name, plan, plan_status, email_verified_at,
              phone_verified_at, identity_verified_at, quota_used, quota_period_start
       FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) throw Errors.notFound("User");
    const user = userRows[0];

    if (!user.email_verified_at) throw Errors.emailNotVerified();

    // Quota check for free tier (3/month)
    if (user.plan === "free") {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const quotaMonth = user.quota_period_start.slice(0, 7);
      const quotaUsed = quotaMonth === currentMonth ? user.quota_used : 0;
      if (quotaUsed >= 3) throw Errors.quotaExceeded();
    }

    const [itemRows] = await conn.execute<ItemRow[]>(
      "SELECT * FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE",
      [itemId, userId],
    );
    if (!itemRows.length) throw Errors.notFound("Item");
    const item = itemRows[0];
    if (item.status !== "draft") {
      throw new AppError("ITEM_NOT_DRAFT", "Item must be in draft status to issue certificate", 400);
    }

    const [photoRows] = await conn.execute<PhotoRow[]>(
      "SELECT * FROM item_photos WHERE item_id = ? ORDER BY position",
      [itemId],
    );
    const minPhotos = categoryMinPhotos[item.category as CategoryKey] ?? 3;
    if (photoRows.length < minPhotos) {
      throw Errors.validation(`At least ${minPhotos} photos required for ${item.category}`);
    }

    // Re-verify photo hashes from S3 (defense-in-depth)
    const verifiedPhotos = await Promise.all(
      photoRows.map(async (p) => {
        const liveHash = await sha256OfS3Object(env.awsS3BucketPhotos, p.s3_key);
        const stored = Buffer.isBuffer(p.sha256) ? p.sha256 : Buffer.from(String(p.sha256), "hex");
        if (!liveHash.equals(stored)) {
          throw new AppError("PHOTO_HASH_MISMATCH", "Photo integrity check failed", 500);
        }
        return { i: p.position, sha256: liveHash.toString("hex") };
      }),
    );

    const signingKey = await loadActiveSigningKey();

    const verificationLevel = user.identity_verified_at ? "L2" : user.phone_verified_at ? "L1" : "L0";
    const certId = `cert_${uuidv4().replace(/-/g, "")}`;
    const slug = await allocateUniqueSlug(conn);

    const payload = {
      v: 1,
      id: certId,
      slug,
      iss: "dealapprover.com",
      sub: {
        user_id: userId,
        verification_level: verificationLevel,
        display_name: user.display_name,
      },
      item: {
        category: item.category,
        title: item.title,
        brand: item.brand ?? null,
        model: item.model ?? null,
        condition: item.condition,
        extra: JSON.parse(item.extra ?? "{}") as Record<string, unknown>,
      },
      photos: verifiedPhotos,
      issued_at: new Date().toISOString(),
      key_id: signingKey.id,
    };

    const canonicalStr = canonicalize(payload);
    const canonicalBytes = Buffer.from(canonicalStr);
    const payloadHash = sha256(canonicalBytes);
    const signature = await ed25519Sign(signingKey.privateKeyRaw, payloadHash);

    if (signature.length !== 64) {
      throw new AppError("INVALID_SIGNATURE", "Signature must be 64 bytes", 500);
    }

    const dbCertId = uuidv4();
    await conn.execute(
      `INSERT INTO certificates
         (id, slug, item_id, user_id, version, signing_key_id, payload_canonical,
          payload_sha256, signature, issued_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, NOW(3))`,
      [dbCertId, slug, itemId, userId, signingKey.id, JSON.stringify(payload), payloadHash, signature],
    );
    await conn.execute("UPDATE items SET status = 'active' WHERE id = ?", [itemId]);

    if (user.plan === "free") {
      const today = new Date().toISOString().slice(0, 10);
      const quotaMonth = user.quota_period_start.slice(0, 7);
      const currentMonth = today.slice(0, 7);
      if (quotaMonth !== currentMonth) {
        await conn.execute("UPDATE users SET quota_used = 1, quota_period_start = ? WHERE id = ?", [today, userId]);
      } else {
        await conn.execute("UPDATE users SET quota_used = quota_used + 1 WHERE id = ?", [userId]);
      }
    }

    await conn.execute(
      `INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES (?, 'certificate.issued', 'certificate', ?, ?)`,
      [userId, dbCertId, JSON.stringify({ slug, item_id: itemId })],
    );

    await conn.commit();

    // Async: render QR + PDF + email
    setImmediate(() => {
      void renderAndEmail(dbCertId, slug, user.email, user.display_name, item.title, payload.issued_at, verificationLevel);
    });

    return { id: dbCertId, slug, url: `https://dealapprover.com/c/${slug}` };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function renderAndEmail(
  certId: string,
  slug: string,
  userEmail: string,
  userName: string,
  itemTitle: string,
  issuedAt: string,
  verificationLevel: "L0" | "L1" | "L2",
): Promise<void> {
  try {
    const certUrl = `https://dealapprover.com/c/${slug}`;
    const [qrPng, qrSvg] = await Promise.all([generateQrPng(certUrl), generateQrSvg(certUrl)]);

    const pdfBuf = await renderStickerPdf({
      title: itemTitle, slug, issuedAt, sellerName: userName, verificationLevel, qrPngBuffer: qrPng,
    });

    const qrKey = `qr/${slug}.png`;
    const svgKey = `qr/${slug}.svg`;
    const pdfKey = `pdf/${slug}.pdf`;

    await Promise.all([
      putObject(env.awsS3BucketRenders, qrKey, qrPng, "image/png"),
      putObject(env.awsS3BucketRenders, svgKey, Buffer.from(qrSvg), "image/svg+xml"),
      putObject(env.awsS3BucketRenders, pdfKey, pdfBuf, "application/pdf"),
    ]);

    await executeQuery(
      "UPDATE certificates SET qr_s3_key = ?, pdf_s3_key = ? WHERE id = ?",
      [qrKey, pdfKey, certId],
    );

    await sendEmail({
      to: userEmail,
      subject: `Certificate issued — ${itemTitle}`,
      html: certificateIssuedHtml(userName, certUrl, itemTitle),
    });
  } catch (e) {
    console.error("[issueItem] async render failed:", e);
  }
}
