import type { Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { getPresignedGetUrl } from "../../integrations/s3/s3.js";
import { env } from "../../config/env.js";

interface CertRow extends RowDataPacket {
  id: string;
  slug: string;
  payload_canonical: string;
  signature: Buffer;
  signing_key_id: string;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

interface PhotoRow extends RowDataPacket {
  s3_key: string;
  position: number;
  width: number;
  height: number;
}

export async function renderTrustPage(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug);

  const [certRows] = await executeQuery<CertRow[]>(
    "SELECT * FROM certificates WHERE slug = ?",
    [slug],
  );

  if (!certRows.length) {
    res.status(404).send(notFoundHtml());
    return;
  }

  const cert = certRows[0];
  const payload = JSON.parse(cert.payload_canonical) as Record<string, unknown>;
  const item = payload["item"] as Record<string, unknown>;
  const sub = payload["sub"] as Record<string, unknown>;

  const ip = String(req.headers["cf-connecting-ip"] ?? req.headers["x-real-ip"] ?? req.ip ?? "");
  const country = String(req.headers["cf-ipcountry"] ?? "");
  const referer = req.headers["referer"];
  setImmediate(() => void logScan(cert.id, ip, country, typeof referer === "string" ? referer : ""));

  const [photoRows] = await executeQuery<PhotoRow[]>(
    "SELECT s3_key, position, width, height FROM item_photos WHERE item_id = (SELECT item_id FROM certificates WHERE slug = ?) ORDER BY position",
    [slug],
  );

  const photoUrls = await Promise.all(
    photoRows.map((p) => getPresignedGetUrl(env.awsS3BucketPhotos, p.s3_key, 86400)),
  );

  const isRevoked = !!cert.revoked_at;
  const title = String(item["title"] ?? "Item");
  const verLevel = String(sub["verification_level"] ?? "L0");
  const displayName = String(sub["display_name"] ?? "Seller");
  const issuedDate = new Date(cert.issued_at).toUTCString();

  const photoCarousel = photoUrls
    .map(
      (url, i) =>
        `<div class="slide${i === 0 ? " active" : ""}"><img src="${escHtml(url)}" alt="Item photo ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" /></div>`,
    )
    .join("");

  const certUrl = `https://dealapprover.com/c/${slug}`;
  const ogImage = photoUrls[0] ?? "";

  const badgeLabel = verLevel === "L2" ? "ID-verified seller" : verLevel === "L1" ? "Verified contact" : "Email-verified seller";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, stale-while-revalidate=60");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} — DealApprover Certificate</title>
  <meta name="description" content="Cryptographically verified item certificate issued by DealApprover." />
  <meta property="og:title" content="${escHtml(title)} — DealApprover" />
  <meta property="og:description" content="Tap to verify this item is real. Issued by ${escHtml(displayName)}." />
  <meta property="og:image" content="${escHtml(ogImage)}" />
  <meta property="og:url" content="${escHtml(certUrl)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
    body{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#f9f9f9;color:#0F172A;min-height:100vh;padding:0 0 40px}
    .container{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e2e2;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);margin-top:24px}
    .banner{padding:14px 20px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;letter-spacing:-0.01em}
    .banner.active{background:#22C55E;color:#fff}
    .banner.revoked{background:#dc2626;color:#fff}
    .banner .dot{width:18px;height:18px;background:rgba(255,255,255,0.25);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
    .carousel{width:100%;aspect-ratio:4/5;overflow:hidden;position:relative;background:#f3f3f4}
    .carousel .slide{display:none;width:100%;height:100%}
    .carousel .slide.active{display:block}
    .carousel img{width:100%;height:100%;object-fit:cover}
    .content{padding:24px 20px}
    h1{font-size:22px;font-weight:700;margin-bottom:4px;color:#0F172A;letter-spacing:-0.02em}
    .meta{color:#76777d;font-size:13px;margin-bottom:20px}
    .attrs{background:#f9f9f9;border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;margin-bottom:20px}
    .attr{display:flex;padding:11px 14px;border-bottom:1px solid #e2e2e2;font-size:13px}
    .attr:last-child{border-bottom:none}
    .attr-label{color:#76777d;width:120px;flex-shrink:0;text-transform:capitalize}
    .attr-value{color:#0F172A;font-weight:500}
    .seller{background:#0F172A;color:#fff;border-radius:10px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px}
    .seller-avatar{width:40px;height:40px;border-radius:50%;background:#22C55E;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;color:#fff}
    .seller-name{font-weight:600;font-size:14px}
    .seller-badge{font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:4px}
    .check{width:12px;height:12px;color:#22C55E}
    .cert-meta{font-size:12px;color:#76777d;margin-bottom:16px;line-height:1.7;background:#f9f9f9;padding:12px 14px;border-radius:8px;border:1px solid #e2e2e2}
    .cert-meta code{font-family:ui-monospace,'SFMono-Regular',monospace;color:#0F172A;background:#fff;padding:1px 6px;border-radius:3px;border:1px solid #e2e2e2;font-size:11px}
    .btn{display:block;text-align:center;padding:11px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;margin-bottom:8px;cursor:pointer;border:none;width:100%;transition:all 0.2s}
    .btn-outline{background:#fff;border:1px solid #c6c6cd;color:#0F172A}
    .btn-outline:hover{border-color:#45464d}
    .footer{text-align:center;font-size:11px;color:#76777d;padding-top:8px}
    .footer a{color:#22C55E;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
<div class="container">
  <div class="banner ${isRevoked ? "revoked" : "active"}">
    <span class="dot">
      ${isRevoked
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`}
    </span>
    ${isRevoked ? "Certificate Revoked" : "Verified Asset · DealApprover Certificate"}
  </div>
  <div class="carousel">${photoCarousel}</div>
  <div class="content">
    <h1>${escHtml(title)}</h1>
    <p class="meta">${escHtml(String(item["brand"] ?? ""))} ${escHtml(String(item["model"] ?? ""))} · ${escHtml(String(item["condition"] ?? "").replace(/_/g, " "))}</p>
    <div class="attrs">
      <div class="attr"><span class="attr-label">Category</span><span class="attr-value">${escHtml(String(item["category"] ?? "").replace(/_/g, " "))}</span></div>
      ${item["extra"] && typeof item["extra"] === "object"
        ? Object.entries(item["extra"] as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `<div class="attr"><span class="attr-label">${escHtml(k.replace(/_/g, " "))}</span><span class="attr-value">${escHtml(String(v))}</span></div>`)
            .join("")
        : ""}
    </div>
    <div class="seller">
      <div class="seller-avatar">${escHtml((displayName[0] ?? "?").toUpperCase())}</div>
      <div>
        <div class="seller-name">${escHtml(displayName)}</div>
        <div class="seller-badge">
          <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${escHtml(badgeLabel)}
        </div>
      </div>
    </div>
    <div class="cert-meta">
      Issued: <strong style="color:#0F172A">${issuedDate}</strong><br/>
      Certificate ID: <code>${escHtml(slug)}</code>
      ${isRevoked ? `<br/><strong>Revoked:</strong> ${cert.revoke_reason ? escHtml(cert.revoke_reason) : "No reason given"}` : ""}
    </div>
    <a href="${escHtml(certUrl)}/report" class="btn btn-outline">Report a concern</a>
    <div class="footer">Powered by <a href="https://dealapprover.com">DealApprover</a></div>
  </div>
</div>
</body>
</html>`);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function notFoundHtml(): string {
  return `<!DOCTYPE html><html><head><title>Not Found — DealApprover</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" /></head>
<body style="font-family:'Inter',sans-serif;text-align:center;padding:80px 20px;background:#f9f9f9;color:#0F172A">
<h1 style="font-size:24px;margin-bottom:8px">Certificate not found</h1>
<p style="color:#76777d;margin-bottom:24px">This certificate does not exist or may have been removed.</p>
<a href="https://dealapprover.com" style="color:#22C55E;font-weight:600;text-decoration:none">Back to DealApprover</a>
</body></html>`;
}

async function logScan(
  certId: string,
  rawIp: string,
  country: string,
  referer: string,
): Promise<void> {
  try {
    const { createHmac } = await import("crypto");
    const dailySalt = new Date().toISOString().slice(0, 10);
    const ipHash = createHmac("sha256", dailySalt).update(rawIp).digest();
    const refererHost = referer ? new URL(referer).hostname : null;
    await executeQuery(
      "INSERT INTO scan_events (certificate_id, at, ip_hash, country_iso2, referer_host) VALUES (?, NOW(3), ?, ?, ?)",
      [certId, ipHash, country || null, refererHost],
    );
  } catch {
    // scan logging is best-effort
  }
}
