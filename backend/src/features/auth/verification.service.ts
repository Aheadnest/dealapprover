import type { RowDataPacket } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { stripe } from "../../integrations/stripe/stripe.js";
import { env } from "../../config/env.js";
import { Errors, AppError } from "../../utils/errors.js";
import { createHash } from "crypto";

// ============================================================================
// Phone (L1) — SMS code verification
// MVP NOTE: SMS sending is stubbed. To go live, plug in Twilio or MessageBird
// in `sendSmsCode`. Until then, the dev-mode code is logged to the server log.
// ============================================================================

const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

export async function startPhoneVerification(userId: string, phone: string): Promise<void> {
  if (!PHONE_E164.test(phone)) throw Errors.validation("Phone number must be E.164 (e.g., +351912345678)");

  // 6-digit numeric code, expires in 10 min, single-use
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = createHash("sha256").update(code).digest("hex");

  await executeQuery(
    `INSERT INTO phone_verification_codes (user_id, phone_e164, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
     ON DUPLICATE KEY UPDATE phone_e164 = VALUES(phone_e164), code_hash = VALUES(code_hash),
                             expires_at = VALUES(expires_at), used_at = NULL`,
    [userId, phone, codeHash],
  );

  await sendSmsCode(phone, code);
}

export async function verifyPhoneCode(userId: string, code: string): Promise<void> {
  const codeHash = createHash("sha256").update(code).digest("hex");
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT phone_e164 FROM phone_verification_codes
     WHERE user_id = ? AND code_hash = ? AND used_at IS NULL AND expires_at > NOW()`,
    [userId, codeHash],
  );
  if (!rows.length) throw Errors.validation("Invalid or expired code");
  const phone = (rows[0] as { phone_e164: string }).phone_e164;

  await executeQuery(
    "UPDATE users SET phone_e164 = ?, phone_verified_at = NOW(3) WHERE id = ?",
    [phone, userId],
  );
  await executeQuery(
    "UPDATE phone_verification_codes SET used_at = NOW(3) WHERE user_id = ?",
    [userId],
  );
}

async function sendSmsCode(phone: string, code: string): Promise<void> {
  // TODO(prod): Replace with Twilio/MessageBird API call.
  // Example Twilio: await twilio.messages.create({ to: phone, from: env.twilioFromNumber, body: `Your DealApprover code is ${code}` });
  if (env.nodeEnv === "development") {
    console.log(`[sms-stub] would send code "${code}" to ${phone}`);
  } else {
    console.warn(`[sms] ⚠ SMS provider not configured. Code for ${phone}: ${code}`);
  }
}

// ============================================================================
// Identity (L2) — Stripe Identity verification session
// ============================================================================

export async function startIdentityVerification(
  userId: string,
  email: string,
): Promise<{ url: string }> {
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { user_id: userId },
    options: { document: { allowed_types: ["driving_license", "id_card", "passport"], require_matching_selfie: true } },
    return_url: `${env.appUrl}/app/account?identity=verified`,
  });

  if (!session.url) throw new AppError("IDENTITY_FAILED", "Failed to create identity session", 500);

  await executeQuery(
    "UPDATE users SET identity_verification_id = ? WHERE id = ? AND email = ?",
    [session.id, userId, email],
  );

  return { url: session.url };
}
