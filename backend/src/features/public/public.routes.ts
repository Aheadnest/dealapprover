import { Router } from "express";
import { getPublicCertController, getPublicKeysController } from "./public.controller.js";

export const publicRouter = Router();

publicRouter.get("/api/v1/public/certificates/:slug", getPublicCertController);
publicRouter.get("/.well-known/dealapprover-keys.json", getPublicKeysController);
