# DealApprover — MVP Technical & Product Specification

> Companion to [SPEC.md](SPEC.md) (which scopes the *landing page*).
> This document scopes the **product itself** for an MVP build.
> Audience: founding engineer / first dev team. Treat as the single source of truth until superseded.

---

## 0. Document Purpose

This file answers three questions for anyone starting the MVP:

1. **What** are we building (product surface, screens, scope)?
2. **How** do we build it (architecture, data, APIs, crypto)?
3. **Why** are these the right choices (tradeoffs, risks, alternatives we rejected)?

Anything not in this document is **out of scope for MVP** unless explicitly added later via PR to this file.

---

## 1. Executive Summary

DealApprover issues **tamper-evident, cryptographically signed QR certificates** that bind:

- a **physical item** (photos + structured attributes + serial/IMEI),
- a **verified seller identity** (email/phone for Free, government-ID for Pro),
- an **immutable timestamp** (signed at issuance, anchored optionally on a public log).

When a buyer scans the QR code with any modern phone camera, they land on `https://dealapprover.com/c/<slug>` — a static-fast, mobile-first **Trust Page** showing the certificate and its validity status. **No app, no buyer login.**

**MVP success metric**: 500 verified sellers, 2,000 issued certificates, ≥30% of certificates scanned by ≥1 buyer, in the first 90 days post-launch.

---

## 2. Product Strategy

### 2.1 Value proposition (one line)

> *"Buyers stop hesitating, sellers close deals — because the QR proves it's real, on the spot."*

### 2.2 Differentiators

| vs. | DealApprover advantage |
|----|------------------------|
| Photo-and-receipt screenshots | Cryptographically signed, can't be edited or back-dated |
| Marketplace-internal authentication (StockX, GOAT) | Works *anywhere* — WhatsApp, OLX, in-person, Facebook Marketplace |
| Generic NFT / blockchain "proof of ownership" | Zero buyer friction — no wallet, no app, ~1s scan |
| Manual ID checks | Automated, repeatable, brandable |

### 2.3 What we are NOT (MVP)

- Not an escrow / payments platform.
- Not an authentication *expert* service — we don't physically inspect items.
- Not a marketplace or listing site.
- Not a legal contract / notary (we provide *evidence*, not enforcement).
- Not a wallet / blockchain product (optional anchoring is Phase 3).

These exclusions matter because they bound liability and keep MVP shippable in 8–12 weeks.

---

## 3. Personas & Jobs-to-be-done

### 3.1 Primary persona — *"Marco, the resale enabler"*

- 28, sells 2–10 items / month on OLX, Vinted, Facebook Marketplace.
- Frustrated by buyers who haggle on trust ("how do I know this iPhone isn't stolen?").
- **JTBD**: "When I list an item, I want a one-tap way to prove it's mine and it's real, so the buyer pays asking price and shows up."

### 3.2 Secondary persona — *"Loja do João, the small reseller"*

- Refurbishes phones / laptops, sells 30–100 / month, has a physical store and Instagram.
- **JTBD**: "When I sell a refurbished device, I want a branded certificate the customer can show their family/employer, so my store looks pro and returns drop."

### 3.3 Buyer persona — *"Ana, the cautious buyer"*

- Doesn't sign up, doesn't install apps. Scans the QR once, decides in <30s.
- **JTBD**: "When I'm about to pay for an item, I want a fast independent check that the seller and item are real."

### 3.4 Marketplace partner (Business tier, post-MVP teaser)

- Wants an API to issue certificates on behalf of their sellers.

---

## 4. End-to-end User Journeys

### 4.1 Seller — first certificate (the golden path)

1. Lands on marketing site, clicks "Get Started Free".
2. Signs up with email + password (or Google OAuth).
3. Receives email magic link → verifies email.
4. Onboarding wizard: name, country, phone (optional but unlocks +2 free certs/month).
5. **Create item** form: category → photos (min 3, max 8) → identifiers (serial / IMEI / etc.) → condition → price (optional) → notes.
6. Reviews preview of trust page, clicks **Issue Certificate**.
7. Server signs payload, generates QR + slug, returns success page with: QR (PNG / SVG / PDF), short URL, "share to WhatsApp / copy link".
8. Email confirmation with the same artifacts.

Target time-to-first-certificate (TTFC): **under 4 minutes from landing page click**.

### 4.2 Buyer — verification (the magic moment)

1. Scans QR with native camera → opens `https://dealapprover.com/c/<slug>` in default browser.
2. Trust page renders <1.5s on 4G: header (status), photos carousel, item attributes, seller badge, issued date, "verify signature" expander.
3. CTA: "Report a concern" (anonymous form) or "Contact seller via DealApprover" (proxy email if seller opted-in).
4. Buyer leaves; we log a scan event (privacy-preserving).

### 4.3 Revocation flow

1. Seller hits **Revoke** in dashboard → reason picker (sold / stolen / mistake / other).
2. Status flips to `revoked` immediately; trust page shows red banner.
3. Optional auto-revoke when seller marks item as sold.

### 4.4 Tamper / edit flow

- For MVP, **certificates are frozen on issue**. Editing item details is allowed only on `draft` items.
- To "edit" an issued certificate the seller must **revoke + re-issue** (which counts as a new cert against quota). This is intentional friction that preserves cryptographic integrity.

---

## 5. Functional Scope (MVP — In)

### 5.1 Authentication & Accounts

- Email + password (with bcrypt or argon2id).
- Google OAuth.
- Email verification mandatory before issuing certificates.
- Password reset via signed token (15-min TTL, single use).
- Session: HttpOnly Secure SameSite=Lax cookie, sliding 14-day expiry.
- Optional 2FA via TOTP (post-MVP nice-to-have, scope it but ship in v1.1).

### 5.2 Seller verification tiers

| Tier | Requirement | Badge on trust page |
|------|-------------|---------------------|
| L0 | Email verified | "Email-verified seller" |
| L1 | Email + phone (SMS code) | "Verified contact" |
| L2 (Pro) | Government-ID via Stripe Identity | "ID-verified seller" (gold) |

### 5.3 Item registration

- Categories (MVP set, see §12.1).
- Photos: 3–8 images, JPEG/PNG/HEIC, max 10 MB each, min 800×800.
- EXIF stripped server-side (privacy + tamper hygiene).
- Per-category required fields (e.g. `imei` for phones, `gtin` for sealed retail boxes).
- Free-text title + description (max 1000 chars).
- Condition (`new`, `like_new`, `good`, `fair`).
- Optional asking price + currency (informational only, no escrow).

### 5.4 Certificate issuance

- One click from a *complete* draft item.
- Costs 1 of monthly quota for Free; unlimited on Pro.
- Returns: slug URL, QR PNG (1024×1024), QR SVG, branded PDF (A6, print-ready).

### 5.5 Trust page (`/c/<slug>`)

