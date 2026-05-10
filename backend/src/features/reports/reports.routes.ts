import { Router } from "express";
import { createReportController } from "./reports.controller.js";

export const reportsRouter = Router();

reportsRouter.post("/reports", createReportController);
