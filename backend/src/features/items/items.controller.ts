import type { Request, Response } from "express";
import { handleError, sendSuccess } from "../../utils/http.js";
import {
  listItems,
  createItem,
  getItem,
  updateItem,
  deleteItem,
  signPhotoUpload,
  finalizePhoto,
  deletePhoto,
  issueItem,
} from "./items.service.js";

export async function listItemsController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { status, category, q, cursor } = req.query as Record<string, string>;
    const items = await listItems({ userId, status, category, q, cursor });
    sendSuccess(res, items);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createItemController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const item = await createItem(userId, req.body as Record<string, unknown>);
    sendSuccess(res, item, 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getItemController(req: Request, res: Response): Promise<void> {
  try {
    const item = await getItem(String(req.params.id), req.user!.userId);
    sendSuccess(res, item);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateItemController(req: Request, res: Response): Promise<void> {
  try {
    const item = await updateItem(String(req.params.id), req.user!.userId, req.body as Record<string, unknown>);
    sendSuccess(res, item);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deleteItemController(req: Request, res: Response): Promise<void> {
  try {
    await deleteItem(String(req.params.id), req.user!.userId);
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function signPhotoUploadController(req: Request, res: Response): Promise<void> {
  try {
    const { contentType, filename } = req.body as { contentType: string; filename: string };
    const result = await signPhotoUpload(String(req.params.id), req.user!.userId, contentType, filename);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function finalizePhotoController(req: Request, res: Response): Promise<void> {
  try {
    const { uploadKey, position } = req.body as { uploadKey: string; position: number };
    const photo = await finalizePhoto(String(req.params.id), req.user!.userId, { uploadKey, position });
    sendSuccess(res, photo, 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function deletePhotoController(req: Request, res: Response): Promise<void> {
  try {
    await deletePhoto(String(req.params.id), String(req.params.pid), req.user!.userId);
    sendSuccess(res, { ok: true });
  } catch (err) {
    handleError(res, err);
  }
}

export async function issueController(req: Request, res: Response): Promise<void> {
  try {
    const cert = await issueItem(String(req.params.id), req.user!.userId);
    sendSuccess(res, cert, 201);
  } catch (err) {
    handleError(res, err);
  }
}
