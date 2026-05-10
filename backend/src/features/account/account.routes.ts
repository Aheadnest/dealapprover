import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  getAccountController,
  updateAccountController,
  exportAccountController,
  deleteAccountController,
} from "./account.controller.js";

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.get("/account", getAccountController);
accountRouter.patch("/account", updateAccountController);
accountRouter.get("/account/export", exportAccountController);
accountRouter.post("/account/delete", deleteAccountController);