- Server-rendered, cached at edge with stale-while-revalidate.
- Sections: status banner, photo carousel, attributes table, seller card, issuance metadata, "Verify signature" disclosure, report form.
- Open Graph + oEmbed for great WhatsApp/iMessage previews.
- Accessible (WCAG 2.1 AA target).

### 5.6 Dashboard (seller-facing)

- `/app/items` — list, filter by status, search by serial/title.
- `/app/items/new` — wizard.
- `/app/items/:id` — detail + revoke + scans timeline.
- `/app/account` — profile, plan, billing.
- `/app/scans` — basic analytics (Pro only).

### 5.7 Plans & billing

- Free / Pro ($9.99) / Business ($29.99) per landing page.
- Stripe Checkout for upgrade.
- Stripe Customer Portal for plan changes & cancellation.
- Webhook-driven subscription state.
- Quota enforcement: monthly counter resets on UTC 1st.

### 5.8 Notifications

- Transactional emails (Resend or Postmark).
- Templates: welcome, email verification, certificate issued, certificate revoked, monthly summary, billing receipts.
- No marketing emails in MVP.

### 5.9 Out of scope for MVP (explicit no's)

- Native mobile apps.
- Blockchain anchoring.
- Public certificate marketplace / search.
- Bulk CSV upload (Business teaser only).
- Custom domains (white-label).
- API access (private beta only).
- Multi-tenant teams / role permissions.
- NFC stickers.
- Push notifications.

---

## 6. Information Architecture

```
dealapprover.com/                       (marketing — already built)
dealapprover.com/login
dealapprover.com/signup
dealapprover.com/forgot-password
dealapprover.com/c/<slug>               (PUBLIC trust page)
dealapprover.com/r/<slug>               (short-link redirect, optional)
dealapprover.com/.well-known/dealapprover-keys.json   (public-key registry)
dealapprover.com/app                    (gated dashboard)
dealapprover.com/app/items
dealapprover.com/app/items/new
dealapprover.com/app/items/:id
dealapprover.com/app/account
dealapprover.com/app/billing
dealapprover.com/app/scans
api.dealapprover.com/v1/...             (or /api/v1 same origin — see §7.2)
```

---

## 7. Technical Architecture

### 7.1 Stack recommendation (and why)

| Layer | Choice | Rationale | Alternative considered |
|------|--------|-----------|------------------------|
| Frontend dashboard (SPA) | **Vite + React + TypeScript** | Same stack as macedov2; static build deployed on Cloudflare Pages | Next.js — overkill for SPA dashboard |
| Trust page (`/c/:slug`) | **SSR by Express BE** (HTML template) | Needs SEO + OG meta for WhatsApp previews; BE already has all cert data | SPA client-fetch — worse TTFB, bad OG |
| FE hosting | **Cloudflare Pages** | Fast edge CDN, free, existing CF familiarity | Vercel |
| Backend | **Express 5 + TypeScript** (same as macedov2) | Proven pattern in the repo; Node.js 20-alpine Docker | Hono, Fastify |
| BE hosting | **VPS — Docker on Linux** | Cost-effective for low-traffic MVP; full control | Managed container service |
| Database | **MySQL 8** — Docker on VPS | Already used in macedov2 (`mysql2`); reliable, familiar | Postgres — fine but adds migration cost from existing pattern |
| Object storage | **AWS S3** | Standard, presigned URLs, SDK already in macedov2 (`@aws-sdk/client-s3`) | Cloudflare R2 — also fine but adds CF vendor lock-in |
| Auth | **JWT** via `jose` + `jsonwebtoken` (same as macedov2) | Stateless, already solved in the existing repo | Auth.js — extra dependency |
| Payments | **Stripe** | Industry standard, Identity add-on for L2 verification | — |
| Email | **Resend** | Great DX, React Email templates, EU region available | Postmark |
| QR rendering | **`qrcode` (npm)** server-side | Mature, generates PNG/SVG | — |
| Crypto | **Node.js `crypto` module + `@noble/ed25519`** | Audited, zero-dep, runs in Node 20 | `tweetnacl` |
| Image processing | **`sharp`** | Best-in-class for Node; strips EXIF, generates thumbnails | — |
| Captcha | **Cloudflare Turnstile** | Free, no privacy issues, CF already used for FE | hCaptcha |
| ID verification | **Stripe Identity** | Bundles with billing customer; ~$1.50/check | Persona, Veriff |
| Observability | **Sentry + PostHog** | Errors + product analytics | — |
| Background jobs | **`node-cron`** in BE container | Zero extra infra for MVP; simple recurring jobs | BullMQ (add if job volume grows) |
| Reverse proxy / TLS | **Nginx + Let's Encrypt (Certbot)** on VPS | Same as any standard VPS setup | Caddy (simpler config, alternative) |

### 7.2 Service map

```
  ┌──────────────────────────────────────────────────────┐
  │  Cloudflare Pages (static CDN)                        │
  │  Vite + React SPA  ──►  CF edge cache                │
  │  dealapprover.com (landing + app dashboard)           │
  └───────────────────────────┬──────────────────────────┘
                              │  HTTPS (CF proxied)
  ┌───────────────────────────▼──────────────────────────┐
  │  VPS  (Ubuntu LTS, Docker)                            │
  │                                                       │
  │  ┌────────────────────────────────────────────┐      │
  │  │  Nginx (443 → TLS, Let's Encrypt)           │      │
  │  │  /api/*  →  proxy_pass :3005               │      │
  │  │  /c/:slug → proxy_pass :3005 (SSR)         │      │
  │  └────────────────┬───────────────────────────┘      │
  │                   │                                   │
  │  ┌────────────────▼───────────────────────────┐      │
  │  │  Express 5 + TypeScript  (port 3005)        │      │
  │  │  - REST API  /api/v1/*                      │      │
  │  │  - Trust page SSR  /c/:slug                 │      │
  │  │  - Background jobs (node-cron)              │      │
  │  └──────────┬──────────────────────────────────┘      │
  │             │                                         │
  │  ┌──────────▼──────┐                                  │
  │  │  MySQL 8         │  (Docker, port 3306 local)       │
  │  └─────────────────┘                                  │
  └───────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────▼──┐   ┌───────▼───┐   ┌──────▼──┐
       │  AWS S3  │   │  Stripe   │   │  Resend  │
       │ (photos, │   │ + Identity│   │  (email) │
       │  QR PDFs)│   └───────────┘   └─────────┘
       └──────────┘
```

### 7.3 Environments

| Env | FE | BE / DB | S3 bucket | Stripe |
|----|-----|---------|-----------|--------|
| dev (local) | `localhost:5173` (Vite) | `localhost:3005` (Docker Compose) | `da-dev` | test mode |
| staging | CF Pages preview branch | VPS staging container (port 3006) | `da-staging` | test mode |
| prod | CF Pages `main` | VPS prod container (port 3005) | `da-prod` | live mode |

### 7.4 Docker Compose (VPS)

Same pattern as macedov2 — `config/docker-compose.yml` on VPS:

