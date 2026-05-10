import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  checkoutController,
  portalController,
  webhookController,
} from "./billing.controller.js";

export const billingRouter = Router();

billingRouter.post("/billing/webhook", webhookController);
billingRouter.post("/billing/checkout", requireAuth, checkoutController);
billingRouter.post("/billing/portal", requireAuth, portalController);
