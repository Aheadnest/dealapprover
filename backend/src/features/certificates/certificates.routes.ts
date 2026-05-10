import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  getCertificateController,
  revokeCertificateController,
  getQrPngController,
  getQrSvgController,
  getStickerPdfController,
} from "./certificates.controller.js";

export const certificatesRouter = Router();

certificatesRouter.use(requireAuth);

certificatesRouter.get("/certificates/:slug", getCertificateController);
certificatesRouter.post("/certificates/:slug/revoke", revokeCertificateController);
certificatesRouter.get("/certificates/:slug/qr.png", getQrPngController);
certificatesRouter.get("/certificates/:slug/qr.svg", getQrSvgController);
certificatesRouter.get("/certificates/:slug/sticker.pdf", getStickerPdfController);
