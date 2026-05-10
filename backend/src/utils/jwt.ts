import jwt from "jsonwebtoken";
import type { AuthUser } from "../types/auth.js";
import { env } from "../config/env.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "14d";

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user as object, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.refreshTokenSecret, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, env.jwtSecret) as AuthUser;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, env.refreshTokenSecret) as { userId: string };
}
