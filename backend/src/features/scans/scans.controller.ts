import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import { listScans } from "./scans.service.js";
import { AppError } from "../../utils/errors.js";

export async function listScansController(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.plan === "free") {
      throw new AppError("PRO_FEATURE", "Scan analytics is a Pro feature", 402);
    }
    const data = await listScans(req.user!.userId);
    sendSuccess(res, data);
  } catch (err) {
    handleError(res, err);
  }
}
