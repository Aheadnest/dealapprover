import type { Request, Response } from "express";
import { handleError, sendSuccess, sendError } from "../../utils/http.js";
import {
  createCheckoutUrl,
  createPortalUrl,
  handleStripeWebhook,
} from "./billing.service.js";

export async function checkoutController(req: Request, res: Response): Promise<void> {
  try {
    const { plan } = req.body as { plan: "pro" | "business" };
    const url = await createCheckoutUrl(req.user!.userId, req.user!.email, plan);
    sendSuccess(res, { url });
  } catch (err) {
    handleError(res, err);
  }
}

export async function portalController(req: Request, res: Response): Promise<void> {
  try {
    const url = await createPortalUrl(req.user!.userId);
    sendSuccess(res, { url });
  } catch (err) {
    handleError(res, err);
  }
}

export async function webhookController(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;
  if (!sig) {
    sendError(res, 400, "MISSING_SIGNATURE", "Missing stripe-signature header");
    return;
  }
  try {
    await handleStripeWebhook(req.body as Buffer, sig);
    sendSuccess(res, { received: true });
  } catch (err) {
    handleError(res, err);
  }
}
