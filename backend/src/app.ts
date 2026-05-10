import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { CorsOptions } from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { itemsRouter } from "./features/items/items.routes.js";
import { certificatesRouter } from "./features/certificates/certificates.routes.js";
import { publicRouter } from "./features/public/public.routes.js";
import { trustPageRouter } from "./features/trust-page/trustPage.routes.js";
import { billingRouter } from "./features/billing/billing.routes.js";
import { accountRouter } from "./features/account/account.routes.js";
import { reportsRouter } from "./features/reports/reports.routes.js";
import { scansRouter } from "./features/scans/scans.routes.js";

export function createApp() {
  const app = express();

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (
        env.nodeEnv === "development" ||
        !origin ||
        env.corsOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} is not allowed`), false);
      }
    },
    credentials: true,
  };
  app.use(cors(corsOptions));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "*.amazonaws.com"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  // Stripe webhook needs raw body
  app.use(
    "/api/v1/billing/webhook",
    express.raw({ type: "application/json" }),
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression({ threshold: 1024 }));

  // Auth rate limits (spec §9.7)
  // Login: 5 / 15min per IP+email
  app.use(
    "/api/v1/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const body = req.body as { email?: string } | undefined;
        const email = body?.email ?? "";
        return `${req.ip}:${email.toLowerCase()}`;
      },
      message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
    }),
  );
  // Signup: 3 / hour per IP
  app.use(
    "/api/v1/auth/signup",
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Too many signup attempts. Try again later." } },
    }),
  );
  // Forgot password: 5 / hour per IP
  app.use(
    "/api/v1/auth/forgot-password",
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Too many password reset requests." } },
    }),
  );
  // Item issuance: 10 / hour per user (via IP fallback for unauth)
  app.use(
    "/api/v1/items/:id/issue",
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Too many certificate issuances per hour." } },
    }),
  );

  // Trust page — /c/:slug (SSR, no /api prefix)
  app.use(trustPageRouter);

  // Public key registry
  app.use(publicRouter);

  // API routes
  app.use("/api/v1", healthRouter);
  app.use("/api/v1", authRouter);
  app.use("/api/v1", itemsRouter);
  app.use("/api/v1", certificatesRouter);
  app.use("/api/v1", billingRouter);
  app.use("/api/v1", accountRouter);
  app.use("/api/v1", reportsRouter);
  app.use("/api/v1", scansRouter);

  return app;
}
