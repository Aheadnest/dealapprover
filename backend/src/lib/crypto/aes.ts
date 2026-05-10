import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  return Buffer.from(env.rootEncKeyHex, "hex");
}

export function encryptField(plaintext: string): Buffer {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: IV (12) | TAG (16) | CIPHERTEXT
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptField(cipherBlob: Buffer): string {
  const key = getMasterKey();
  const iv = cipherBlob.subarray(0, IV_LENGTH);
  const tag = cipherBlob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = cipherBlob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
