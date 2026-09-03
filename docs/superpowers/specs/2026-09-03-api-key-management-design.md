# API Key Management — Design Spec

GitHub issue: [#122](https://github.com/athype/beerswipe-v2/issues/122) · Branch: `BS-122-API-key-management` · Date: 2026-09-03

## 1. Problem

Admins need to create and manage long-lived API keys from the web UI so programmatic clients — the kiosk, or any third-party integration — can call the Beerswipe API with admin/seller privileges without a cookie session, a password, or a 24h JWT that nobody is around to refresh.

Today the backend only supports cookie-JWT auth (`authenticateToken` in `backend/src/middleware/auth.js`). There is no API-key middleware anywhere in the repo (verified: zero `X-API-Key` / `apiKey` handling in backend, frontend, or types). The kiosk client sends `X-API-Key` on requests, but the header is ignored server-side, so the kiosk cannot authenticate today.

## 2. Scope decisions (agreed with the user)

1. **Core only.** `GET/POST /api-keys`, `POST /api-keys/:id/revoke`, `DELETE /api-keys/:id` + auth middleware + UI + tests + docs. The rotate endpoint (`POST /api-keys/:id/rotate`) and a rate limiter are **deferred** — both are easy follow-ups. Rationale: rotate = revoke + create (already covered by the UI); keys are 128-bit random, so online brute force is infeasible and a leaked key is handled by revoke, not throttling.
2. **API keys are accepted on every currently-JWT-protected route** via one combined middleware (cookie JWT first, then `X-API-Key`). Cookie behavior is unchanged. Role guards + key scope still gate each route. No per-route opt-in list.
3. **SHA-256 key digests** (not bcrypt). Keys are 128-bit random secrets — bcrypt's slow-hash defense against brute-forcing low-entropy secrets adds nothing, while its ~50–100ms per request would be paid on every kiosk sale. Revocation is the leak control. `node:crypto`, no new dependencies. (Note: the issue's default was bcrypt; superseded by this decision.)

## 3. Key format & storage

- Plaintext: `bsk_` + 32 hex chars from `crypto.randomBytes(16)` → 128 bits of entropy, 35 chars total.
- `keyHash`: SHA-256 hex digest of the full plaintext key (64 chars), unique-indexed.
- `prefix`: the first 12 chars of the plaintext (`bsk_` + 8 hex), used for display (`bsk_ab12cd34****`) and to narrow the lookup.
- Lookup: `WHERE prefix = ? AND keyHash = ?`. The prefix predicate narrows; the unique hash index pins the exact row. Plaintext comparison is never performed.
- The plaintext key is returned **exactly once**, from `POST /api-keys`. It is never stored, never logged, never echoed in error messages, and never appears in list responses.
- No new environment variables. Key prefix/length are code constants.

## 4. Data model & migration

### 4.1 `backend/src/models/ApiKey.js` (new; registered in `models/index.js`)

