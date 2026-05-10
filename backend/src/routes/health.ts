import { Router } from "express";
import { mysqlPool } from "../integrations/mysql/pool.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    const conn = await mysqlPool.getConnection();
    conn.release();
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});
