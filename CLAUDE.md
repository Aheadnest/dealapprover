# DealApprover — Claude Code Guide

This file briefs Claude Code on conventions, common tasks, and traps. The
product spec lives in [MVP_SPEC.md](./MVP_SPEC.md); operational details live
in [README.md](./README.md). Read those for product/ops context; **this file**
is the working contract for code changes.

---

## Conventions (non-negotiable)

### Feature modules (backend)

Every backend feature lives in `backend/src/features/<name>/` with exactly three files:

| File | Purpose |
|------|---------|
| `<name>.routes.ts` | Express Router. **HTTP wiring only.** No logic. |
| `<name>.controller.ts` | Read `req`, call service, write `res`. **No DB access here.** |
| `<name>.service.ts` | Business logic + DB + integrations. **No `req`/`res` here.** |

Routes are mounted in `backend/src/app.ts` under `/api/v1`. Trust pages and the
well-known endpoint are mounted at root.

### Response shape

Success: raw JSON object.
Error: `{ "error": { "code": "UPPER_SNAKE", "message": "human readable" } }`.

Always use the helpers in `backend/src/utils/http.ts`:

```ts
sendSuccess(res, data, statusCode?);
sendError(res, status, code, message);
handleError(res, err);   // unwraps AppError
```

### Throwing errors

Use the factories in `backend/src/utils/errors.ts`:

```ts
import { Errors, AppError } from "../../utils/errors.js";
throw Errors.notFound("Item");
throw Errors.validation("title is required");
throw new AppError("CUSTOM_CODE", "Message", 400);
```

### DB access

Use the typed query helper. Never write `req`-derived strings into SQL.

```ts
import { executeQuery } from "../../integrations/mysql/pool.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
}

const [rows] = await executeQuery<UserRow[]>(
  "SELECT id, email FROM users WHERE id = ?",
  [userId],
);
```

For transactions, grab a connection from the pool:

```ts
import { mysqlPool } from "../../integrations/mysql/pool.js";
const conn = await mysqlPool.getConnection();
try {
  await conn.beginTransaction();
  // ...conn.execute(...)
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}
```

> **MySQL gotchas** the spec calls out: no `RETURNING` (use `lastInsertId` or a
> follow-up `SELECT`); `condition` is a reserved word (always backtick it); all
> `DATETIME(3)` is UTC; UUIDs are `CHAR(36)`.

### TypeScript imports

Backend is ES modules (`"type": "module"`, `moduleResolution: NodeNext`).
**All imports must end in `.js`** — even for `.ts` source files. This is a
NodeNext requirement.

```ts
// ✅ Correct
import { foo } from "./bar.js";
// ❌ Wrong
import { foo } from "./bar";
```

### Frontend conventions

- TanStack Router file-based — never edit `src/routeTree.gen.ts`, it's regenerated.
- Use the `apiFetch` / `apiPost` / `apiPatch` / `apiDelete` helpers from
  `frontend/src/lib/api/api.ts`. They auto-attach the Bearer token and auto-refresh
  on 401.
