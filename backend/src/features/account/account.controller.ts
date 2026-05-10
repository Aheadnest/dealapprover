import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import { getAccount, updateAccount, exportAccount, scheduleAccountDeletion } from "./account.service.js";

export async function getAccountController(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAccount(req.user!.userId);
    sendSuccess(res, data);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateAccountController(req: Request, res: Response): Promise<void> {
  try {
    const data = await updateAccount(req.user!.userId, req.body as Record<string, unknown>);
    sendSuccess(res, data);
  } catch (err) {
    handleError(res, err);
  }
}

export async function exportAccountController(req: Request, res: Response): Promise<void> {
  try {
    const data = await exportAccount(req.user!.userId);
    res.setHeader("Content-Disposition", 'attachment; filename="dealapprover-export.json"');
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteAccountController(req: Request, res: Response): Promise<void> {
  try {
    await scheduleAccountDeletion(req.user!.userId);
    sendSuccess(res, { ok: true, message: "Account scheduled for deletion in 30 days" });
  } catch (err) {
    handleError(res, err);
  }
}
