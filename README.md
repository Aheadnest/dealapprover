# DealApprover

> Tamper-evident, cryptographically signed QR certificates for physical items.
> Buyers scan, verify, decide — no app, no buyer login.

[![Spec](https://img.shields.io/badge/spec-MVP__SPEC.md-blue)](./MVP_SPEC.md)
[![Node](https://img.shields.io/badge/node-22.x-green)](./.nvmrc)
[![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Express%205%20%2B%20MySQL%208-indigo)](./CLAUDE.md)

DealApprover lets resellers issue Ed25519-signed certificates binding a physical
item (photos + serial/IMEI), a verified seller, and an issuance timestamp. The
QR encodes a trust-page URL that any phone camera can scan — the buyer lands on
a fast, server-rendered page showing the item, the seller's verification badge,
and the certificate signature for offline verification.

---

## Table of contents

- [Repo layout](#repo-layout)
- [Tech stack](#tech-stack)
- [Quick start (local)](#quick-start-local)
- [Running in production](#running-in-production)
- [Required env vars](#required-env-vars)
- [Cloudflare Pages setup](#cloudflare-pages-setup-frontend)
- [VPS setup](#vps-setup-backend--db)
- [GitHub Actions](#github-actions-cicd)
- [Architecture](#architecture)
- [Common operations](#common-operations)
- [Project status vs spec](#project-status-vs-spec)

---

## Repo layout

```
dealapprover/
├── frontend/                React 19 + Vite + Tailwind (Cloudflare Pages)
│   ├── src/
│   │   ├── routes/          TanStack Router file-based pages
│   │   ├── components/      Shared UI (AppShell, AuthLayout, Logo)
│   │   ├── lib/api/         Typed API client with auto JWT refresh
│   │   └── lib/auth/        Session storage (in-memory + localStorage)
│   ├── functions/           Cloudflare Pages Functions (proxy /api, /c, /.well-known)
│   ├── public/              Static assets (logo.png, _headers)
│   └── wrangler.toml
├── backend/                 Express 5 + TypeScript (Docker → VPS)
│   ├── src/
│   │   ├── app.ts           Middleware + router wiring
│   │   ├── server.ts        Entry point
│   │   ├── config/env.ts    Typed env vars (validated at startup)
│   │   ├── features/        auth, items, certificates, public, trust-page, billing, account, scans, reports
│   │   ├── integrations/    mysql, s3, resend, stripe
│   │   ├── lib/             crypto (ed25519, aes), qr, pdf, image, slug, categories
│   │   └── middleware/      requireAuth
│   ├── database/migrations/ 001_initial_schema.sql
│   ├── scripts/             generate-signing-key.ts
│   └── Dockerfile           Multi-stage node:22-alpine
├── config/
│   ├── docker-compose.yml       VPS production compose
│   ├── docker-compose.dev.yml   Local development (MySQL only)
│   └── nginx.conf               api.dealapprover.com reverse proxy + TLS
├── .github/workflows/
│   ├── build.yml            Build & push BE image to GHCR
│   ├── deploy.yml           rsync + docker compose up on VPS
│   └── app-secrets.json     Secret allowlist for .env generation
├── MVP_SPEC.md              Product/technical spec (source of truth)
└── CLAUDE.md                Developer guide for Claude Code
```

---

## Tech stack

| Layer | Choice | Why |
|------|--------|-----|
| Frontend | React 19 + Vite + Tailwind CSS | Matches dealapprover-landing design system |
| Routing | TanStack Router (file-based) | Type-safe routes, code-splitting |
| Data fetching | TanStack Query | Same as macedo-finance-v2 |
| FE hosting | Cloudflare Pages + Pages Functions | Edge CDN, free, CF proxy to BE |
| Backend | Express 5 + TypeScript | Same pattern as macedo-finance-v2 |
| BE hosting | Docker on Ubuntu VPS | Cost-effective for MVP |
| Database | MySQL 8 (Docker) | Familiarity, JSON column type |
| Auth | argon2id + JWT (access 15min, refresh 14d) | Self-managed |
| Storage | AWS S3 (uploads/photos/renders buckets) | Standard, presigned URLs |
| Crypto | `@noble/ed25519` + Node `crypto` | Audited, zero-dep Ed25519 |
| QR | `qrcode` npm | Mature, PNG + SVG |
| PDF | `pdfkit` | Branded A6 sticker |
| Images | `sharp` | EXIF strip + thumbnails |
| Payments | Stripe Checkout + Identity | Pro/Business tiers + L2 verification |
| Email | Resend | Transactional only |
| TLS / Reverse proxy | Nginx + Certbot | Industry standard |
| CI/CD | GitHub Actions + GHCR | Same pattern as macedo-finance-v2 |

---

## Quick start (local)

### Prerequisites
- Node 22 (`.nvmrc`)
- Docker Desktop (only for local MySQL)
- AWS S3 + Stripe test key + Resend key (for full flows). For pure dev you can
  still run signup/login and basic CRUD without these.

### 1. Install deps

```bash
nvm use            # or: nvm install
npm install
```

### 2. Configure backend secrets

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill at minimum:

```bash
JWT_SECRET=$(openssl rand -hex 64)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 64)
ROOT_ENC_KEY_HEX=$(openssl rand -hex 32)
```

### 3. Start MySQL

```bash
npm run dev:db          # MySQL 8 on :3306 via docker-compose.dev.yml
```

### 4. Apply schema + seed signing key

```bash
npm run dev:migrate
```

This step is **required** — `/api/v1/items/:id/issue` will fail until there's an
active row in `signing_keys`.

### 5. Run FE + BE

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:3005>
- Local DB: <mysql://app:app@127.0.0.1:3306/dealapprover>

The Vite dev server proxies `/api`, `/c`, and `/.well-known` to the backend, so
you can develop against a single origin.

### Useful commands

```bash
npm run typecheck            # both workspaces
npm run lint                 # both workspaces
npm run build                # both workspaces
npm run dev:db:down          # stop local MySQL
docker exec -it dealapprover-db-dev mysql -uapp -papp dealapprover  # DB shell
```

---

## Running in production

DealApprover runs as a **split deployment**:

- **Frontend** → Cloudflare Pages (auto-built on push to `main`, served from edge)
- **Backend + DB** → Single Ubuntu VPS, Dockerized, behind Nginx + Certbot
- **Storage** → AWS S3 (`da-uploads-prod`, `da-photos-prod`, `da-renders-prod`)
- **Payments** → Stripe (live keys)
- **Email** → Resend (production domain)

CI/CD:
1. Push to `main` → CF Pages auto-builds & deploys frontend
2. Trigger `Build and Push` workflow → builds BE Docker image to GHCR
3. Trigger `Deploy` workflow → rsyncs `.env` + compose to VPS and `up -d`

---

## Required env vars

### Backend (`.env` on VPS, also `backend/.env` locally)

| Var | Description | Example |
|-----|-------------|---------|
| `PORT` | Server port | `3005` |
| `NODE_ENV` | `development` or `production` | `production` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://dealapprover.com` |
| `JWT_SECRET` | Access-token HMAC secret | `openssl rand -hex 64` |
| `REFRESH_TOKEN_SECRET` | Refresh-token HMAC secret | `openssl rand -hex 64` |
| `ROOT_ENC_KEY_HEX` | 32-byte AES-GCM master key (hex) | `openssl rand -hex 32` |
| `MYSQL_HOST` | DB host | `db` (compose) or `127.0.0.1` |
| `MYSQL_PORT` | DB port | `3306` |
| `MYSQL_USER` | DB user | `app` |
| `MYSQL_PASSWORD` | DB password | — |
| `MYSQL_DATABASE` | DB name | `dealapprover` |
| `DB_ROOT_PASSWORD` | MySQL root password (compose only) | — |
| `AWS_REGION` | S3 region | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | IAM key | — |
| `AWS_SECRET_ACCESS_KEY` | IAM secret | — |
| `AWS_S3_BUCKET_UPLOADS` | Temp bucket (24h lifecycle) | `da-uploads-prod` |
| `AWS_S3_BUCKET_PHOTOS` | Content-addressed photos | `da-photos-prod` |
| `AWS_S3_BUCKET_RENDERS` | QR PNG/SVG + PDF | `da-renders-prod` |
| `STRIPE_SECRET_KEY` | `sk_live_…` | — |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | — |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe price ID | `price_…` |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Stripe price ID | `price_…` |
| `RESEND_API_KEY` | `re_…` | — |
| `RESEND_FROM_EMAIL` | Verified sender | `noreply@dealapprover.com` |
| `APP_URL` | Public FE URL | `https://dealapprover.com` |
| `API_URL` | Public BE URL | `https://api.dealapprover.com` |
| `GOOGLE_CLIENT_ID` | OAuth client (optional) | — |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | — |

### Frontend (`frontend/.env` for local dev only)

Production frontend gets its API URL via the Cloudflare Pages env var
`API_ORIGIN`, read by the Pages Functions in `frontend/functions/`. Locally,
Vite proxies to `localhost:3005`, so no FE env is required.

---

## Cloudflare Pages setup (frontend)

1. **Connect repo** in CF Pages dashboard
2. **Build settings:**
   - Build command: `npm run build --workspace frontend`
   - Output directory: `frontend/dist`
   - Root directory: `/` (monorepo root)
   - Node version: `22`
3. **Environment variables:**
   - `API_ORIGIN=https://api.dealapprover.com` (read by Pages Functions)
4. **Custom domain:** point `dealapprover.com` (or `app.dealapprover.com`) at the project
5. **Headers:** automatically applied from `frontend/public/_headers`

CF Pages Functions in `frontend/functions/` transparently proxy these paths to
the VPS so the user experience is a single origin:
- `/c/:slug` → Trust pages
- `/api/*` → REST API
- `/.well-known/*` → Public key registry

---

## VPS setup (backend + DB)

### One-time setup on a fresh Ubuntu 22.04 VPS

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Install Nginx + Certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx jq rsync

# 3. Create project directory
mkdir -p ~/dealapprover/config

# 4. After first deploy, install nginx config
sudo cp ~/dealapprover/config/nginx.conf /etc/nginx/sites-available/api.dealapprover.com
sudo ln -s /etc/nginx/sites-available/api.dealapprover.com /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.dealapprover.com
sudo systemctl reload nginx

# 5. DNS: A record api.dealapprover.com → <VPS IP> (proxied via Cloudflare)
```

### Initial DB seed (one-time, after first deploy)

```bash
ssh user@vps
cd ~/dealapprover/config
docker compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" dealapprover \
  < /path/to/backend/database/migrations/001_initial_schema.sql

# Generate signing key (one-time):
# Easiest: run locally with prod DB env vars set, then point MYSQL_HOST at VPS
npx tsx backend/scripts/generate-signing-key.ts
```

### Routine operations

```bash
cd ~/dealapprover/config
docker compose ps                       # status
docker compose logs -f backend          # tail logs
docker compose pull && docker compose up -d   # update images
docker compose exec db mysql -uapp -p   # DB shell
```

---

## GitHub Actions (CI/CD)

### Required Secrets (Settings → Secrets and variables → Actions)

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_PORT` | SSH port |
| `VPS_USER` | SSH user |
| `VPS_PRIVATE_KEY` | SSH private key (PEM) |
| `JWT_SECRET` | Access token signing |
| `REFRESH_TOKEN_SECRET` | Refresh token signing |
| `ROOT_ENC_KEY_HEX` | AES-GCM master key |
| `MYSQL_PASSWORD` | DB app user password |
| `DB_ROOT_PASSWORD` | DB root password |
| `AWS_ACCESS_KEY_ID` | S3 IAM |
| `AWS_SECRET_ACCESS_KEY` | S3 IAM secret |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook |
| `RESEND_API_KEY` | Resend |

### Required Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Example |
|----------|---------|
| `PROJECT_NAME` | `dealapprover` |
| `MYSQL_USER` | `app` |
| `MYSQL_DATABASE` | `dealapprover` |
| `MYSQL_HOST` | `db` |
| `MYSQL_PORT` | `3306` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://dealapprover.com` |
| `AWS_REGION` | `eu-west-1` |
| `AWS_S3_BUCKET_UPLOADS` | `da-uploads-prod` |
| `AWS_S3_BUCKET_PHOTOS` | `da-photos-prod` |
| `AWS_S3_BUCKET_RENDERS` | `da-renders-prod` |
| `APP_URL` | `https://dealapprover.com` |
| `API_URL` | `https://api.dealapprover.com` |
| `RESEND_FROM_EMAIL` | `noreply@dealapprover.com` |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_…` |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | `price_…` |
| `GOOGLE_CLIENT_ID` | OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | OAuth (optional) |

### Workflows

- **Actions → Build and Push**: builds and pushes `ghcr.io/<repo>/backend:<sha>` and `:latest`
- **Actions → Deploy**: generates `.env`, rsyncs to VPS, `docker compose pull && up -d`

The frontend is auto-deployed by Cloudflare Pages when you push to `main`.

---

## Architecture

```
                              ┌────────────────────┐
   dealapprover.com →         │ Cloudflare Pages   │
                              └──────────┬─────────┘
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            │ Pages Functions transparently proxy:                     │
            │ /api/*   /c/:slug   /.well-known/*                       │
            └────────────────────────────┬────────────────────────────┘
                                         │
                              ┌──────────▼─────────┐
   api.dealapprover.com →     │ Cloudflare (proxy) │
                              └──────────┬─────────┘
                                         │
                              ┌──────────▼─────────┐
                              │ VPS Nginx :443     │ TLS + security headers
                              │   → 127.0.0.1:3005 │
                              └──────────┬─────────┘
                                         │
                              ┌──────────▼─────────┐
                              │ Backend container  │
                              │ Express 5 + ts     │
                              │ - REST /api/v1/*   │
                              │ - SSR /c/:slug     │
                              │ - .well-known      │
                              └──────────┬─────────┘
                                         │
                              ┌──────────▼─────────┐
                              │ MySQL 8 container  │
                              └────────────────────┘

       ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
       │ AWS S3 (×3)    │ │ Stripe         │ │ Resend         │
       └────────────────┘ └────────────────┘ └────────────────┘
```

### Certificate flow

1. Seller fills draft (category-specific schema validation)
2. Photos uploaded via S3 presigned PUT
3. BE re-fetches photo, strips EXIF with `sharp`, generates thumbnails
4. SHA-256 hash assigns content-addressed S3 key (`photos/<sha256>.jpg`)
5. On issue: payload built, JCS-canonicalized (RFC 8785), SHA-256 hashed, Ed25519-signed
6. Stored in `certificates`; QR PNG + SVG + branded A6 PDF rendered async
7. Trust page (`/c/:slug`) SSR'd with photos served via presigned URLs
8. Buyer scans → CF proxy → BE → SSR HTML
9. Third-party verifier: `GET /api/v1/public/certificates/:slug` + `/.well-known/dealapprover-keys.json`

---

## Common operations

### Add a new feature module (backend)

```
backend/src/features/<name>/
  <name>.routes.ts      Router + middleware wiring
  <name>.controller.ts  HTTP I/O only
  <name>.service.ts     Business logic
```

Then mount in `backend/src/app.ts`.

### Rotate signing keys

```bash
npx tsx backend/scripts/generate-signing-key.ts 2027-key-1
```

Old keys remain in `signing_keys` with `status='retired'` so existing certs continue to verify.

### Update database schema

1. Add a numbered SQL file: `backend/database/migrations/002_xxx.sql`
2. Run manually (no automated migration runner in MVP):
   ```bash
   docker compose exec -T db mysql -u app -p$MYSQL_PASSWORD dealapprover < 002_xxx.sql
   ```

### Disable a compromised key

```sql
UPDATE signing_keys SET status = 'compromised' WHERE id = '<key-id>';
```

Then mass-revoke all certificates signed by it (script TBD).

---

## Project status vs spec

| Area | Status |
|------|--------|
| Auth: email + password + Google OAuth | ✅ |
| Email verification + password reset | ✅ |
| Phone L1 (SMS) | ⚠️ Endpoints implemented; **swap in Twilio/MessageBird** in `backend/src/features/auth/verification.service.ts` `sendSmsCode` |
| Identity L2 (Stripe Identity) | ✅ |
| Items CRUD + S3 photo upload + EXIF strip + thumbnails | ✅ |
| Certificate signing (Ed25519 + JCS) | ✅ |
| QR PNG, SVG, branded PDF (A6) | ✅ |
| Trust page (SSR `/c/:slug`) with OG tags | ✅ |
| Public verify endpoint + `.well-known/` | ✅ |
| Billing: Stripe Checkout + Portal + webhooks | ✅ |
| Account: profile + verification + export + delete | ✅ |
| Buyer reports endpoint | ✅ |
| Scan analytics (Pro) | ✅ |
| Email templates: verify / reset / issued / revoked / quota | ✅ |
| Rate limits: per-IP+email login, per-IP signup, per-user issue | ✅ |
| Audit log | ✅ |
| Cloudflare Pages Functions proxy | ✅ |
| Nginx config + TLS via Certbot | ✅ |
| GitHub Actions CI/CD | ✅ |

Out of scope (Phase 2+):
- Blockchain anchoring
- Bulk CSV upload
- Custom domains (white-label)
- Public API for partners
- Daily scan-summary digest emails (cron)
- TOTP 2FA
- iOS / Android apps

---

## License

UNLICENSED — proprietary. © Tiago Ferreira.