```yaml
services:
  backend:
    image: ghcr.io/${REPO_LOWER}/backend:${TAG}
    container_name: dealapprover-backend
    restart: unless-stopped
    env_file: ../.env
    ports:
      - "127.0.0.1:3005:3005"
    depends_on:
      - db
    networks:
      - app-net

  db:
    image: mysql:8.0
    container_name: dealapprover-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: dealapprover
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"
    networks:
      - app-net

networks:
  app-net:
    driver: bridge

volumes:
  db-data:
```

### 7.5 Secrets

Secrets in `.env` on VPS (not in repo). Nginx terminates TLS; backend binds to `127.0.0.1` only. Key secrets: `JWT_SECRET`, `ROOT_ENC_KEY_HEX`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `RESEND_API_KEY`. Rotation playbook in `docs/runbooks/secrets.md`.

---

## 8. Data Model

**MySQL 8** (Docker on VPS). Types are MySQL-native. UUIDs stored as `CHAR(36)`. All tables have `created_at DATETIME(3)`, `updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL` (soft delete). All `DATETIME` fields stored in UTC. `JSON` type available in MySQL 8.0+. Binary data (`sha256`, `signature`) stored as `VARBINARY(64)` or `BLOB`.

> Note: MySQL does not have `RETURNING` — use `lastInsertId` or a subsequent `SELECT`. No `GENERATED` columns needed — compute `status` in application code.

### 8.1 `users`

| col | type | notes |
|----|------|-------|
| id | CHAR(36) pk | UUID v4 |
| email | VARCHAR(255) unique | `COLLATE utf8mb4_unicode_ci` for case-insensitive |
| email_verified_at | DATETIME(3) null | |
| password_hash | VARCHAR(255) null | null if OAuth-only; argon2id |
| phone_e164 | VARCHAR(20) null | |
| phone_verified_at | DATETIME(3) null | |
| display_name | VARCHAR(255) | |
| locale | VARCHAR(8) default 'en' | |
| country_iso2 | CHAR(2) null | |
| stripe_customer_id | VARCHAR(64) null unique | |
| identity_verification_id | VARCHAR(128) null | Stripe Identity session id |
| identity_verified_at | DATETIME(3) null | |
| plan | ENUM('free','pro','business') default 'free' | |
| plan_status | ENUM('active','past_due','canceled') default 'active' | |
| plan_renews_at | DATETIME(3) null | |
| quota_period_start | DATE | for free-tier monthly quota |
| quota_used | INT default 0 | |

### 8.2 `oauth_accounts`

`(provider, provider_account_id)` unique, FK to `users`.

### 8.3 `items`

| col | type | notes |
|----|------|-------|
| id | CHAR(36) pk | |
| user_id | CHAR(36) fk | |
| category | VARCHAR(64) | enum value, see §12.1 |
| title | VARCHAR(255) | |
| brand | VARCHAR(128) null | |
| model | VARCHAR(128) null | |
| serial_number_enc | BLOB null | AES-256-GCM encrypted at rest (see §11.6) |
| serial_number_hash | VARBINARY(32) null | SHA-256 of normalized SN, for dedup |
| imei_enc | BLOB null | phones only |
| gtin | VARCHAR(14) null | EAN/UPC, plain |
| condition | ENUM('new','like_new','good','fair') | |
| description | TEXT | |
| price_minor | INT null | |
| currency | CHAR(3) null | ISO 4217 |
| extra | JSON | category-specific fields; default `'{}'` |
| status | ENUM('draft','active','revoked') | managed in app code |

### 8.4 `item_photos`

| col | type | notes |
|----|------|-------|
| id | CHAR(36) pk | |
| item_id | CHAR(36) fk | |
| position | TINYINT | 0..7 |
| s3_key | VARCHAR(512) | S3 object key (content-addressed) |
| thumb_s3_key | VARCHAR(512) | |
| sha256 | VARBINARY(32) | full-image SHA-256, included in cert payload |
| width | INT | |
| height | INT | |
| bytes | INT | |

### 8.5 `certificates`

| col | type | notes |
|----|------|-------|
| id | CHAR(36) pk | |
| slug | VARCHAR(16) unique | base62, len 11 (≈65 bits entropy) |
| item_id | CHAR(36) fk | |
| user_id | CHAR(36) fk | denormalized for fast lookup |
| version | INT default 1 | bumps on re-issue |
| signing_key_id | VARCHAR(64) fk | |
| payload_canonical | JSON | the *exact* signed object |
| payload_sha256 | VARBINARY(32) | |
| signature | VARBINARY(64) | Ed25519, 64 bytes |
| issued_at | DATETIME(3) | |
| revoked_at | DATETIME(3) null | |
| revoke_reason | VARCHAR(255) null | |
| qr_s3_key | VARCHAR(512) | rendered PNG on S3 |
| pdf_s3_key | VARCHAR(512) null | |

Derived status in app code: `revoked_at IS NOT NULL ? 'revoked' : 'active'`.

Indexes: `(slug)` unique, `(user_id, revoked_at)`, `(item_id, version)`.

### 8.6 `signing_keys`

| col | type | notes |
|----|------|-------|
| id | VARCHAR(64) pk | e.g. `2026-key-1` |
| algorithm | VARCHAR(32) | `ed25519` |
| public_key | VARBINARY(32) | published in well-known |
| private_key_enc | BLOB | AES-GCM wrapped with `ROOT_ENC_KEY_HEX` from env |
| activated_at | DATETIME(3) | |
| retired_at | DATETIME(3) null | |
| status | ENUM('active','retired','compromised') | |

Only **one** key with `status='active'` at any time. Old keys remain published forever for verification.

### 8.7 `scan_events`

Append-only. Privacy-preserving.

| col | type | notes |
|----|------|-------|
| id | BIGINT AUTO_INCREMENT pk | |
| certificate_id | CHAR(36) fk | |
| at | DATETIME(3) | |
| ip_hash | VARBINARY(32) | HMAC(daily-salt, ip) — rotates daily |
| country_iso2 | CHAR(2) null | from `CF-IPCountry` header (CF proxy) or GeoIP lookup |
| user_agent_family | VARCHAR(128) null | parsed, no full UA |
| referer_host | VARCHAR(255) null | |

### 8.8 `audit_log`

Append-only. `(actor_user_id CHAR(36), action VARCHAR(128), resource_type VARCHAR(64), resource_id CHAR(36), metadata JSON, ip_hash VARBINARY(32), at DATETIME(3))`.

### 8.9 `webhook_events` (Stripe)

`(provider VARCHAR(32), event_id VARCHAR(128) unique, type VARCHAR(128), payload JSON, received_at DATETIME(3), processed_at DATETIME(3) null)` — idempotency.

### 8.10 `reports`

`(id CHAR(36) pk, certificate_id CHAR(36) fk, kind VARCHAR(64), message TEXT, contact_email VARCHAR(255), status ENUM('open','resolved','dismissed'), at DATETIME(3))`.

---

## 9. API Design

