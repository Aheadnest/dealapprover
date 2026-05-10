import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { listScansController } from "./scans.controller.js";

export const scansRouter = Router();
scansRouter.use(requireAuth);
scansRouter.get("/scans", listScansController);
