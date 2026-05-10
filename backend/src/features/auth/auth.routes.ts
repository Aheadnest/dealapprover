import { Router } from "express";
import {
  signupController,
  loginController,
  logoutController,
  verifyEmailController,
  forgotPasswordController,
  resetPasswordController,
  refreshTokenController,
  getMeController,
  googleStartController,
  googleCallbackController,
  phoneStartController,
  phoneVerifyController,
  identityStartController,
} from "./auth.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";

export const authRouter = Router();

authRouter.post("/auth/signup", signupController);
authRouter.post("/auth/login", loginController);
authRouter.post("/auth/logout", logoutController);
authRouter.post("/auth/verify-email", verifyEmailController);
authRouter.post("/auth/forgot-password", forgotPasswordController);
authRouter.post("/auth/reset-password", resetPasswordController);
authRouter.post("/auth/refresh", refreshTokenController);
authRouter.get("/auth/me", requireAuth, getMeController);

// OAuth
authRouter.get("/auth/oauth/google/start", googleStartController);
authRouter.get("/auth/oauth/google/callback", googleCallbackController);

// Phone (L1)
authRouter.post("/auth/phone/start", requireAuth, phoneStartController);
authRouter.post("/auth/phone/verify", requireAuth, phoneVerifyController);

// Identity (L2)
authRouter.post("/auth/identity/start", requireAuth, identityStartController);
