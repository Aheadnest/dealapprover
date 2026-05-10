import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { handleError, sendSuccess } from "../../utils/http.js";
import { Errors } from "../../utils/errors.js";

interface CertRow extends RowDataPacket {
  slug: string;
  payload_canonical: string;
  signature: Buffer;
  signing_key_id: string;
  issued_at: string;
  revoked_at: string | null;
}

interface KeyRow extends RowDataPacket {
  id: string;
  algorithm: string;
  public_key: Buffer;
  activated_at: string;
  retired_at: string | null;
  status: string;
}

export async function getPublicCertController(req: Request, res: Response): Promise<void> {
  try {
    const slug = String(req.params.slug);
    const [rows] = await executeQuery<CertRow[]>(
      "SELECT slug, payload_canonical, signature, signing_key_id, issued_at, revoked_at FROM certificates WHERE slug = ?",
      [slug],
    );
    if (!rows.length) throw Errors.notFound("Certificate");

    const cert = rows[0];
    const payload = JSON.parse(cert.payload_canonical) as object;
    const status = cert.revoked_at ? "revoked" : "active";

    sendSuccess(res, {
      slug: cert.slug,
      status,
      payload,
      signature_hex: cert.signature.toString("hex"),
      key_id: cert.signing_key_id,
      issued_at: cert.issued_at,
      revoked_at: cert.revoked_at,
    });
  } catch (err) {
    handleError(res, err);
  }
}

export async function getPublicKeysController(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await executeQuery<KeyRow[]>(
      "SELECT id, algorithm, public_key, activated_at, retired_at, status FROM signing_keys ORDER BY activated_at DESC",
    );

    const keys = rows.map((k) => ({
      id: k.id,
      alg: k.algorithm,
      pub_hex: k.public_key.toString("hex"),
      pub_b64: k.public_key.toString("base64"),
      activated_at: k.activated_at,
      retired_at: k.retired_at,
      status: k.status,
    }));

    res.set("Cache-Control", "public, max-age=300");
    sendSuccess(res, { issuer: "dealapprover.com", keys });
  } catch (err) {
    handleError(res, err);
  }
}
