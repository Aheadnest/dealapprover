import type { Response } from "express";
import { AppError } from "./errors.js";

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }
  console.error("[unhandled error]", err);
  sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}
