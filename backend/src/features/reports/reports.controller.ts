import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import { createReport } from "./reports.service.js";

export async function createReportController(req: Request, res: Response): Promise<void> {
  try {
    const { certificate_id, kind, message, contact_email } = req.body as {
      certificate_id: string;
      kind: string;
      message: string;
      contact_email?: string;
    };
    await createReport({ certificate_id, kind, message, contact_email });
    sendSuccess(res, { ok: true }, 201);
  } catch (err) {
    handleError(res, err);
  }
}
