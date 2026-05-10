import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  listItemsController,
  createItemController,
  getItemController,
  updateItemController,
  deleteItemController,
  signPhotoUploadController,
  finalizePhotoController,
  deletePhotoController,
  issueController,
} from "./items.controller.js";

export const itemsRouter = Router();

itemsRouter.use(requireAuth);

itemsRouter.get("/items", listItemsController);
itemsRouter.post("/items", createItemController);
itemsRouter.get("/items/:id", getItemController);
itemsRouter.patch("/items/:id", updateItemController);
itemsRouter.delete("/items/:id", deleteItemController);

// Photo management
itemsRouter.post("/items/:id/photos/sign", signPhotoUploadController);
itemsRouter.post("/items/:id/photos", finalizePhotoController);
itemsRouter.delete("/items/:id/photos/:pid", deletePhotoController);

// Issue certificate
itemsRouter.post("/items/:id/issue", issueController);
