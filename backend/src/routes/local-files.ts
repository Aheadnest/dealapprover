import { Router } from "express";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { lookup as mimeLookup } from "mime-types";

const STORAGE_DIR = path.join(process.cwd(), "data", "local-s3");

export const localFilesRouter = Router();

// PUT /api/v1/_local/upload/:bucket/*key  — browser uploads raw file body
localFilesRouter.put("/_local/upload/:bucket/*key", async (req, res) => {
  const bucket = String(req.params["bucket"]);
  const key = String((req.params as unknown as Record<string, string>)["key"] ?? "");
  const p = path.join(STORAGE_DIR, bucket, key);
  await mkdir(path.dirname(p), { recursive: true });

  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  await new Promise<void>((resolve, reject) => {
    req.on("end", resolve);
    req.on("error", reject);
  });

  await writeFile(p, Buffer.concat(chunks));
  res.status(200).json({ ok: true });
});

// GET /api/v1/_local/files/:bucket/*key  — serve stored file
localFilesRouter.get("/_local/files/:bucket/*key", async (req, res) => {
  const bucket = String(req.params["bucket"]);
  const key = String((req.params as unknown as Record<string, string>)["key"] ?? "");
  const p = path.join(STORAGE_DIR, bucket, key);
  try {
    const buf = await readFile(p);
    const mime = mimeLookup(path.extname(key)) || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(buf);
  } catch {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "File not found" } });
  }
});