Sequelize model — PostgreSQL (the app's production DB; dev uses `sync({ alter: true })`, prod `sync({ alter: false })` from `backend/src/config/database.js`):

| column | type | notes |
|---|---|---|
| `id` | INTEGER, PK, autoIncrement | `SERIAL` in PG |
| `name` | STRING(50), NOT NULL | human label, e.g. "Kiosk bar" |
| `keyHash` | STRING(64), NOT NULL, UNIQUE | SHA-256 hex |
| `prefix` | STRING(12), NOT NULL | `bsk_` + first 8 hex chars |
| `scope` | ENUM('admin','seller'), NOT NULL, default 'admin' | new PG enum type |
| `createdBy` | INTEGER, NOT NULL | FK → User.id (admin who created it) |
| `isRevoked` | BOOLEAN, NOT NULL, default false | soft-delete flag |
| `expiresAt` | DATE, nullable | optional expiry |
| `lastUsedAt` | DATE, nullable | for spotting stale keys |
| `createdAt` / `updatedAt` | timestamps | |

Associations (in `models/index.js`, matching existing style):

```js
User.hasMany(ApiKey, { foreignKey: "createdBy", as: "apiKeys" });
ApiKey.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
```

### 4.2 Migration step in `backend/src/migrate.js`

New idempotent step `2026-09-03/api-keys`, mirroring the existing `2026-08-10/drinks-isAlcohol` pattern: `describeTable("ApiKeys")` inside try/catch → if the table is missing, `queryInterface.createTable(...)` reproducing the model definition **in lockstep** (same column types, same `DataTypes.ENUM("admin","seller")`, same unique constraint) → return true; otherwise return false.

Note: `sequelize.sync({ alter: false })` creates missing tables from the model anyway on boot, so on most boots this step no-ops. It exists so a production database whose schema cannot be driven by sync (or a manual `node src/migrate.js` run) still converges, and to keep the boot-time migration story consistent. Model and step must stay identical; a drift would fail prod boots with schema errors.

## 5. Auth middleware (`backend/src/middleware/auth.js`)

`authenticateToken` stays **unchanged**. Two additions:

### 5.1 `authenticateApiKey(req, res, next)`

1. Read the `X-API-Key` header. If absent → `401 { error: "Invalid API key" }` (this branch only fires when the middleware is used directly; via `authenticateRequest`, a request with no credential at all gets the `401` from §5.2).
2. `keyHash = sha256(header)`; look up `ApiKey` where `prefix` (first 12 chars of the header) **and** `keyHash` match.
3. Reject with `401 { error: "Invalid API key" }` if: no row, `isRevoked` true, or `expiresAt` in the past. Identical response for all failure modes — no oracle about why a key was rejected.
4. Throttled `lastUsedAt` touch: `UPDATE` only if `lastUsedAt` is null or older than ~60 seconds (avoids a write per high-frequency call such as each kiosk sale).
5. Load the creator `User` (`findByPk(key.createdBy)`); reject 401 if the user no longer exists or is inactive.
6. Overlay the key's scope onto the request identity: set `user.userType = key.scope` on the per-request instance, then `req.user = user`. The instance is fetched fresh per request and never saved by any route (verified: every `req.user` usage across `backend/src/api/*` reads fields only — `id`, `username`, `userType`, `credits`; routes that need to act re-fetch by id). Nothing persists.
7. Set `req.apiKey = { id, name, scope, prefix, createdBy }` (key metadata, never `keyHash`) for audit use.

### 5.2 `authenticateRequest(req, res, next)` — combined

- If a JWT credential is **present** (cookie `authToken` or `Authorization: Bearer`) → JWT path, exactly today's semantics, including `403 { error: "Invalid token" }` for a presented-but-invalid JWT (no silent fallback to the key path).
- Else, if `X-API-Key` is present → `authenticateApiKey`.
- Else → `401 { error: "Access token required" }` (keep today's message; adjust only if tests demand otherwise).

Rationale for precedence: the browser UI sends the cookie; a programmatic client sends the key. A request that presents both is a browser-context request, so the cookie wins.

### 5.3 Identity semantics and role guards

- An **admin-scoped key acts exactly as its creating admin** (`req.user` is that admin's row): `Transaction.adminId` keeps pointing at a real person; audit trail and per-person accountability are preserved. This is the issue's recommended "Option A".
- A **seller-scoped key is the creator admin, downgraded to seller privileges**: `req.user.userType` is overlaid to `"seller"`, so inline route checks that read `req.user.userType` (e.g. the undo-window logic in `sales.js`) behave consistently.
- Because of the overlay, `requireAdmin` and `requireAdminOrSeller` need **zero changes** — they already read `req.user.userType`.
- **Accepted edge case** (documented, not special-cased): a seller-scoped key can undo sales *the creator admin personally processed*, within the 15-minute seller window (`sales.js` checks `adminId === req.user.id`). On a kiosk this is desirable — an operator correcting a bad sale. For a human's in-person sales it is a narrow, logged, 15-minute exposure, consistent with the app's threat model (sellers and their keys are trusted humans).
- Consequence of the "all protected routes" decision: an admin-scoped key can also call the `/api-keys/*` management endpoints (mint/revoke keys). Coherent with "key = its creator, restricted by scope"; a leaked admin key already has full admin reach via `/users`, `/sales/undo`, etc. Revocation is the control.

## 6. API routes

New module `backend/src/api/apiKeys.js`, mounted as `router.use("/api-keys", apiKeys)` in `backend/src/api/index.js`. Every route: `authenticateRequest, requireAdmin`. Full `@openapi` docblocks on every route (mandatory — `backend/test/docs.test.js` fails on undocumented routes).

| route | behavior |
|---|---|
| `GET /api-keys` | List all keys: `{ apiKeys: [ApiKeyListItem] }` (no pagination — admin-scale cardinality). Never returns hashes or keys. |
| `POST /api-keys` | Body `{ name, scope?, expiresAt? }` → `201 { apiKey: ApiKey, key: "bsk_…" }`. The plaintext `key` appears only in this response. |
| `POST /api-keys/:id/revoke` | Soft delete: `{ message: "…" }`. `404` for unknown id; idempotent-ish: revoking an already-revoked key returns success. |
| `DELETE /api-keys/:id` | Hard delete (tidy-up of revoked keys): `{ message: "…" }`. `404` for unknown id. The backend allows deleting any key, active or revoked (killing an active key outright is equivalent to revoke + delete); the UI only offers Delete on revoked rows. |

Error codes: `401` missing/invalid credentials; `403` authenticated but not admin; `400` zod validation failure; `404` unknown key id; `500` via the shared error handler. Error bodies are `{ error: string }` (the `ApiErrorResponse` convention).

### 6.1 Validation (`backend/src/validation/contracts.js`)

- `createApiKeySchema`: `name: z.string().trim().min(1).max(50)`; `scope: z.enum(["admin","seller"]).optional().default("admin")`; `expiresAt: z.coerce.date().optional()` + refine → must be in the future (UTC).
- Param id: `z.coerce.number().int().positive()` on `req.params.id`.
- Management bodies are otherwise read-only; no response schemas needed server-side (backend doesn't consume `@beerswipe/types`; OpenAPI JSDoc documents response shapes).

## 7. Shared types (`types/src/apiKeys.ts`, re-exported from `types/src/index.ts`)

Package conventions: string-literal unions, no TS `enum`s; `ISODateString`, `ApiErrorResponse`, `StoreActionResult` live in `common.ts`; consumers are the frontend only (backend does not import the types package).

```ts
export type ApiKeyScope = "admin" | "seller";

export interface ApiKey {                       // persisted metadata; NEVER keyHash or plaintext
  id: number;
  name: string;
  prefix: string;                                // "bsk_ab12cd34"
  scope: ApiKeyScope;
  createdBy: number;                             // User id of the creating admin
  isRevoked: boolean;
  expiresAt: ISODateString | null;
  lastUsedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface ApiKeyListItem extends ApiKey { // list row; creator joined for the "created by" column
  creator: { id: number; username: string };
}

export interface CreateApiKeyRequest {
  name: string;
  scope?: ApiKeyScope;
  expiresAt?: ISODateString;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;                                // metadata only
  key: string;                                   // one-time plaintext, "bsk_…"
}

export interface ListApiKeysResponse { apiKeys: ApiKeyListItem[]; }
export interface RevokeApiKeyResponse { message: string; }   // also the DELETE body shape
```

## 8. Frontend

### 8.1 API module — `frontend/src/services/api.ts`

`apiKeysAPI` module in the existing single-file API client, typed like `usersAPI`:

```ts
apiKeysAPI = {
  getAll: ()  => api.get<ListApiKeysResponse>("/api-keys"),
  create: (d) => api.post<CreateApiKeyResponse>("/api-keys", d),
  revoke: (id: number) => api.post<RevokeApiKeyResponse>(`/api-keys/${id}/revoke`),
  remove: (id: number) => api.delete<RevokeApiKeyResponse>(`/api-keys/${id}`),
}
```

### 8.2 Store — `frontend/src/stores/apiKeys.ts`

Options-style `defineStore("apiKeys", …)` (like `stores/users.ts`):

- state: `{ apiKeys: ApiKeyListItem[] | null, loading: boolean, error: string | null }`
- actions: `listApiKeys`, `createApiKey`, `revokeApiKey`, `removeApiKey` — each returns `Promise<StoreActionResult<T>>` (`{ success: true, data? } | { success: false, error }`); create/revoke/remove refresh the list on success. The plaintext key returned by `createApiKey` is passed to the view and **never stored in state**.

### 8.3 View — `frontend/src/views/ApiKeysView.vue`

Mirrors `UsersView.vue` (plain-JS `<script setup>`, local `ref`s driving the modal, inline table). Admin-only page:

- Header + "Create API key" button.
- Table columns: **Name · Key (masked: `prefix` + `****`) · Scope (badge) · Created by (creator.username) · Created · Last used · Expiry · Status**.
- Status is derived client-side: `isRevoked` → Revoked; else past `expiresAt` → Expired; else Active.
- Row actions: **Revoke** (confirm) on active keys; **Delete** on revoked keys (tidy-up). Revoked/expired rows visually muted.
- Empty state: short explanation of what API keys are for (programmatic access for the kiosk / integrations), since a fresh install has none.
- Success/error feedback via `useNotifications()` (`showSuccess`/`showError`), the existing convention.

### 8.4 Modal — `frontend/src/components/CreateApiKeyModal.vue`

**Top-level `components/`, NOT `components/modals/`** — the explorer verified `components/modals/*` are stale legacy duplicates; the live pattern is top-level (CreateUserModal.vue etc.). Wraps `Modal.vue`, props `{ show }`, emits `close` / `success`.

Two phases inside one modal instance:

1. **Form**: name (required, ≤50 chars), scope select (Admin / Seller, default Admin), optional expiry (native `<input type="date">`, `min` = today; matches the future-only backend rule).
2. **One-time key display** (shown after create succeeds): the plaintext key in a monospace read-only field, a **Copy** button (clipboard with fallback), and a prominent warning that the key will not be shown again. The modal closes only via an "I've saved the key" button; on close it emits `success` and the parent refreshes the list.

The plaintext key exists only in the action response and this one screen — never in the store, never in the list.

### 8.5 Router + navigation

- `frontend/src/router/index.ts`: add `{ path: "/api-keys", name: "api-keys", component: ApiKeysView, meta: { requiresAuth: true, requiresAdmin: true } }`. Existing `beforeEach` guard handles access.
- **Both** navbars get the link, gated `v-if="authStore.isAdmin"`, grouped with Users/Drinks:
  - `frontend/src/components/Navigation/DesktopNavbar.vue`
  - `frontend/src/components/Navigation/MobileNavbar.vue`

## 9. OpenAPI docs

- `backend/src/api-docs.js`: add an `apiKeyHeader` securityScheme (`type: "apiKey", in: "header", name: "X-API-Key"`), an "Api Keys" tag, and an info-description note: every endpoint that accepts the `authToken` cookie also accepts `X-API-Key` (except `POST /auth/login`, `/auth/create-admin`, `/auth/logout`, which are unauthenticated by nature).
- `/sales/sell`'s `security` block documents both schemes; other routes keep `authToken` to avoid churn (the description covers the general rule).
- `backend/test/docs.test.js`: add the four new operations to `EXPECTED_OPERATIONS`:
  - `["/api-keys", "get"]`, `["/api-keys", "post"]`, `["/api-keys/{id}/revoke", "post"]`, `["/api-keys/{id}", "delete"]`

## 10. Tests — `backend/test/apiKeys.test.js`

Supertest against the real app + direct model setup (pattern of `sales-concurrency.test.js`). The dev/test DB gets the `ApiKeys` table from sync on boot.

**Management (cookie-authenticated admin):**
- `POST /api-keys` → 201; response carries `key` starting `bsk_` + full metadata; list responses never contain the key or a hash
- zod validation: empty name, >50-char name, past `expiresAt` → 400
- `GET /api-keys` → rows with masked `prefix` and `creator.username`; `keyHash` absent
- `POST /:id/revoke` → listed as revoked; `DELETE` → gone; unknown id on either → 404
- seller cookie on management routes → 403; no credentials → 401

**API-key auth:**
- seller-scoped key: `POST /sales/sell` → 200, and the recorded `Transaction.adminId` equals the creating admin's id
- seller-scoped key on a `requireAdmin` route (`POST /api-keys`) → 403 (scope overlay honored)
- admin-scoped key: sell + management → 200/201
- unknown / revoked / expired key → 401 (identical body)
- precedence: valid cookie + bogus `X-API-Key` → succeeds as the cookie user; invalid JWT without a valid key → 403, no fallback
- sell response body never contains the key string

## 11. Kiosk

Out of scope for commits in this repo: the `kiosk/` directory is untracked local work and its sources are not present in the working copy (only `__pycache__` artifacts), so the issue's claim that `kiosk/src/client/http.py` already sends `X-API-Key` cannot be verified from the repo — and nothing is needed here either way. Once the backend honors the header, provisioning is a UI action + device config: create one key per kiosk ("Kiosk bar", "Kiosk upstairs"…), name by device for individual revocation. The README documents this story.

## 12. Docs & verification

- `backend/README.md` (currently stale): add an "API Keys" subsection — endpoint list, one-time key display, `X-API-Key` usage example, "leaked key → revoke immediately".
- Verification gate before merge:
  - `pnpm --filter @beerswipe/backend test` and `pnpm --filter @beerswipe/backend run lint`
  - `pnpm run typecheck:types` and `pnpm run build:types` (new `apiKeys.ts` module)
  - `pnpm --filter @beerswipe/frontend run build`
  - Manual smoke: create key in UI → copy → `curl -H "X-API-Key: …" -X POST /api/v1/sales/sell` succeeds → revoke in UI → same curl → 401 → cookie login/logout and existing UI flows unaffected

## 13. Touch list

**Backend:** `src/models/ApiKey.js` (new), `src/models/index.js`, `src/migrate.js`, `src/middleware/auth.js`, `src/api/apiKeys.js` (new), `src/api/index.js`, `src/validation/contracts.js`, `src/api-docs.js`, `test/apiKeys.test.js` (new), `test/docs.test.js`, `README.md`
**Types:** `types/src/apiKeys.ts` (new), `types/src/index.ts`
**Frontend:** `src/services/api.ts`, `src/stores/apiKeys.ts` (new), `src/views/ApiKeysView.vue` (new), `src/components/CreateApiKeyModal.vue` (new), `src/router/index.ts`, `src/components/Navigation/DesktopNavbar.vue`, `src/components/Navigation/MobileNavbar.vue`

## 14. Deferred follow-ups (explicitly out of scope)

- `POST /api-keys/:id/rotate` (revoke + replacement in one step) — later, if config rotation UX demands it
- Rate limiting for key-authenticated requests — later; not security-critical at 128-bit key entropy (revoke is the control)
- CORS handling for browser-based third-party consumers of key endpoints — separate concern from non-browser clients
