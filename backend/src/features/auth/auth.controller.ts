import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import {
  signupService,
  loginService,
  verifyEmailService,
  forgotPasswordService,
  resetPasswordService,
  refreshTokenService,
  getUserById,
} from "./auth.service.js";
import { buildGoogleAuthUrl, handleGoogleCallback } from "./oauth.service.js";
import {
  startPhoneVerification,
  verifyPhoneCode,
  startIdentityVerification,
} from "./verification.service.js";
import { env } from "../../config/env.js";

export async function signupController(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, locale } = req.body as {
      email: string;
      password: string;
      locale?: string;
    };
    const result = await signupService({ email, password, locale });
    sendSuccess(res, result, 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await loginService({ email, password });
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function logoutController(_req: Request, res: Response): Promise<void> {
  res.clearCookie("refreshToken");
  sendSuccess(res, { ok: true });
}

export async function verifyEmailController(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    await verifyEmailService(token);
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    await forgotPasswordService(email);
    // Always 200 to avoid email enumeration
    sendSuccess(res, { ok: true });
  } catch {
    sendSuccess(res, { ok: true });
  }
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body as { token: string; password: string };
    await resetPasswordService({ token, password });
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function refreshTokenController(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken =
      (req.cookies as Record<string, string>)["refreshToken"] ??
      (req.body as { refreshToken?: string }).refreshToken;
    const result = await refreshTokenService(refreshToken);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMeController(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserById(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    handleError(res, err);
  }
}

export async function googleStartController(req: Request, res: Response): Promise<void> {
  try {
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : undefined;
    const url = buildGoogleAuthUrl(redirect);
    res.redirect(302, url);
  } catch (err) {
    handleError(res, err);
  }
}

export async function googleCallbackController(req: Request, res: Response): Promise<void> {
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !state) {
      res.redirect(302, `${env.appUrl}/login?error=oauth_failed`);
      return;
    }
    const result = await handleGoogleCallback(code, state);
    const redirect = result.redirect ?? "/app/items";
    // Pass tokens via URL hash so the FE can pick them up
    res.redirect(302, `${env.appUrl}${redirect}#access=${result.accessToken}&refresh=${result.refreshToken}`);
  } catch (err) {
    handleError(res, err);
  }
}

export async function phoneStartController(req: Request, res: Response): Promise<void> {
  try {
    const { phone_e164 } = req.body as { phone_e164: string };
    await startPhoneVerification(req.user!.userId, phone_e164);
    sendSuccess(res, { ok: true, message: "Verification code sent" });
  } catch (err) {
    handleError(res, err);
  }
}

export async function phoneVerifyController(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.body as { code: string };
    await verifyPhoneCode(req.user!.userId, code);
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function identityStartController(req: Request, res: Response): Promise<void> {
  try {
    const result = await startIdentityVerification(req.user!.userId, req.user!.email);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}