- Tailwind classes follow the **landing page design system**:
  - Background: `bg-bg-page` (#f9f9f9)
  - Cards: `card` utility (`bg-white border border-line rounded-xl shadow-card`)
  - Buttons: `btn-primary` (green), `btn-secondary` (outline), `btn-ghost`, `btn-danger`
  - Headings use Inter, weight 600/700, letter-spacing -0.01/-0.02em
  - Brand accent green: `#22C55E`, dark text: `#0F172A`
- Auth pages use the shared `<AuthLayout>` component.
- Logged-in pages wrap content in `<AppShell>` (header nav + footer).

---

## Cryptography

### Certificate signing (Ed25519)

Use `loadActiveSigningKey()` from `backend/src/lib/crypto/signing.ts`. The
private key is AES-GCM wrapped with `ROOT_ENC_KEY_HEX` and stored in
`signing_keys`. Old keys remain after rotation so old certs continue verifying.

```ts
const key = await loadActiveSigningKey();
const hash = sha256(Buffer.from(canonicalize(payload) ?? ""));
const signature = await ed25519Sign(key.privateKeyRaw, hash);
```

JCS canonicalization comes from the `canonicalize` npm package (RFC 8785).

### PII at rest

Serial numbers, IMEIs: AES-256-GCM via `backend/src/lib/crypto/aes.ts`:

```ts
import { encryptField, decryptField } from "../../lib/crypto/aes.js";
const ciphertext = encryptField(plaintext);   // BLOB column
const recovered = decryptField(ciphertext);
```

The format is `IV (12B) || TAG (16B) || CIPHERTEXT`. Don't roll your own.

### Passwords

`argon2id` via the `argon2` npm. Parameters: `m=64MB, t=3, p=1`. Defined as
`ARGON2_OPTIONS` in `auth.service.ts` — keep them consistent.

### Image hashing

Photos use **content-addressed S3 storage**: `photos/<sha256>.jpg`. The hash is
computed server-side after EXIF stripping (`sharp().rotate().withMetadata({exif: {}})`).
This is the canonical hash stored in `item_photos.sha256` and included in the
signed certificate payload.

---

## Routing & mounting

| Path | Where it's defined |
|------|--------------------|
| `/c/:slug` | `features/trust-page/trustPage.routes.ts` (SSR HTML) |
| `/.well-known/dealapprover-keys.json` | `features/public/public.routes.ts` |
| `/api/v1/auth/*` | `features/auth/auth.routes.ts` |
| `/api/v1/items/*` | `features/items/items.routes.ts` |
| `/api/v1/certificates/:slug/*` | `features/certificates/certificates.routes.ts` |
| `/api/v1/public/certificates/:slug` | `features/public/public.routes.ts` |
| `/api/v1/billing/*` | `features/billing/billing.routes.ts` |
| `/api/v1/account/*` | `features/account/account.routes.ts` |
| `/api/v1/scans` | `features/scans/scans.routes.ts` (Pro-only) |
| `/api/v1/reports` | `features/reports/reports.routes.ts` (unauthenticated) |
| `/api/v1/health` | `routes/health.ts` |

The Stripe webhook needs raw body, so the `express.raw` middleware is mounted
**before** `express.json` specifically for `/api/v1/billing/webhook`. Keep this
ordering or signature verification will fail.

---

## Common tasks

### Add a new endpoint

1. Add route handler in `features/<name>/<name>.routes.ts`
2. Add controller wrapping the service call
3. Add service with business logic
4. Mount router in `backend/src/app.ts` if it's a new feature

### Add a new DB column

1. Add migration file: `backend/database/migrations/00N_xxx.sql`
2. Update the corresponding `RowDataPacket` interface in the service
3. Apply locally:
   ```bash
   docker exec -i dealapprover-db-dev mysql -uapp -papp dealapprover < backend/database/migrations/00N_xxx.sql
   ```

### Add a new email template

1. Add a function returning HTML to `backend/src/integrations/resend/email.ts`
2. Use Inter font + brand green (#22C55E) for buttons to match the design system
3. Call from a service via `sendEmail({ to, subject, html })`

### Add a new FE page

1. Create the file in `frontend/src/routes/...` — the route tree regenerates on save
2. Use `<AuthLayout>` for unauthenticated pages, plain content for `/app/*` (already wrapped by AppShell via the layout route)
3. Use Tailwind utility classes from `index.css` (`btn-primary`, `card`, `input`, `label`, `badge-active` etc.)
4. Fetch data with `useQuery` + `apiFetch`; mutate with `useMutation` + `apiPost`/`apiPatch`/`apiDelete`

### Generate / rotate the signing key

Local dev:
```bash
npm run dev:migrate    # includes keygen
# or just keygen:
npm run dev:keygen --workspace backend
```

Custom key ID:
```bash
npx tsx backend/scripts/generate-signing-key.ts 2026-key-2
```

Rotation retires the previous active key and inserts a new active one — old
certificates continue to verify because retired keys remain published in
`.well-known/dealapprover-keys.json`.

---

## Things to NOT do

- ❌ Don't add new dependencies without checking they exist on npm and the version
- ❌ Don't bypass the feature module structure ("just one quick route in app.ts")
- ❌ Don't put raw SQL with template literals — always parameterize
- ❌ Don't import without `.js` extension (NodeNext)
- ❌ Don't sign with anything other than the key from `loadActiveSigningKey()`
- ❌ Don't trust client-provided hashes — always re-hash from S3
- ❌ Don't store IMEI/serial in plaintext columns — use `encryptField` + a separate hash column
- ❌ Don't commit `.env` files (`.gitignore` enforces this but double-check)
- ❌ Don't edit `frontend/src/routeTree.gen.ts` — it's auto-generated
- ❌ Don't return data with snake_case keys in some endpoints and camelCase in others. Backend returns snake_case. FE uses snake_case on the wire and only camelCases for its own derived state.

---

## SMS provider (production gap)

Phone L1 verification (`POST /api/v1/auth/phone/start`) currently logs the code
to the server log in development. For production, swap the `sendSmsCode` body in
`backend/src/features/auth/verification.service.ts` with a Twilio/MessageBird call.
The endpoint contract doesn't change — only the implementation of one function.

---

## Useful references

- Product spec: [MVP_SPEC.md](./MVP_SPEC.md)
- Operations: [README.md](./README.md)
- Landing design system: `/Users/tiago/GIT/dealapprover-landing/CLAUDE.md` (color palette + typography)
- Sibling project with similar patterns: `/Users/tiago/GIT/macedo-finance-v2`
