import { randomBytes } from "crypto";
import type { PoolConnection } from "mysql2/promise";

// base56: base62 minus look-alikes (0,O,1,l,I,6,9 removed for extra clarity)
const BASE56_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const SLUG_LENGTH = 11;

function generateSlugCandidate(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  return Array.from(bytes)
    .map((b) => BASE56_ALPHABET[b % BASE56_ALPHABET.length])
    .join("");
}

export async function allocateUniqueSlug(conn: PoolConnection): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlugCandidate();
    const [rows] = await conn.execute(
      "SELECT id FROM certificates WHERE slug = ?",
      [slug],
    );
    if ((rows as unknown[]).length === 0) return slug;
  }
  throw new Error("Failed to allocate unique slug after 5 attempts");
}
