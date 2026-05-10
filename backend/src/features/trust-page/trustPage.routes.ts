import { Router } from "express";
import { renderTrustPage } from "./trustPage.controller.js";

export const trustPageRouter = Router();

trustPageRouter.get("/c/:slug", renderTrustPage);
