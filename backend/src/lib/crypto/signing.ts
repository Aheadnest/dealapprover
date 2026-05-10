import * as ed from "@noble/ed25519";
import { createHash } from "crypto";
import type { RowDataPacket } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { decryptField } from "./aes.js";

// @noble/ed25519 v2.x requires the caller to supply SHA-512.
// We use Node's built-in crypto module.
ed.etc.sha512Sync = (...msgs: Uint8Array[]) => {
  const hash = createHash("sha512");
  for (const msg of msgs) hash.update(msg);
  return new Uint8Array(hash.digest());
};

export interface SigningKey {
  id: string;
  algorithm: string;
  publicKey: Buffer;
  privateKeyRaw: Uint8Array;
  activatedAt: string;
}

interface SigningKeyRow extends RowDataPacket {
  id: string;
  algorithm: string;
  public_key: Buffer;
  private_key_enc: Buffer;
  activated_at: string;
}

let cachedActiveKey: SigningKey | null = null;

export async function loadActiveSigningKey(): Promise<SigningKey> {
  if (cachedActiveKey) return cachedActiveKey;

  const [rows] = await executeQuery<SigningKeyRow[]>(
    "SELECT id, algorithm, public_key, private_key_enc, activated_at FROM signing_keys WHERE status = 'active' LIMIT 1",
  );
  if (!rows.length) throw new Error("No active signing key found. Run the key generation script.");

  const row = rows[0];
  const privateKeyRaw = Buffer.from(decryptField(row.private_key_enc), "hex");

  cachedActiveKey = {
    id: row.id,
    algorithm: row.algorithm,
    publicKey: row.public_key,
    privateKeyRaw: new Uint8Array(privateKeyRaw),
    activatedAt: row.activated_at,
  };
  return cachedActiveKey;
}

export function clearKeyCache(): void {
  cachedActiveKey = null;
}

export function sha256(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

export async function ed25519Sign(
  privateKeyRaw: Uint8Array,
  messageHash: Buffer,
): Promise<Buffer> {
  const sig = await ed.signAsync(messageHash, privateKeyRaw);
  return Buffer.from(sig);
}

export async function ed25519Verify(
  publicKey: Buffer,
  messageHash: Buffer,
  signature: Buffer,
): Promise<boolean> {
  return ed.verifyAsync(signature, messageHash, publicKey);
}
