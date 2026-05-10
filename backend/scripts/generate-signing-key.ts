// Run with: npx tsx scripts/generate-signing-key.ts [key-id]
// Generates an Ed25519 keypair, wraps the private key with ROOT_ENC_KEY_HEX,
// and inserts it into signing_keys with status='active'.
//
// If an active key already exists, it is retired (status='retired') so the new
// one becomes the sole active key. Old retired keys remain in the table so old
// certificates continue to verify.

import "dotenv/config";
import * as ed from "@noble/ed25519";
import { createHash } from "crypto";
import { mysqlPool } from "../src/integrations/mysql/pool.js";
import { encryptField } from "../src/lib/crypto/aes.js";

ed.etc.sha512Sync = (...msgs) => {
  const h = createHash("sha512");
  for (const m of msgs) h.update(m);
  return h.digest();
};

async function main() {
  const keyId = process.argv[2] ?? `${new Date().getFullYear()}-key-1`;
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const privateHex = Buffer.from(privateKey).toString("hex");
  const encryptedPriv = encryptField(privateHex);

  const conn = await mysqlPool.getConnection();
  try {
    await conn.beginTransaction();

    // Retire any currently active key
    await conn.execute(
      "UPDATE signing_keys SET status = 'retired', retired_at = NOW(3) WHERE status = 'active'",
    );

    await conn.execute(
      `INSERT INTO signing_keys (id, algorithm, public_key, private_key_enc, activated_at, status)
       VALUES (?, 'ed25519', ?, ?, NOW(3), 'active')`,
      [keyId, Buffer.from(publicKey), encryptedPriv],
    );

    await conn.commit();
    console.log(`✓ Signing key '${keyId}' generated and activated.`);
    console.log(`  Public key (hex): ${Buffer.from(publicKey).toString("hex")}`);
    console.log(`  Public key (b64): ${Buffer.from(publicKey).toString("base64")}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await mysqlPool.end();
}

main().catch((err) => {
  console.error("Failed to generate signing key:", err);
  process.exit(1);
});