REST + JSON. Versioned at `/api/v1`. All authenticated endpoints require a **JWT Bearer token** (same pattern as macedov2, using `jose`). Short-lived access token (15min) + refresh token (14d, HttpOnly cookie). PAT for Business API access post-MVP.

### 9.1 Auth

```
POST   /api/v1/auth/signup            { email, password, locale }
POST   /api/v1/auth/login             { email, password }
POST   /api/v1/auth/logout
POST   /api/v1/auth/verify-email      { token }
POST   /api/v1/auth/forgot-password   { email }
POST   /api/v1/auth/reset-password    { token, password }
GET    /api/v1/auth/oauth/:provider/start
GET    /api/v1/auth/oauth/:provider/callback
POST   /api/v1/auth/phone/start       { phone_e164 }    → SMS code
POST   /api/v1/auth/phone/verify      { code }
POST   /api/v1/auth/identity/start    → Stripe Identity URL
```

### 9.2 Items

```
GET    /api/v1/items                  ?status=&category=&q=&cursor=
POST   /api/v1/items                  draft create
GET    /api/v1/items/:id
PATCH  /api/v1/items/:id              draft only
DELETE /api/v1/items/:id              soft delete; blocked if cert active
POST   /api/v1/items/:id/photos/sign  → presigned PUT URL for S3
POST   /api/v1/items/:id/photos       finalize after upload (sends sha256, dimensions)
DELETE /api/v1/items/:id/photos/:pid
POST   /api/v1/items/:id/issue        → creates certificate
```

### 9.3 Certificates

```
GET    /api/v1/certificates/:slug             owner-only full data
POST   /api/v1/certificates/:slug/revoke      { reason }
GET    /api/v1/certificates/:slug/qr.png      redirects to S3 presigned URL
GET    /api/v1/certificates/:slug/qr.svg
GET    /api/v1/certificates/:slug/sticker.pdf

# PUBLIC (no auth)
GET    /api/v1/public/certificates/:slug      payload + signature + key id
GET    /.well-known/dealapprover-keys.json    public keys, all versions
```

### 9.4 Public trust page

`GET /c/:slug` — server-rendered HTML page (not in `/api`).

### 9.5 Billing

```
POST   /api/v1/billing/checkout       { plan }   → Stripe Checkout URL
POST   /api/v1/billing/portal         → Stripe Customer Portal URL
POST   /api/v1/billing/webhook        Stripe event handler (HMAC-verified)
```

### 9.6 Errors

Uniform shape:

```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "...", "details": {} } }
```

Codes are stable contracts (UPPER_SNAKE), HTTP status follows convention.

### 9.7 Rate limiting (`express-rate-limit`, same as macedov2)

| Endpoint | Limit |
|---------|-------|
| `/auth/login` | 5 / 15min / IP+email |
| `/auth/signup` | 3 / hour / IP |
| `/items POST` | 20 / day / user |
| `/items/:id/issue` | 10 / hour / user |
| `/c/:slug` (public trust page SSR) | 120 / min / IP (Nginx also caches) |
| webhook | none (HMAC-gated) |

---

## 10. Certificate Generation Pipeline (DEEP DIVE)

This is the **product's core IP**. Get this right and everything else is replaceable.

### 10.1 Goals

1. **Determinism** — same input → same payload bytes → same signature.
2. **Tamper-evidence** — any change to item or photos invalidates verification.
3. **Verifiability without DealApprover** — anyone with the public key can verify the signature offline (no API roundtrip needed).
4. **Forward compatibility** — payload schema can evolve; old certs still verify.
5. **Compactness** — payload small enough that the *hash* could one day be embedded directly in the QR code (Phase 3 offline-verify mode).

### 10.2 Canonical payload

Stable fields, lexicographic key order, no whitespace. We use **JCS (RFC 8785)** for canonical JSON to avoid bespoke serialization bugs.

```json
{
  "v": 1,
  "id": "cert_01HZX...",
  "slug": "k7Qm2pX9aB4",
  "iss": "dealapprover.com",
  "sub": {
    "user_id": "usr_01HZ...",
    "verification_level": "L1",
    "display_name": "Marco S."
  },
  "item": {
    "category": "phone",
    "title": "iPhone 14 Pro 256GB",
    "brand": "Apple",
    "model": "A2890",
    "condition": "like_new",
    "imei_sha256": "8a3f...",
    "serial_sha256": "5d12...",
    "extra": { "color": "deep purple", "battery_health_pct": 92 }
  },
  "photos": [
    { "i": 0, "sha256": "1a2b..." },
    { "i": 1, "sha256": "3c4d..." }
  ],
  "issued_at": "2026-05-09T10:11:12Z",
  "key_id": "2026-key-1"
}
```

Notes:
- `imei` and `serial` are **hashed**, not stored plaintext in the public payload (privacy + theft-recovery without leaking SN to crawlers). We can prove a match later by re-hashing the buyer's input.
- `sub.display_name` is the name shown publicly; PII like full legal name only stored server-side.
- `extra` is a category-typed sub-object validated against a JSON Schema (see §12).

### 10.3 Hash & sign

```
canonical_bytes = JCS(payload)         # RFC 8785
payload_sha256  = SHA-256(canonical_bytes)
signature       = Ed25519.sign(active_private_key, payload_sha256)   # 64 bytes
```

We sign the **hash**, not the bytes, so the same primitive composes with future detached-hash flows (e.g. anchoring on a transparency log).

We chose **Ed25519** because:
- 32-byte public keys, 64-byte signatures (compact).
- No randomness required at sign time → fewer side-channel pitfalls.
- Available in Node.js `crypto` module (since v15) and `@noble/ed25519`.
- Strong defaults; no curve / parameter choices to get wrong.

Rejected: RSA-2048 (signatures too large), ECDSA-P256 (needs nonce, deterministic-ECDSA RFC 6979 less ubiquitous than Ed25519 today).

### 10.4 QR code encoding

QR encodes the **URL** only — *not* the payload — for MVP:

```
https://dealapprover.com/c/k7Qm2pX9aB4
```

Why URL-only:
- Smallest QR (Version 3, ~30×30 modules) → robust, scannable from across a table.
- Buyers always get the latest status (revoked? scanned-from-this-IP?).
- Works with every native camera scanner.

Future (Phase 3): publish a self-contained QR that embeds `slug + payload_hash + signature` so verification works offline (~1.2 KB → QR Version ~20).

### 10.5 Slug generation

- Alphabet: base62 minus look-alikes (`0/O/1/l/I` removed) → 56 symbols.
- Length: 11 chars → ~63.5 bits entropy → collision probability negligible at 10⁹ certs.
- Generated via CSPRNG. Insert with `ON CONFLICT` retry once.
- Stored in DB and indexed; no DB scan happens — it's a primary lookup.

### 10.6 Render pipeline

On `/items/:id/issue`:

