import { createHash } from "crypto";
import { mkdir, readFile, writeFile, copyFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { env } from "../../config/env.js";

const STORAGE_DIR = path.join(process.cwd(), "data", "local-s3");

async function filePath(bucket: string, key: string): Promise<string> {
  const p = path.join(STORAGE_DIR, bucket, key);
  await mkdir(path.dirname(p), { recursive: true });
  return p;
}

export async function localPut(bucket: string, key: string, body: Buffer): Promise<void> {
  const p = await filePath(bucket, key);
  await writeFile(p, body);
}

export async function localGet(bucket: string, key: string): Promise<Buffer> {
  const p = path.join(STORAGE_DIR, bucket, key);
  return readFile(p);
}

export async function localCopy(
  srcBucket: string, srcKey: string,
  dstBucket: string, dstKey: string,
): Promise<void> {
  const src = path.join(STORAGE_DIR, srcBucket, srcKey);
  const dst = await filePath(dstBucket, dstKey);
  await copyFile(src, dst);
}

export async function localDelete(bucket: string, key: string): Promise<void> {
  const p = path.join(STORAGE_DIR, bucket, key);
  if (existsSync(p)) await unlink(p);
}

export async function localSha256(bucket: string, key: string): Promise<Buffer> {
  const buf = await localGet(bucket, key);
  return createHash("sha256").update(buf).digest();
}

export function localPutUrl(bucket: string, key: string): string {
  return `${env.apiUrl}/api/v1/_local/upload/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

export function localGetUrl(bucket: string, key: string): string {
  return `${env.apiUrl}/api/v1/_local/files/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}
