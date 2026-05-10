import argon2 from "argon2";
import { randomBytes, createHash } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { executeQuery, mysqlPool } from "../../integrations/mysql/pool.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { sendEmail, emailVerificationHtml, passwordResetHtml } from "../../integrations/resend/email.js";
import { AppError, Errors } from "../../utils/errors.js";
import { env } from "../../config/env.js";

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string | null;
  email_verified_at: string | null;
  display_name: string;
  plan: "free" | "pro" | "business";
  plan_status: "active" | "past_due" | "canceled";
  locale: string;
  country_iso2: string | null;
}

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

export async function signupService(input: {
  email: string;
  password: string;
  locale?: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const email = input.email.toLowerCase().trim();
  if (!email || !input.password) throw Errors.validation("Email and password are required");
  if (input.password.length < 8) throw Errors.validation("Password must be at least 8 characters");

  const [existing] = await executeQuery<RowDataPacket[]>(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );
  if (existing.length > 0) throw Errors.conflict("An account with this email already exists");

  const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
  const userId = uuidv4();
  const displayName = email.split("@")[0];

  await executeQuery<ResultSetHeader>(
    `INSERT INTO users (id, email, password_hash, display_name, locale, quota_period_start, quota_used, plan, plan_status)
     VALUES (?, ?, ?, ?, ?, CURDATE(), 0, 'free', 'active')`,
    [userId, email, passwordHash, displayName, input.locale ?? "en"],
  );

  await sendVerificationEmail(userId, email, displayName);

  const user = { userId, email, plan: "free" as const, planStatus: "active" as const, emailVerifiedAt: null };
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(userId),
  };
}

export async function loginService(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const email = input.email.toLowerCase().trim();
  const [rows] = await executeQuery<UserRow[]>(
    "SELECT id, email, password_hash, email_verified_at, plan, plan_status FROM users WHERE email = ?",
    [email],
  );
  if (!rows.length) throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const user = rows[0];
  if (!user.password_hash) {
    throw new AppError("OAUTH_ACCOUNT", "This account uses Google login. Please sign in with Google.", 401);
  }

  const valid = await argon2.verify(user.password_hash, input.password);
  if (!valid) throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const authUser = {
    userId: user.id,
    email: user.email,
    plan: user.plan,
    planStatus: user.plan_status,
    emailVerifiedAt: user.email_verified_at,
  };
  return {
    accessToken: signAccessToken(authUser),
    refreshToken: signRefreshToken(user.id),
  };
}

export async function verifyEmailService(token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT user_id FROM email_verification_tokens
     WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL`,
    [tokenHash],
  );
  if (!rows.length) throw Errors.validation("Invalid or expired verification token");

  const { user_id } = rows[0] as { user_id: string };
  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE users SET email_verified_at = NOW(3) WHERE id = ?", [user_id]);
    await conn.execute(
      "UPDATE email_verification_tokens SET used_at = NOW(3) WHERE token_hash = ?",
      [tokenHash],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function forgotPasswordService(email: string): Promise<void> {
  const [rows] = await executeQuery<UserRow[]>(
    "SELECT id, display_name FROM users WHERE email = ?",
    [email.toLowerCase().trim()],
  );
  if (!rows.length) return;

  const user = rows[0];
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await executeQuery(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
     ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), used_at = NULL`,
    [user.id, tokenHash],
  );

  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Reset your DealApprover password",
    html: passwordResetHtml(resetUrl),
  });
}

export async function resetPasswordService(input: {
  token: string;
  password: string;
}): Promise<void> {
  if (input.password.length < 8) throw Errors.validation("Password must be at least 8 characters");
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT user_id FROM password_reset_tokens
     WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL`,
    [tokenHash],
  );
  if (!rows.length) throw Errors.validation("Invalid or expired reset token");

  const { user_id } = rows[0] as { user_id: string };
  const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user_id]);
    await conn.execute(
      "UPDATE password_reset_tokens SET used_at = NOW(3) WHERE token_hash = ?",
      [tokenHash],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function refreshTokenService(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshToken) throw Errors.unauthorized();
  let userId: string;
  try {
    ({ userId } = verifyRefreshToken(refreshToken));
  } catch {
    throw Errors.unauthorized();
  }

  const [rows] = await executeQuery<UserRow[]>(
    "SELECT id, email, plan, plan_status, email_verified_at FROM users WHERE id = ?",
    [userId],
  );
  if (!rows.length) throw Errors.unauthorized();

  const user = rows[0];
  const authUser = {
    userId: user.id,
    email: user.email,
    plan: user.plan,
    planStatus: user.plan_status,
    emailVerifiedAt: user.email_verified_at,
  };
  return {
    accessToken: signAccessToken(authUser),
    refreshToken: signRefreshToken(user.id),
  };
}

export async function getUserById(userId: string): Promise<Partial<UserRow>> {
  const [rows] = await executeQuery<UserRow[]>(
    `SELECT id, email, display_name, locale, country_iso2, plan, plan_status, plan_renews_at,
            email_verified_at, phone_e164, phone_verified_at, identity_verified_at,
            quota_used, quota_period_start, stripe_customer_id
     FROM users WHERE id = ? AND deleted_at IS NULL`,
    [userId],
  );
  if (!rows.length) throw Errors.notFound("User");
  return rows[0];
}

async function sendVerificationEmail(
  userId: string,
  email: string,
  displayName: string,
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await executeQuery(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [userId, tokenHash],
  );

  const verifyUrl = `${env.appUrl}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your DealApprover email",
    html: emailVerificationHtml(displayName, verifyUrl),
  }).catch((e) => console.error("[auth] Failed to send verification email:", e));
}