1. Validate item is complete + user has quota.
2. Re-hash all photos by streaming from S3 (defense vs. mid-flight swap; see §11.5).
3. Build canonical payload.
4. Sign.
5. Persist `certificates` row in a MySQL transaction with quota decrement.
6. Return response immediately (slug + URL).
7. Fire-and-forget async render (in-process `setImmediate` or `node-cron` job queue): generate QR PNG (1024×1024, ECC level Q), SVG, PDF (Pro only).
8. Upload renders to S3; update row with S3 keys.
9. Send confirmation email.

Steps 1–6 are synchronous and must complete in <500ms p95. Renders (7–9) are best-effort; the trust page URL is live immediately.

### 10.7 Re-issue (after revoke)

- Same `item_id`, new `certificates` row, `version = previous + 1`.
- Old slug stays in DB but trust page shows revoked banner with "see latest" link.
- Counts as 1 against quota.

### 10.8 Verification (third-party)

A buyer (or auditor) can verify *without* trusting our server:

```
1. GET /api/v1/public/certificates/:slug
   → { payload, signature_hex, key_id, status }
2. GET /.well-known/dealapprover-keys.json
   → { keys: [{ id, public_key_hex, ... }] }
3. Compute SHA-256 of JCS(payload).
4. Verify Ed25519(public_key, hash, signature).
5. Check payload.iss == "dealapprover.com" and key_id was active at issued_at.
6. Compare payload photo hashes against the photos shown on the trust page.
```

We will publish a tiny open-source verifier (TypeScript + Python, ~50 LOC each) post-MVP to make this trivially auditable.

---

## 11. Cryptography & Integrity (DEEP DIVE)

### 11.1 Threat model

Adversaries we care about:

