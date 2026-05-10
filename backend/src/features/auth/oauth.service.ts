import { randomBytes } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// In-memory state store (acceptable for low-volume MVP single-instance)
const stateStore = new Map<string, { createdAt: number; redirect?: string }>();

export function buildGoogleAuthUrl(redirectAfter?: string): string {
  if (!env.googleClientId) {
    throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured", 500);
  }
  const state = randomBytes(16).toString("hex");
  stateStore.set(state, { createdAt: Date.now(), redirect: redirectAfter });
  // Expire states older than 10 min
  for (const [k, v] of stateStore) {
    if (Date.now() - v.createdAt > 10 * 60 * 1000) stateStore.delete(k);
  }
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: `${env.apiUrl}/api/v1/auth/oauth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export async function handleGoogleCallback(
  code: string,
  state: string,
): Promise<{ accessToken: string; refreshToken: string; redirect?: string }> {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured", 500);
  }
  const entry = stateStore.get(state);
  if (!entry) throw new AppError("INVALID_STATE", "Invalid or expired OAuth state", 400);
  stateStore.delete(state);

  // Exchange code for access token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: `${env.apiUrl}/api/v1/auth/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new AppError("OAUTH_TOKEN_FAILED", "Failed to exchange OAuth code", 400);
  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) throw new AppError("OAUTH_USERINFO_FAILED", "Failed to fetch Google user info", 400);
  const info = (await userRes.json()) as GoogleUserInfo;

  // Find existing OAuth account, or link by email, or create new
  const [oauthRows] = await executeQuery<RowDataPacket[]>(
    "SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_account_id = ?",
    [info.sub],
  );

  let userId: string;
  if (oauthRows.length > 0) {
    userId = (oauthRows[0] as { user_id: string }).user_id;
  } else {
    // Try link by email
    const [userRows] = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
      [info.email.toLowerCase()],
    );
    if (userRows.length > 0) {
      userId = (userRows[0] as { id: string }).id;
    } else {
      userId = uuidv4();
      await executeQuery<ResultSetHeader>(
        `INSERT INTO users (id, email, display_name, email_verified_at, locale, quota_period_start)
         VALUES (?, ?, ?, ${info.email_verified ? "NOW(3)" : "NULL"}, 'en', CURDATE())`,
        [userId, info.email.toLowerCase(), info.name || info.email.split("@")[0]],
      );
    }
    await executeQuery<ResultSetHeader>(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id)
       VALUES (?, ?, 'google', ?)`,
      [uuidv4(), userId, info.sub],
    );
  }

  const [users] = await executeQuery<RowDataPacket[]>(
    "SELECT id, email, plan, plan_status, email_verified_at FROM users WHERE id = ?",
    [userId],
  );
  const u = users[0] as {
    id: string;
    email: string;
    plan: "free" | "pro" | "business";
    plan_status: "active" | "past_due" | "canceled";
    email_verified_at: string | null;
  };

  const authUser = {
    userId: u.id,
    email: u.email,
    plan: u.plan,
    planStatus: u.plan_status,
    emailVerifiedAt: u.email_verified_at,
  };
  return {
    accessToken: signAccessToken(authUser),
    refreshToken: signRefreshToken(u.id),
    redirect: entry.redirect,
  };
}
