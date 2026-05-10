import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import {
  getCertificate,
  revokeCertificate,
  getCertQrUrl,
} from "./certificates.service.js";

export async function getCertificateController(req: Request, res: Response): Promise<void> {
  try {
    const cert = await getCertificate(String(req.params.slug), req.user!.userId);
    sendSuccess(res, cert);
  } catch (err) {
    handleError(res, err);
  }
}

export async function revokeCertificateController(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = req.body as { reason?: string };
    await revokeCertificate(String(req.params.slug), req.user!.userId, reason);
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function getQrPngController(req: Request, res: Response): Promise<void> {
  try {
    const url = await getCertQrUrl(String(req.params.slug), req.user!.userId, "png");
    res.redirect(302, url);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getQrSvgController(req: Request, res: Response): Promise<void> {
  try {
    const url = await getCertQrUrl(String(req.params.slug), req.user!.userId, "svg");
    res.redirect(302, url);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getStickerPdfController(req: Request, res: Response): Promise<void> {
  try {
    const url = await getCertQrUrl(String(req.params.slug), req.user!.userId, "pdf");
    res.redirect(302, url);
  } catch (err) {
    handleError(res, err);
  }
}