| Adversary | Capability | Mitigation |
|-----------|-----------|------------|
| Counterfeit seller | Wants to attach our cert to a different item | Item attributes + photo hashes baked into signed payload; re-using QR for another item is detectable on visual inspection (photos won't match) |
| Modifier | Edits item record after issuance | Issuance freezes payload; any edit ≡ re-issue (= new slug); old cert remains as the signed historical record |
| QR cloner | Photographs our QR and prints it on another item | Trust page still shows our photos & seller — visually mismatching with the actual item; report flow + revocation |
| Site MITM | Tampers with trust page in flight | HSTS, HTTPS-only, signed payload accessible via API for offline check |
| DB exfil attacker | Steals DB | Serial/IMEI encrypted at rest; passwords argon2id; signing private key in Workers Secret, not DB |
| Compromised signing key | Signs fraudulent certs | Key rotation playbook; mark `signing_keys.status='compromised'`; mass-revoke list |
| Insider | Internal admin issues fake cert | Audit log + 4-eyes review for admin-issued certs (post-MVP) |

### 11.2 Algorithms

| Use | Algorithm |
|----|-----------|
| Certificate signing | Ed25519 |
| Password hashing | argon2id (m=64 MiB, t=3, p=1) |
| Serial / IMEI at rest | AES-256-GCM with per-row IV; key derived from a master key in Workers Secret |
| Reset / verification tokens | 256-bit CSPRNG, stored hashed (SHA-256) with TTL |
| Webhook verification | HMAC-SHA-256 (Stripe-supplied) |
| Photo identity | SHA-256 of full bytes (post-EXIF-strip) |
| IP hashing | HMAC-SHA-256(daily_salt, ip), salt rotates daily |

No bespoke crypto. Every primitive is library-provided.

### 11.3 Key management

- **Master key** → `ROOT_ENC_KEY_HEX` in `.env` on VPS (never in repo). Used to wrap signing private keys & encrypt SN/IMEI columns.
- **Signing keypair** → generated locally during a controlled ceremony, private key wrapped with master key and stored in `signing_keys.private_key_enc`. Public key duplicated to the well-known JSON file at deploy time.
- **Rotation policy** → annual scheduled rotation; emergency rotation playbook on compromise. Old keys retire (`status='retired'`) but remain published — old certs must continue to verify forever.
- **Backup** → encrypted backup of master + signing keys held offline by founder(s). Shamir secret-sharing optional post-MVP.

### 11.4 Public-key registry

`/.well-known/dealapprover-keys.json`:

```json
{
  "issuer": "dealapprover.com",
  "keys": [
    {
      "id": "2026-key-1",
      "alg": "Ed25519",
      "pub_b64": "...",
      "activated_at": "2026-04-01T00:00:00Z",
      "retired_at": null,
      "status": "active"
    }
  ]
}
```

Cached at edge for 5 minutes; users of the verifier should fetch on each verification.

### 11.5 Photo integrity

Race risk: between client uploading a photo and server hashing/signing, a malicious client could swap the bytes (uploading photo A, getting it accepted, then rewriting R2 object for photo B before issuance).

Mitigation:

- After upload, **server reads the object back from S3 and computes the SHA-256**. The hash returned by the client is treated as advisory.
- The S3 object is then **copied to a content-addressed key** (`photos/<sha256>.jpg`) and the original temp key deleted. Object ACL is private; no overwrite needed (content-addressed = immutable by design).
- Items reference photos by content-addressed key, so any later swap attempt results in a different hash → different key → different object.
- At issuance time, hashes are **re-verified** by streaming from S3 once more.

### 11.6 Serial / IMEI handling

Two-column pattern:

- `serial_number_enc` — AES-GCM ciphertext, used for displaying back to the **owner only**.
- `serial_number_hash` — SHA-256 of *normalized* (uppercase, alnum-only) SN, used for:
  - dedup check ("you've already certified this device"),
  - cross-seller fraud signal ("two different users certified the same SN"),
  - inclusion in signed payload (without leaking the SN itself).

This lets us answer "is SN X already certified?" without ever revealing SNs to attackers who breach the DB.

### 11.7 Optional: transparency log (Phase 2)

Append every signed `payload_sha256` + `signature` to a Merkle-tree log (homegrown or use a public CT-style log). Publish daily root. Buyers can verify the cert was issued at-or-before a public timestamp. Adds tamper-resistance against insider back-dating.

Not in MVP, but data model already supports it — we just append and publish.

---

## 12. Item-Type Validation Framework (DEEP DIVE)

The hardest product question is *"how much should we trust the seller's input?"*. Different item categories have different signals available. We codify this in a **per-category validator** with explicit confidence levels.

### 12.1 Category taxonomy (MVP)

| Category | MVP? | Required identifiers | Optional | External validators |
|---------|------|---------------------|----------|---------------------|
| `phone` | ✅ | IMEI (15 digits, Luhn-checked), brand, model | color, storage, battery health % | IMEI Luhn check; GSMA TAC lookup (paid, post-MVP) |
| `laptop` | ✅ | serial number, brand, model | year, specs | brand-specific format regex (Apple SN 12-char, Dell 7-char, etc.) |
| `tablet` | ✅ | serial / IMEI, brand, model | — | as phone |
| `watch_luxury` | ✅ | serial number, brand, model, ref_no | year, papers (yes/no) | format regex per brand |
| `handbag_luxury` | ✅ | brand, model, color | date code, serial | photo-required: date-code close-up |
| `sneaker` | ✅ | brand, model, size, colorway | SKU (style-color) | SKU regex per brand |
| `trading_card` | ⚠️ flag-gated | game (Pokémon/MTG/etc), set, name, language | grade, cert id (PSA/BGS) | PSA cert-id lookup (free) |
| `electronics_other` | ✅ | brand, model | serial | — |
| `other` | ✅ | title, description | — | none — lowest confidence |

Each category has a **JSON Schema** stored in code (`src/categories/<key>/schema.json`) consumed by both the form (Zod-derived) and the API validator. Single source of truth.

### 12.2 Per-category required photos

| Category | Required photo subjects |
|---------|------------------------|
| phone | front screen on (showing IMEI screen `*#06#` or About menu), back, original box if has, IMEI matches text input |
| laptop | bottom (SN sticker), open with screen on, ports |
| watch | dial, case-back (SN), crown/buckle, papers if claimed |
| handbag | full front, date-code close-up, hardware close-up, interior label |
| sneaker | top-down pair, sole, tongue-tag (size/SKU), heel |
| trading_card | front, back, cert close-up if graded |

The form **enforces** these subjects via labelled photo slots; the user can't issue without filling each slot. This is by far the most valuable anti-fraud lever in MVP — a counterfeiter has to produce convincing physical photos in specific angles.

### 12.3 Validator pipeline

```
input → format check → checksum → external lookup (if available) → confidence score
```

Examples:

**IMEI validator**

1. Strip non-digits.
2. Length must be 15.
3. **Luhn check** (last digit is the checksum). Reject on fail.
4. First 8 digits = TAC (Type Allocation Code) → optionally GSMA lookup confirms brand+model claimed by seller (Phase 2; the GSMA API is paid, ~€0.05/call).
5. Hash & store; never display in clear on trust page.

**Apple serial validator**

1. Length 10 or 12 (post-2010 vs newer randomized).
2. No `O`, `I`, `1`, `0` in positions where Apple disallows them (older format).
3. Optional: hit `checkcoverage.apple.com` (officially deprecated; use only via Apple's MFI tools). For MVP: format-only, no live lookup.

**PSA card cert validator**

1. Cert id is 8-9 digit numeric.
2. Hit PSA's public lookup endpoint to fetch the official card title/grade.
3. If matches seller's input → confidence boost. If mismatch → block issuance with explainer.

### 12.4 Confidence levels (shown on trust page)

| Level | Criteria | Badge |
|------|---------|-------|
| **Standard** | Required photos + structured fields validated by format/checksum | gray "Verified by DealApprover" |
| **Enhanced** | Above + external registry confirmed (e.g. GSMA, PSA) | blue "Registry-confirmed" |
| **Premium** | Enhanced + L2 ID-verified seller + zero prior reports | gold "Premium-verified" |

Confidence is set at issuance and stored in the certificate payload (`item.confidence`). It cannot be retroactively raised without re-issue.

### 12.5 Fraud signals & blocks

We **block issuance** (not just warn) if any of:

- IMEI/SN matches one already certified by a *different* user with an `active` certificate within 60 days. (We surface a contact channel — could be a legit ownership transfer that we'll handle manually for MVP.)
- IMEI/SN matches a known stolen-devices list (CheckMEND-equivalent feed; Phase 2 — for MVP we just record a flag).
- More than N free certs/IP/day (anti-farming).
- User account has ≥3 unresolved buyer reports.

We **warn but allow** if:

- Photo EXIF (before strip) shows GPS location far from seller's claimed country.
- Two photos are byte-identical (likely uploaded same image twice).

### 12.6 Prohibited categories (terms of service)

Hard-blocked at the category step:

- Firearms / ammunition
- Drugs (prescription or otherwise)
- Live animals
- Currency / financial instruments
- Adult content
- Anything restricted by the seller's local jurisdiction (best-effort country check)

A list lives in `src/categories/prohibited.ts` and is validated server-side regardless of UI.

---

## 13. Anti-abuse & Anti-fraud

| Layer | Control |
|------|---------|
| Signup | Turnstile, email verification, disposable-email blocklist |
| Auth | Login throttling, exponential backoff, breached-password check (HIBP k-anonymity) |
| Photo upload | Server-side EXIF strip, MIME sniffing, size + dimension limits, perceptual-hash dedup against a small known-bad set (e.g. recurring scam photos) — Phase 2 |
| Certificate issue | Quota, per-user/IP rate limits, fraud signals (§12.5) |
| Trust page | Public scan rate limit; abuse report form; Cloudflare Bot Management |
| Account-level | Auto-suspend on 3+ confirmed reports; email appeal flow |

Manual ops (MVP): a `/admin` route gated by allow-listed emails for: viewing reports, suspending accounts, mass-revoking certs by signing key id, exporting audit logs. Full admin tooling later.

---

## 14. Trust Page (UX & SEO)

### 14.1 Layout (mobile-first)

```
┌───────────────────────────────────┐
│ status banner (green / red)        │
├───────────────────────────────────┤
│ photo carousel (swipeable, 4:5)    │
├───────────────────────────────────┤
│ Item title                         │
│ Brand · Model · Condition          │
│ Asking price (optional)            │
├───────────────────────────────────┤
│ Attributes table                   │
│  — IMEI: ••• 4321 (last-4 only)    │
│  — Storage: 256 GB                 │
│  — Color: Deep Purple              │
├───────────────────────────────────┤
│ Seller card                        │
│  avatar  Marco S.                  │
│          ✓ ID-verified seller      │
│          Issued from Portugal       │
│  [Contact seller via DealApprover] │
├───────────────────────────────────┤
│ Issued: 9 May 2026 · 14:22 UTC     │
│ Certificate ID: k7Qm2pX9aB4        │
│ ▾ Verify cryptographic signature   │
├───────────────────────────────────┤
│ Powered by DealApprover · Report   │
└───────────────────────────────────┘
```

### 14.2 Performance budget

- HTML SSR < 200ms TTFB at edge.
- LCP < 1.5s on 4G mid-range Android.
- < 80 KB JS on first load (no dashboard bundle leakage).
- Fully functional with JS off (server-rendered).

### 14.3 Sharing

Open Graph + Twitter card with hero image = first item photo + status overlay.

### 14.4 Buyer concern report

Lightweight form (name optional, email required, message). Hits `/api/v1/reports`. Triggers email to seller (proxied) and our ops queue.

### 14.5 SEO

`robots.txt` allows trust pages but disallows `/app`. Sitemap not generated for trust pages by default (privacy — sellers may not want public indexing); opt-in toggle in settings.

---

## 15. Storage & Images

**AWS S3** — using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (already in macedov2).

**Buckets:**

| Bucket | Purpose | ACL | Notes |
|--------|---------|-----|-------|
| `da-uploads-<env>` | Temp zone for presigned PUT | private | 24h lifecycle rule auto-deletes unconfirmed uploads |
| `da-photos-<env>` | Content-addressed permanent photos | private | Keys: `photos/<sha256>.jpg` |
| `da-renders-<env>` | QR PNG/SVG + PDF | private | Presigned GET for download |

**Upload flow (presigned PUT):**

1. Client requests a presigned PUT URL from BE (`POST /api/v1/items/:id/photos/sign`).
2. Client uploads directly to S3 temp bucket.
3. Client notifies BE of completion.
4. BE: `GetObject` from temp → compute SHA-256 → `CopyObject` to `photos/<sha256>.jpg` → `DeleteObject` from temp.
5. BE strips EXIF with `sharp`, generates 320px + 800px thumbnails → uploads to `da-photos`.

**Delivery:**
- Photos served via presigned GET URLs (15min TTL for dashboard; 24h TTL for trust page rendering).
- Trust page renders photo URLs at SSR time; Nginx caches the HTML response.
- Future: put CloudFront in front of `da-photos` for CDN caching.

**Image processing:** `sharp` on the Node BE. Client-side resize to ≤4096px before upload (reduces bandwidth).

**Backups:** AWS S3 versioning enabled + cross-region replication to `da-photos-backup-<env>` (set up from day 1).

---

## 16. Notifications

| Event | Channel | Timing |
|------|---------|--------|
| Email verification | Email | Immediate |
| Welcome | Email | Post-verification |
| Certificate issued | Email | Immediate (with QR PNG attached) |
| Certificate revoked | Email | Immediate |
| Buyer scanned for first time | Email | Aggregated daily digest (avoid spam) |
| Buyer report received | Email | Immediate |
| Quota 80% / 100% | Email | On threshold cross |
| Plan renewed / failed payment | Email | Stripe-driven |

All transactional. Plain-text + HTML. EN/PT based on `users.locale`.

---

## 17. Billing & Subscriptions

- Stripe products: `price_pro_monthly`, `price_business_monthly` (also yearly variants, 20% off).
- Checkout in hosted mode for MVP (Stripe Checkout).
- Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `identity.verification_session.verified`.
- Idempotency via `webhook_events` table.
- Quota logic:
  - Free: 3 / calendar month UTC. Resets via daily cron checking `quota_period_start`.
  - Pro/Business: no cap, but soft anti-abuse cap of 200/day (alert ops if hit).

Edge case: plan downgrade mid-cycle keeps Pro until period-end. Quota of new tier kicks in at next reset.

---

## 18. Internationalization

- Locales: `en`, `pt` for MVP (matches landing page).
- Locale stored on `users.locale`; falls back to `Accept-Language`.
- Translation keys live in `src/i18n/<locale>.ts` (same convention as marketing site).
- Trust page locale: derived from buyer's `Accept-Language`, falls back to seller's locale, falls back to `en`.
- Currency display follows `Intl.NumberFormat`; we don't convert prices.
- Timezone: always store UTC in DB, render in user/browser local TZ on dashboard, **always render UTC + ISO** on trust page (avoids timestamp ambiguity in disputes).

---

## 19. Privacy, Security, Compliance

### 19.1 Regulatory posture

- **GDPR** (EU) + **LGPD** (Brazil) — both require similar disclosures and rights.
- We are **data controller** for seller PII; **processor** for any data sellers expose on their certificates.
- DPA template (post-MVP) for Business customers.

### 19.2 Data minimization

- We collect only what's needed: email, optional phone, optional ID (only if upgrading to L2).
- Buyers leave **zero PII** unless they file a report.
- IP addresses are hashed within 24h (raw IP only retained in CF logs, 7 days).

### 19.3 User rights endpoints

- `GET /api/v1/account/export` → JSON download of all user data.
- `POST /api/v1/account/delete` → 30-day grace, then hard delete.
  - Issued certificates are *not* deleted but stripped of PII (`sub.display_name` anonymized, contact channel disabled). Deletion of signed payloads would break trust math; we instead anonymize.
- Right-to-rectification handled by re-issuing a corrected cert (revoke + re-issue at no quota cost on rectification).

### 19.4 Retention

| Data | Retention |
|------|-----------|
| Account | While active + 30d after delete request |
| Certificates | Forever (signed records are evidentiary) — but PII anonymizable |
| Photos | Same as certificate (S3, versioning enabled) |
| Audit log | 2 years |
| Scan events | 90 days then aggregated, raw rows dropped |
| Stripe webhooks | 30 days |
| CF edge logs | 7 days |

### 19.5 Cookie & consent

- Strictly-necessary cookies only on marketing + trust pages → no banner needed in EU per ePrivacy.
- Dashboard sets session cookie post-login (necessary), still no banner.
- PostHog analytics behind a consent banner on marketing site (already a concern for landing page).

### 19.6 Security practices

- All inputs validated server-side with Zod schemas.
- ORM (Drizzle or Kysely) — no raw SQL with user input.
- CSP: `default-src 'self'; img-src 'self' data: r2.dealapprover.com; script-src 'self' 'sha256-...'; ...`.
- HSTS 1 year, preload.
- Dependency audit weekly via `npm audit` + Renovate.
- SAST: GitHub CodeQL on PRs.
- Pen-test before public launch (third-party).
- Bug bounty: private list of 5–10 testers at launch; public on hardening.

---

## 20. Observability & Analytics

| Concern | Tool |
|--------|------|
| Errors (FE + BE) | Sentry |
| Access logs | Nginx access log on VPS → `logrotate` daily |
| App logs | `console.json` structured logs from Express → Docker log driver |
| Product analytics | PostHog (cloud-EU) |
| Uptime | UptimeRobot or Better Stack — public status page |
| Server metrics | Netdata on VPS (lightweight, free) |

### 20.1 Key product events

```
user_signed_up               { provider, locale }
user_verified_email
user_verified_phone
user_started_id_verification
user_completed_id_verification
item_drafted                 { category }
photo_uploaded               { item_id, position }
certificate_issued           { item_id, slug, confidence, plan }
certificate_revoked          { slug, reason }
certificate_scanned          { slug, country }
plan_upgraded                { from, to }
plan_canceled                { from, reason }
report_filed                 { slug, kind }
```

Funnels we'll watch from week 1:

- Signup → email verified → first cert issued → first scan.
- Free → Pro upgrade.

### 20.2 SLOs

| Metric | Target |
|------|--------|
| Trust page availability | 99.9% monthly |
| Trust page TTFB | <300ms p95 globally |
| Certificate issuance success | >99.5% (excl. quota errors) |
| Email deliverability (transactional) | >99% |

---

## 21. Acceptance Criteria (definition-of-done for MVP)

The MVP ships when **all** of the following are true:

1. A new user can sign up, verify email, complete the wizard, and issue a certificate in <5 minutes from a phone (manual test, 3 different users).
2. The trust page passes Lighthouse Mobile scores ≥90 across Perf/A11y/Best/SEO.
3. The verifier script (TS + Python) successfully verifies 100 sample certificates offline against the published public key.
4. Stripe checkout for Pro completes; quota enforcement flips correctly within 5 seconds of webhook.
5. Revocation reflects on the trust page within 60 seconds.
6. EN and PT renderings cover 100% of user-facing strings (no missing-key fallbacks).
7. CI: lint + typecheck + unit + integration + e2e (Playwright) all green on `main`.
8. Pen-test report filed; no Critical/High open.
9. Privacy policy + ToS published, reviewed by counsel.
10. Status page live and green for 7 consecutive days under synthetic load (50 issuances/min, 500 trust-page views/min).

---

## 22. Release Plan (8–12 weeks)

| Week | Milestone |
|------|-----------|
| 1 | Repo + CI, schema, auth, email verification |
| 2 | Item draft + photo upload pipeline (with content-addressed storage) |
| 3 | Categories framework, validators, JSON-Schema/Zod codegen |
| 4 | Certificate signing + slug + DB persistence + QR PNG |
| 5 | Trust page (SSR), public verify endpoint, well-known keys |
| 6 | Dashboard polish, EN/PT, Stripe checkout, quota |
| 7 | ID verification (Stripe Identity), revocation, reports |
| 8 | Hardening: rate limits, audit log, abuse signals, observability |
| 9 | E2E tests, Lighthouse, accessibility audit, copy pass |
| 10 | Closed beta with 20 sellers, fix-feedback |
| 11 | Pen-test, privacy policy, ToS, status page, comms prep |
| 12 | Public launch |

---

## 23. Risks & Open Questions

### 23.1 Top risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Sellers issue certificates for fakes; we get reputational damage | Med | High | Per-category required photos; confidence levels; reports → revocation; clear "we don't physically inspect" disclaimer |
| Buyers don't trust *us* either | Med | High | Open verifier + public-key registry + transparency posts |
| AWS S3 / VPS costs exceed budget | Low | Med | Cap uploads/month per plan; AWS Cost Alerts from day one; VPS is fixed cost |
| Stripe Identity costs eat margin | Med | Med | Only run on Pro; explore Persona for cheaper batch |
| Legal disputes (a buyer sues based on a cert) | Low | Med | ToS clearly limits liability; cert is evidence not contract |
| GDPR right-to-erasure conflict with immutable signed records | Med | Med | Anonymization-on-delete instead of deletion; documented in policy |

### 23.2 Open questions to resolve before week 1

- [ ] Final domain confirmed for app vs marketing (`app.dealapprover.com` vs `dealapprover.com/app`)?
- [ ] Stripe entity / VAT registration country?
- [ ] Initial signing key ceremony — who is custodian?
- [ ] Do we ship an iOS Safari "scan" optimization (Smart App Banner is irrelevant since no app, but check QR handoff to default browser vs in-app browsers)?
- [ ] Pricing currency: USD only, or EUR localized?
- [ ] Branded PDF: who designs the template (founder vs designer)?

---

## 24. Glossary

- **Certificate** — a signed JSON object binding an item, a seller, and a timestamp.
- **Slug** — the public, base62 short id used in the trust-page URL.
- **Trust page** — the public `dealapprover.com/c/<slug>` page.
- **L0/L1/L2** — seller verification levels (email / phone / ID).
- **JCS** — JSON Canonicalization Scheme (RFC 8785).
- **Confidence level** — Standard / Enhanced / Premium label baked into the certificate at issuance.
- **TAC** — Type Allocation Code, first 8 digits of an IMEI.
- **EXIF** — image metadata; stripped server-side on upload.
- **S3** — AWS Simple Storage Service; used for photos, QR renders, and PDFs.

---

## 25. Appendix — Pseudocode samples

### 25.1 Issue endpoint (TypeScript-ish)

```ts
async function issueCertificate(userId: string, itemId: string) {
  return db.transaction(async (tx) => {
    const user = await tx.users.findById(userId).forUpdate();
    const item = await tx.items.findById(itemId).forUpdate();
    assert(item.user_id === userId, "FORBIDDEN");
    assert(item.status === "draft", "ITEM_NOT_DRAFT");
    enforceQuota(user);

    const photos = await tx.item_photos.where({ item_id: itemId }).orderBy("position");
    assert(photos.length >= 3, "INSUFFICIENT_PHOTOS");

    // Re-hash photos by streaming from S3 (defense-in-depth)
    const verifiedPhotos = await Promise.all(
      photos.map(async (p) => ({
        i: p.position,
        sha256: await sha256OfS3Object(p.s3_key),   // streams S3 GetObject
      })),
    );
    for (let i = 0; i < photos.length; i++) {
      assert(
        bufEq(verifiedPhotos[i].sha256, photos[i].sha256),
        "PHOTO_HASH_MISMATCH",
      );
    }

    const slug = await allocateUniqueSlug(conn);   // MySQL INSERT with ON DUPLICATE retry
    const key = await loadActiveSigningKey(conn);
    const payload = buildCanonicalPayload({ user, item, photos: verifiedPhotos, slug, key });
    const canonicalBytes = jcs(payload);
    const payloadHash = sha256(canonicalBytes);
    const signature = await ed25519Sign(key.privateKeyRaw, payloadHash);

    await conn.execute(
      `INSERT INTO certificates
        (id, slug, item_id, user_id, version, signing_key_id,
         payload_canonical, payload_sha256, signature, issued_at)
       VALUES (UUID(), ?, ?, ?, 1, ?, ?, ?, ?, NOW(3))`,
      [slug, item.id, user.id, key.id,
       JSON.stringify(payload), payloadHash, signature],
    );
    const [rows] = await conn.execute(
      `SELECT * FROM certificates WHERE slug = ?`, [slug]
    );
    const cert = rows[0];

    await conn.execute(`UPDATE items SET status='active' WHERE id=?`, [item.id]);
    await decrementQuotaIfFree(conn, user);
    await audit(conn, { actor: user.id, action: "certificate.issued", resource: cert.id });

    setImmediate(() => renderCertificate(cert.id));   // async QR PNG/SVG/PDF → S3
    return cert;
  });
}
```

### 25.2 Public verify (third-party verifier)

```ts
async function verify(slug: string) {
  const r = await fetch(`https://dealapprover.com/api/v1/public/certificates/${slug}`).then(j);
  const keys = await fetch("https://dealapprover.com/.well-known/dealapprover-keys.json").then(j);
  const k = keys.keys.find((x) => x.id === r.key_id);
  if (!k) throw new Error("UNKNOWN_KEY");
  const hash = sha256(jcs(r.payload));
  const ok = await ed25519Verify(b64d(k.pub_b64), hash, b64d(r.signature_b64));
  if (!ok) throw new Error("BAD_SIGNATURE");
  if (r.payload.iss !== "dealapprover.com") throw new Error("BAD_ISSUER");
  if (r.status === "revoked") return { ok: true, revoked: true, payload: r.payload };
  return { ok: true, revoked: false, payload: r.payload };
}
```

---

*End of MVP spec. Edits welcome — this is a living document until launch.*
