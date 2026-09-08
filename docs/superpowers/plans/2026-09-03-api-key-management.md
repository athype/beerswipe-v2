# API Key Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create/revoke/delete long-lived API keys from a web UI, and let programmatic clients (kiosk, third-party integrations) authenticate with `X-API-Key` on every route that today accepts the `authToken` cookie.

**Architecture:** New `ApiKey` Sequelize table (hash + prefix only, SHA-256). A combined `authenticateRequest` middleware tries the cookie JWT first, then `X-API-Key`; key-authenticated requests act as the key's creator admin with the key's `scope` overlaid onto `userType`, so existing role guards and inline `req.user.userType` checks work unchanged. Management CRUD lives in a new `/api/v1/api-keys` route module (admin only). Frontend gains a store, an admin view and a create-modal with a one-time key reveal. New routes carry `@openapi` docblocks (a test hard-fails undocumented routes).

**Tech Stack:** Express 5, Sequelize 6 (PostgreSQL), zod (v4), vitest + supertest (backend); Vue 3 + Pinia + Vue Router + axios, plain-JS `<script setup>` SFCs (frontend); `@beerswipe/types` (type-only contracts).

**Spec:** `docs/superpowers/specs/2026-09-03-api-key-management-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- **Auth model:** `authenticateToken` stays JWT-only and unchanged in behavior (presented-but-invalid JWT → 403, no fallback). `authenticateRequest` = cookie/Bearer JWT if a JWT credential is presented, else `X-API-Key`, else `401 { error: "Access token required" }`.
- **Key rules:** plaintext format `bsk_` + 32 hex chars (`API_KEY_PREFIX` + `randomBytes(16).toString("hex")`); store only `sha256(plaintext)` (64 hex) + 12-char `prefix`; plaintext shown **exactly once** in the `POST /api-keys` response; never logged, never echoed, never in list responses, never in the frontend store/Pinia state.
- **Scope semantics:** key acts as its creator admin with `userType` overlaid to the key's `scope` (`"admin"` or `"seller"`) on the per-request instance. `requireAdmin`/`requireAdminOrSeller` are NOT modified.
- **Error bodies:** `{ error: string }`. All key failures (unknown/revoked/expired/deleted/inactive-creator) → identical `401 { error: "Invalid API key" }`.
- **API surface:** management routes `GET /api-keys`, `POST /api-keys`, `POST /api-keys/:id/revoke`, `DELETE /api-keys/:id` — all `authenticateRequest, requireAdmin`.
- **Style:** backend JS = double quotes + semicolons (ESM, `export default` for models/routers); frontend `.ts` stores/services = single quotes + semicolons; `.vue` `<script setup>` + `router/index.ts` = single quotes, no semicolons; `types/*.ts` = double quotes.
- **DB:** tests boot the real app (`src/app.js` → Postgres sync + migrations + seeds). Prereq: dev Postgres up (`docker-compose -f docker-compose.dev.yml up postgres -d`). Vitest sets `NODE_ENV=test`; `test.fileParallelism` is off (suite convention). Existing suite passes before Task 1.
- **Test hygiene:** all created rows get unique names via the `Date.now()`/counter suffix pattern used by `sales-concurrency.test.js`; every test file cleans up what it creates (transactions before users/drinks, then keys, then users/drinks).
- **Single-file test runs:** `pnpm --filter @beerswipe/backend test -- test/<file>.test.js`; full suite: `pnpm --filter @beerswipe/backend test`.
- **Commit discipline:** one commit per task, message format below (add `Co-Authored-By: Claude Code <noreply@anthropic.com>` trailer).

---

### Task 1: Shared contract types

**Files:**
- Create: `types/src/apiKeys.ts`
- Modify: `types/src/index.ts` (add one re-export line)

**Interfaces:**
- Consumes: `ISODateString` from `types/src/common.js`.
- Produces: `ApiKeyScope`, `ApiKey`, `ApiKeyListItem`, `CreateApiKeyRequest`, `CreateApiKeyResponse`, `ListApiKeysResponse`, `RevokeApiKeyResponse` (re-exported from `@beerswipe/types`). Consumed by Task 7 (frontend service/store). Backend does not import these.

- [ ] **Step 1: Add the module file**

`types/src/apiKeys.ts` (double quotes; follow `users.ts` conventions):

```ts
import type { ISODateString } from "./common.js";

export type ApiKeyScope = "admin" | "seller";

// Persisted API key metadata. The plaintext key is never stored; the hash
// never leaves the backend. The plaintext is returned exactly once, in the
// POST /api-keys response, as CreateApiKeyResponse.key.
export interface ApiKey {
  id: number;
  name: string;
  prefix: string;            // first 12 chars ("bsk_" + 8 hex), for display + lookup
  scope: ApiKeyScope;
  createdBy: number;         // User id of the creating admin
  isRevoked: boolean;
  expiresAt: ISODateString | null;
  lastUsedAt: ISODateString | null;
  createdAt: ISODateString;
}

// List row: the creating admin joined in for the "created by" column.
export interface ApiKeyListItem extends ApiKey {
  creator: { id: number; username: string };
}

export interface CreateApiKeyRequest {
  name: string;
  scope?: ApiKeyScope;
  expiresAt?: ISODateString;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string;               // one-time plaintext, "bsk_…"
}

export interface ListApiKeysResponse {
  apiKeys: ApiKeyListItem[];
}

export interface RevokeApiKeyResponse {
  message: string;
}
```

- [ ] **Step 2: Re-export from the package index**

In `types/src/index.ts`, add (alphabetical, after `admin.js`):

```ts
export * from "./apiKeys.js";
```

- [ ] **Step 3: Typecheck the package**

Run: `pnpm run typecheck:types` and `pnpm run build:types` from repo root
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add types/src/apiKeys.ts types/src/index.ts
git commit -m "feat(types): add API key contract types (BS-122)"
```

---

### Task 2: Key crypto utils

**Files:**
- Create: `backend/src/utils/apiKeyCrypto.js`
- Test: `backend/test/apiKeyUtils.test.js` (pure unit test — imports no app, no DB)

**Interfaces:**
- Consumes: `node:crypto` only.
- Produces: `generateApiKey() → "bsk_"+32hex`, `hashApiKey(key) → 64-hex sha256`, `apiKeyPrefix(key) → first 12 chars`. Consumed by Tasks 3–6 (middleware + routes + tests).

- [ ] **Step 1: Write the failing test**

`backend/test/apiKeyUtils.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
} from "../src/utils/apiKeyCrypto.js";

describe("api key crypto utils", () => {
  it("generates bsk_ keys with 32 hex chars of entropy", () => {
    const key = generateApiKey();
    expect(key.startsWith("bsk_")).toBe(true);
    expect(key).toHaveLength(4 + 32);
    expect(key.slice(4)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });

  it("hashes deterministically to a 64-char hex digest", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toBe(key);
  });

  it("extracts the 12-char prefix used for display and lookup", () => {
    const key = generateApiKey();
    expect(apiKeyPrefix(key)).toBe(key.slice(0, 12));
    expect(apiKeyPrefix(key)).toMatch(/^bsk_[0-9a-f]{8}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyUtils.test.js`
Expected: FAIL — module not found (`../src/utils/apiKeyCrypto.js`).

- [ ] **Step 3: Implement the utils module**

`backend/src/utils/apiKeyCrypto.js`:

```js
import { createHash, randomBytes } from "node:crypto";

// Plaintext format: "bsk_" + 32 hex chars = 128 bits of entropy.
export const API_KEY_PREFIX = "bsk_";
export const API_KEY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8; // 12: display + lookup narrowing

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function hashApiKey(apiKey) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function apiKeyPrefix(apiKey) {
  return apiKey.slice(0, API_KEY_PREFIX_LENGTH);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyUtils.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/apiKeyCrypto.js backend/test/apiKeyUtils.test.js
git commit -m "feat(backend): api key generation and sha-256 hashing utils (BS-122)"
```

---

### Task 3: ApiKey model, associations, migration step

**Files:**
- Create: `backend/src/models/ApiKey.js`
- Create: `backend/test/apiKeyModel.test.js`
- Modify: `backend/src/models/index.js` (import, 2 associations, export)
- Modify: `backend/src/migrate.js` (append one step to `MIGRATIONS`)

**Interfaces:**
- Consumes: `hashApiKey`/`apiKeyPrefix`/`generateApiKey` (Task 2); `sequelize` from `../config/database.js`.
- Produces: `ApiKey` model (`id,name,keyHash,prefix,scope,createdBy,isRevoked,expiresAt,lastUsedAt,createdAt,updatedAt`; table name `ApiKeys`) exported from `../models/index.js`, with `creator` association to `User`. Consumed by Tasks 4–6.

- [ ] **Step 1: Write the failing model test**

`backend/test/apiKeyModel.test.js` (imports the app so sync creates the table, like the suite does):

```js
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js"; // boots Postgres sync + migrations + seeds
import { ApiKey, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created = { keys: [], users: [], drinks: [] };

afterAll(async () => {
  await ApiKey.destroy({ where: { id: created.keys } });
  await User.destroy({ where: { id: created.users } });
});

describe("ApiKey model", () => {
  it("stores hash + prefix and links to the creating admin", async () => {
    const admin = await User.create({
      username: `key-admin-${uniqueSuffix()}`,
      userType: "admin",
      isActive: true,
    });
    created.users.push(admin.id);

    const plaintext = generateApiKey();
    const row = await ApiKey.create({
      name: "Model test key",
      scope: "seller",
      keyHash: hashApiKey(plaintext),
      prefix: apiKeyPrefix(plaintext),
      createdBy: admin.id,
    });
    created.keys.push(row.id);

    const found = await ApiKey.findByPk(row.id, {
      include: [{ model: User, as: "creator", attributes: ["id", "username"] }],
    });

    expect(found.name).toBe("Model test key");
    expect(found.scope).toBe("seller");
    expect(found.isRevoked).toBe(false);
    expect(found.keyHash).toBe(hashApiKey(plaintext));
    expect(found.prefix).toBe(apiKeyPrefix(plaintext));
    expect(found.createdBy).toBe(admin.id);
    expect(found.creator.username).toBe(admin.username);
    expect(found.keyHash).not.toBe(plaintext);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyModel.test.js`
Expected: FAIL — module not found (`../src/models/index.js` has no `ApiKey` export).

- [ ] **Step 3: Implement the model**

`backend/src/models/ApiKey.js` (mirror `User.js` style):

```js
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Long-lived programmatic credential. Only the SHA-256 digest (keyHash) and a
// 12-char display prefix are stored — the plaintext key is shown once at
// creation and never persisted or logged.
const ApiKey = sequelize.define("ApiKey", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  },
  keyHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  prefix: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },
  scope: {
    type: DataTypes.ENUM("admin", "seller"),
    allowNull: false,
    defaultValue: "admin",
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default ApiKey;
```

- [ ] **Step 4: Register model + associations in `models/index.js`**

`backend/src/models/index.js` — add the import at the top of the import block:

```js
import ApiKey from "./ApiKey.js";
```

Add the associations next to the existing `User.hasMany(Passkey, …)` block:

```js
User.hasMany(ApiKey, {
  foreignKey: "createdBy",
  as: "apiKeys",
});

ApiKey.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});
```

And the export list becomes:

```js
export {
  ApiKey,
  Drink,
  Passkey,
  Transaction,
  User,
};
```

- [ ] **Step 5: Add the idempotent migration step**

`backend/src/migrate.js` — append this object to the `MIGRATIONS` array (after the `drinks-isAlcohol` step; `DataTypes` is already imported):

```js
  {
    name: "2026-09-03/api-keys",
    up: async (queryInterface) => {
      let table;
      try {
        table = await queryInterface.describeTable("ApiKeys");
      }
      catch {
        table = null;
      }
      // sync({ alter: false }) already creates missing tables from the model on
      // boot; this step exists for databases whose schema is not driven by sync
      // and for manual `node src/migrate.js` runs. Model and step stay in lockstep.
      if (table) {
        return false;
      }
      await queryInterface.createTable("ApiKeys", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        keyHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        prefix: { type: DataTypes.STRING(12), allowNull: false },
        scope: {
          type: DataTypes.ENUM("admin", "seller"),
          allowNull: false,
          defaultValue: "admin",
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
        },
        isRevoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        expiresAt: { type: DataTypes.DATE, allowNull: true },
        lastUsedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      return true;
    },
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyModel.test.js`
Expected: PASS (1 test). The app boots, sync creates `ApiKeys`, the row round-trips with the `creator` join.

Run: `pnpm --filter @beerswipe/backend test`
Expected: PASS — full existing suite still green (model registration + enum + new table break nothing).

- [ ] **Step 7: Lint + commit**

Run: `pnpm --filter @beerswipe/backend run lint`
Expected: eslint fixes nothing and exits 0.

```bash
git add backend/src/models/ApiKey.js backend/src/models/index.js backend/src/migrate.js backend/test/apiKeyModel.test.js
git commit -m "feat(backend): ApiKey model, associations and migration (BS-122)"
```

---

### Task 4: API-key auth middleware + adoption on all protected routes

**Files:**
- Modify: `backend/src/middleware/auth.js` (add `authenticateApiKey` + `authenticateRequest`; extend imports)
- Modify (guard swap `authenticateToken` → `authenticateRequest` — import line + every route guard, exactly the occurrences below):
  - `backend/src/api/auth.js` (line ~3 import; line ~122 `/me`)
  - `backend/src/api/users.js` (line ~6 import; lines ~62, 141, 228, 303, 413, 572, 725)
  - `backend/src/api/drinks.js` (line ~6 import; lines ~57, 258, 349, 437, 533, 669)
  - `backend/src/api/sales.js` (line ~4 import; lines ~127, 336, 475, 619)
  - `backend/src/api/leaderboard.js` (line ~4 import; lines ~81, 191)
  - `backend/src/api/passkeys.js` (line ~3 import; lines ~58, 145, 459, 513, 595)
  - `backend/src/api/admin.js` (line ~3 import; lines ~48, 105, 186, 302, 407, 517)
- Create: `backend/test/apiKeyAuth.test.js`

**Interfaces:**
- Consumes: `ApiKey`/`User` models (Task 3), `hashApiKey`/`apiKeyPrefix` (Task 2).
- Produces: `authenticateApiKey(req,res,next)` (sets `req.user` = creator User with `userType` overlaid to key scope, sets `req.apiKey` metadata, throttled `lastUsedAt` touch, `401 { error: "Invalid API key" }` on every failure) and `authenticateRequest(req,res,next)` (JWT-present → `authenticateToken`; else `X-API-Key` → `authenticateApiKey`; else `401 { error: "Access token required" }`). Every route module imports `authenticateRequest` instead of `authenticateToken`.

- [ ] **Step 1: Write the failing integration tests**

`backend/test/apiKeyAuth.test.js` — exercises `/api/v1/auth/me` (the lightest protected route) and `POST /api/v1/sales/sell`:

```js
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { ApiKey, Drink, Transaction, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created = { keys: [], users: [], drinks: [], transactions: [] };

async function createAdmin() {
  const admin = await User.create({
    username: `key-admin-${uniqueSuffix()}`,
    userType: "admin",
    isActive: true,
  });
  created.users.push(admin.id);
  return admin;
}

// Inserts a key row directly (the /api-keys routes arrive in Task 5).
async function seedKey(admin, { scope = "admin", isRevoked = false, expiresAt = null } = {}) {
  const plaintext = generateApiKey();
  const row = await ApiKey.create({
    name: `Seed key ${uniqueSuffix()}`,
    scope,
    keyHash: hashApiKey(plaintext),
    prefix: apiKeyPrefix(plaintext),
    createdBy: admin.id,
    isRevoked,
    expiresAt,
  });
  created.keys.push(row.id);
  return { plaintext, row };
}

async function createSellableUserAndDrink() {
  const user = await User.create({
    username: `key-buyer-${uniqueSuffix()}`,
    credits: 100,
    isActive: true,
  });
  created.users.push(user.id);
  const drink = await Drink.create({
    name: `Key drink ${uniqueSuffix()}`,
    price: 10,
    stock: 10,
    isActive: true,
    isAlcohol: false,
  });
  created.drinks.push(drink.id);
  return { user, drink };
}

afterAll(async () => {
  await Transaction.destroy({ where: { id: created.transactions } });
  await ApiKey.destroy({ where: { id: created.keys } });
  await Drink.destroy({ where: { id: created.drinks } });
  await User.destroy({ where: { id: created.users } });
});

describe("API key authentication", () => {
  it("rejects requests with no credential at all (unchanged 401)", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Access token required" });
  });

  it("authenticates /me with a valid key, honoring the key scope", async () => {
    const admin = await createAdmin();
    const { plaintext } = await seedKey(admin, { scope: "seller" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("X-API-Key", plaintext);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: admin.id,
      username: admin.username,
      userType: "seller", // overlay: creator is admin, key scope is seller
      credits: admin.credits,
    });
  });

  it("treats unknown, revoked and expired keys as identical 401s", async () => {
    const admin = await createAdmin();
    const { plaintext: goodKey } = await seedKey(admin);
    const { plaintext: revokedKey } = await seedKey(admin, { isRevoked: true });
    const { plaintext: expiredKey } = await seedKey(admin, { expiresAt: new Date(Date.now() - 60_000) });
    const unknownKey = `bsk_${"0".repeat(32)}`;
    const badKeys = [unknownKey, revokedKey, expiredKey, "not-a-key"];

    // sanity: the good key works
    const ok = await request(app).get("/api/v1/auth/me").set("X-API-Key", goodKey);
    expect(ok.status).toBe(200);

    for (const key of badKeys) {
      const res = await request(app).get("/api/v1/auth/me").set("X-API-Key", key);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid API key" });
    }
  });

  it("lets an admin-scoped key sell and attributes the sale to the creator admin", async () => {
    const admin = await createAdmin();
    const { plaintext } = await seedKey(admin, { scope: "admin" });
    const { user, drink } = await createSellableUserAndDrink();

    const res = await request(app)
      .post("/api/v1/sales/sell")
      .set("X-API-Key", plaintext)
      .send({ userId: user.id, drinkId: drink.id, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.transaction.admin).toEqual({ id: admin.id, username: admin.username });
    expect(JSON.stringify(res.body)).not.toContain(plaintext);

    const sale = await Transaction.findOne({
      where: { type: "sale", userId: user.id },
      order: [["id", "DESC"]],
    });
    created.transactions.push(sale.id);
    expect(sale.adminId).toBe(admin.id);
  });

  it("keeps cookie auth working and never falls back past a presented JWT", async () => {
    const admin = await createAdmin();
    const token = generateToken(admin);
    const { plaintext } = await seedKey(admin);

    // Valid cookie + bogus key header: cookie wins (browser context).
    const cookieWins = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`authToken=${token}`])
      .set("X-API-Key", `bsk_${"f".repeat(32)}`);
    expect(cookieWins.status).toBe(200);
    expect(cookieWins.body.userType).toBe("admin");

    // Invalid JWT + valid key: the presented-but-invalid JWT fails (403), no fallback.
    const jwtWins = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", ["authToken=definitely-not-a-token"])
      .set("X-API-Key", plaintext);
    expect(jwtWins.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyAuth.test.js`
Expected: FAIL — all key-authenticated requests get `401 Access token required` (routes still use `authenticateToken`); the module also fails to import (`authenticateRequest` doesn't exist yet — auth.js exports only the old names, so route swaps in Step 5 can't resolve). If the import error hides everything, implement Steps 3–4 first, then re-run to see the guard failures before Step 6.

- [ ] **Step 3: Implement `authenticateApiKey` and `authenticateRequest`**

`backend/src/middleware/auth.js` — replace the import block (first 3 lines) with:

```js
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { env } from "../env.js";
import { ApiKey, User } from "../models/index.js";
import { apiKeyPrefix, hashApiKey } from "../utils/apiKeyCrypto.js";
```

Append after `authenticateToken` (before `requireAdmin`) — `authenticateToken` itself is untouched:

```js
// lastUsedAt is throttled to one write per minute per key so high-frequency
// clients (e.g. a kiosk selling) don't write on every request.
const LAST_USED_THROTTLE_MS = 60 * 1000;

export async function authenticateApiKey(req, res, next) {
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const apiKey = await ApiKey.findOne({
      where: {
        prefix: apiKeyPrefix(apiKeyHeader),
        keyHash: hashApiKey(apiKeyHeader),
      },
    });

    if (!apiKey || apiKey.isRevoked || (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now())) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const user = await User.findByPk(apiKey.createdBy);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // The key acts as the admin who created it, restricted to the key's scope.
    // Overlay userType on this per-request instance so inline checks (e.g. the
    // seller undo window in sales.js) behave consistently. Routes only read
    // req.user fields; nothing persists this change.
    user.userType = apiKey.scope;
    req.user = user;
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      scope: apiKey.scope,
      prefix: apiKey.prefix,
      createdBy: apiKey.createdBy,
    };

    // Throttled touch: only write lastUsedAt when it is null or older than 60s.
    const throttleBefore = new Date(Date.now() - LAST_USED_THROTTLE_MS);
    await ApiKey.update(
      { lastUsedAt: new Date() },
      {
        where: {
          id: apiKey.id,
          [Op.or]: [
            { lastUsedAt: null },
            { lastUsedAt: { [Op.lt]: throttleBefore } },
          ],
        },
      },
    );

    return next();
  }
  catch (error) {
    console.error("API key auth error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Combined guard: cookie/Bearer JWT if one is presented (today's behavior,
// including 403 for a presented-but-invalid JWT), else X-API-Key, else 401.
export function authenticateRequest(req, res, next) {
  const bearer = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (req.cookies?.authToken || bearer) {
    return authenticateToken(req, res, next);
  }
  if (req.headers["x-api-key"]) {
    return authenticateApiKey(req, res, next);
  }
  return res.status(401).json({ error: "Access token required" });
}
```

- [ ] **Step 4: Export the new middleware (keep existing export list intact)**

In `backend/src/middleware/auth.js` the functions are plain `export async function` / `export function` declarations, so the existing `export` lines already cover the new functions — verify there is no separate export block; if there is one, add `authenticateApiKey, authenticateRequest` to it.

- [ ] **Step 5: Swap the guard on every protected route module**

In each file below, replace the import of `authenticateToken` with `authenticateRequest` and replace **every** guard occurrence `authenticateToken,` / `authenticateToken )` / `authenticateToken, async` with `authenticateRequest` in the route definitions (keep `requireAdmin` / `requireAdminOrSeller` / `generateToken` imports as-is). Do NOT touch `backend/src/middleware/auth.js` itself.

| File | Import line currently | Route guards to swap |
|---|---|---|
| `api/auth.js` | `import { authenticateToken, generateToken } from "../middleware/auth.js";` | `/me` |
| `api/users.js` | `import { authenticateToken, requireAdmin, requireAdminOrSeller } from "../middleware/auth.js";` | `/` (GET), `/export-csv`, `/:id` (GET), `/` (POST), `/:id/add-credits`, `/import-csv`, `/:id` (PUT) |
| `api/drinks.js` | `import { authenticateToken, requireAdmin } from "../middleware/auth.js";` | `/export-csv`, `/` (POST), `/:id` (PUT), `/:id/add-stock`, `/import-csv`, `/:id` (DELETE) |
| `api/sales.js` | `import { authenticateToken, requireAdmin, requireAdminOrSeller } from "../middleware/auth.js";` | `/sell`, `/history`, `/stats`, `/undo/:transactionId` |
| `api/leaderboard.js` | `import { authenticateToken } from "../middleware/auth.js";` | `/monthly`, `/rank/:userId` |
| `api/passkeys.js` | `import { authenticateToken, generateToken, requireAdmin } from "../middleware/auth.js";` | `/register-options`, `/register-verify`, `/` (GET), `/:id` (DELETE), `/:id` (PUT) |
| `api/admin.js` | `import { authenticateToken, generateToken, requireAdmin } from "../middleware/auth.js";` | `/` (GET), `/profile` (GET), `/profile` (PUT), `/` (POST), `/:id` (PUT), `/:id` (DELETE) |

After the swap, verify with grep that only `backend/src/middleware/auth.js` still mentions `authenticateToken`:

```bash
grep -rn "authenticateToken" backend/src --include="*.js" | grep -v "src/middleware/auth.js"
```

Expected: no output.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeyAuth.test.js`
Expected: PASS (5 tests). If some 401-body assertion differs, keep the middleware's error strings exactly as coded above (`"Access token required"`, `"Invalid API key"`).

Run: `pnpm --filter @beerswipe/backend test`
Expected: PASS — full existing suite green with the guard swap (login/logout/undo/CSV/etc. all still cookie-authenticated).

- [ ] **Step 7: Lint + commit**

Run: `pnpm --filter @beerswipe/backend run lint`
Expected: exits 0.

```bash
git add backend/src/middleware/auth.js backend/src/api/auth.js backend/src/api/users.js backend/src/api/drinks.js backend/src/api/sales.js backend/src/api/leaderboard.js backend/src/api/passkeys.js backend/src/api/admin.js backend/test/apiKeyAuth.test.js
git commit -m "feat(backend): X-API-Key auth via combined authenticateRequest middleware (BS-122)"
```

---

### Task 5: API keys management routes + validation + OpenAPI docs

**Files:**
- Create: `backend/src/api/apiKeys.js`
- Create: `backend/test/apiKeys.test.js`
- Modify: `backend/src/api/index.js` (mount route)
- Modify: `backend/src/validation/contracts.js` (2 schemas)
- Modify: `backend/src/api-docs.js` (component schemas, `apiKeyHeader` security scheme, "Api Keys" tag, info note)
- Modify: `backend/src/api/sales.js` (`/sell` `@openapi` security block lists both schemes)
- Modify: `backend/test/docs.test.js` (`EXPECTED_OPERATIONS`)

**Interfaces:**
- Consumes: `authenticateRequest` + `requireAdmin` (Task 4), `ApiKey`/`User` models (Task 3), `generateApiKey`/`hashApiKey`/`apiKeyPrefix` (Task 2), types shapes (Task 1) as the response contract.
- Produces: zod schemas `createApiKeySchema`, `apiKeyIdParamSchema` (from `../validation/contracts.js`); router default export mounted at `/api-keys` under `/api/v1`; routes `GET /`, `POST /`, `POST /:id/revoke`, `DELETE /:id`. All responses follow the types in `types/src/apiKeys.ts`. Consumed by Task 6 (end-to-end tests) and Task 8's API service.

- [ ] **Step 1: Write the failing management tests**

`backend/test/apiKeys.test.js`:

```js
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { ApiKey, Drink, Transaction, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created = { keys: [], users: [], drinks: [], transactions: [] };

async function createAdmin(userType = "admin") {
  const admin = await User.create({
    username: `mgmt-${userType}-${uniqueSuffix()}`,
    userType,
    isActive: true,
  });
  created.users.push(admin.id);
  return admin;
}

function cookieFor(user) {
  return [`authToken=${generateToken(user)}`];
}

afterAll(async () => {
  // Dependency order: sales rows first, then keys, drinks, users.
  await Transaction.destroy({ where: { id: created.transactions } });
  await ApiKey.destroy({ where: { id: created.keys } });
  await Drink.destroy({ where: { id: created.drinks } });
  await User.destroy({ where: { id: created.users } });
});

describe("POST /api/v1/api-keys", () => {
  it("creates a key, returning the plaintext exactly once", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Kiosk bar" });

    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^bsk_[0-9a-f]{32}$/);
    expect(res.body.apiKey).toEqual({
      id: expect.any(Number),
      name: "Kiosk bar",
      prefix: res.body.key.slice(0, 12),
      scope: "admin", // default
      createdBy: admin.id,
      isRevoked: false,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: expect.any(String),
    });
    created.keys.push(res.body.apiKey.id);

    // Never returned again anywhere
    const list = await request(app)
      .get("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(res.body.key);
  });

  it("accepts seller scope and a future expiry, echoing an ISO timestamp", async () => {
    const admin = await createAdmin();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Kiosk upstairs", scope: "seller", expiresAt });

    expect(res.status).toBe(201);
    expect(res.body.apiKey.scope).toBe("seller");
    expect(res.body.apiKey.expiresAt).toBe(expiresAt);
    created.keys.push(res.body.apiKey.id);
  });

  it("rejects invalid payloads with 400", async () => {
    const admin = await createAdmin();
    const cases = [
      { name: "" },
      { name: "x".repeat(51) },
      { name: "Fine", expiresAt: "2020-01-01T00:00:00.000Z" }, // past
      { name: "Fine", scope: "superuser" }, // invalid enum
    ];
    for (const body of cases) {
      const res = await request(app)
        .post("/api/v1/api-keys")
        .set("Cookie", cookieFor(admin))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it("is admin-only: seller cookie 403, no cookie 401", async () => {
    const seller = await createAdmin("seller");
    const forbidden = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(seller))
      .send({ name: "Nope" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Admin access required" });

    const anon = await request(app).post("/api/v1/api-keys").send({ name: "Nope" });
    expect(anon.status).toBe(401);
  });
});

describe("GET /api/v1/api-keys", () => {
  it("lists keys with creator usernames and never hashes", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "List me" });
    created.keys.push(create.body.apiKey.id);

    const res = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(res.status).toBe(200);
    const row = res.body.apiKeys.find((k) => k.id === create.body.apiKey.id);
    expect(row).toMatchObject({
      name: "List me",
      prefix: create.body.key.slice(0, 12),
      scope: "admin",
      creator: { id: admin.id, username: admin.username },
      isRevoked: false,
    });
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(create.body.key);
    expect(bodyText).not.toContain("keyHash");
  });
});

describe("POST /api/v1/api-keys/:id/revoke", () => {
  it("soft-deletes a key and tolerates double revoke", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Revoke me" });
    const id = create.body.apiKey.id;
    created.keys.push(id);

    const revoke = await request(app)
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set("Cookie", cookieFor(admin));
    expect(revoke.status).toBe(200);
    expect(revoke.body).toEqual({ message: "API key revoked" });

    const again = await request(app)
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set("Cookie", cookieFor(admin));
    expect(again.status).toBe(200);

    const list = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(list.body.apiKeys.find((k) => k.id === id).isRevoked).toBe(true);
  });

  it("404s on an unknown id", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post("/api/v1/api-keys/99999999/revoke")
      .set("Cookie", cookieFor(admin));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/api-keys/:id", () => {
  it("hard-deletes a key", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Delete me" });
    const id = create.body.apiKey.id;

    const del = await request(app).delete(`/api/v1/api-keys/${id}`).set("Cookie", cookieFor(admin));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ message: "API key deleted" });

    const list = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(list.body.apiKeys.find((k) => k.id === id)).toBeUndefined();
  });

  it("404s on an unknown id", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .delete("/api/v1/api-keys/99999999")
      .set("Cookie", cookieFor(admin));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeys.test.js`
Expected: FAIL — 404/`Cannot POST /api/v1/api-keys` (route not mounted yet).

- [ ] **Step 3: Add the zod schemas**

`backend/src/validation/contracts.js` — append:

```js
export const apiKeyScopeEnum = z.enum(["admin", "seller"]);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(50),
  scope: apiKeyScopeEnum.optional().default("admin"),
  expiresAt: z.coerce.date().optional(),
}).refine(
  (data) => data.expiresAt === undefined || data.expiresAt.getTime() > Date.now(),
  { message: "expiresAt must be in the future", path: ["expiresAt"] },
);

export const apiKeyIdParamSchema = z.coerce.number().int().positive();
```

- [ ] **Step 4: Implement the route module**

`backend/src/api/apiKeys.js`:

```js
import express from "express";
import { authenticateRequest, requireAdmin } from "../middleware/auth.js";
import { ApiKey, User } from "../models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../utils/apiKeyCrypto.js";
import { apiKeyIdParamSchema, createApiKeySchema } from "../validation/contracts.js";

const router = express.Router();

// Public shape helpers — the plaintext key and its hash never leave the
// server through these (POST / includes the key once, on creation only).
function serializeApiKey(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scope: row.scope,
    createdBy: row.createdBy,
    isRevoked: row.isRevoked,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeApiKeyListItem(row) {
  return {
    ...serializeApiKey(row),
    creator: { id: row.creator.id, username: row.creator.username },
  };
}

function parseKeyId(req, res) {
  const parsed = apiKeyIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid key id" });
    return null;
  }
  return parsed.data;
}

/**
 * @openapi
 * /api-keys:
 *   get:
 *     summary: List API keys
 *     description: >
 *       All API keys with their creator usernames. Hashes and plaintext keys
 *       are never returned.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: Key list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKeys:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/ApiKeyListItem" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const rows = await ApiKey.findAll({
      include: [
        { model: User, as: "creator", attributes: ["id", "username"], required: true },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json({ apiKeys: rows.map(serializeApiKeyListItem) });
  }
  catch (error) {
    console.error("List API keys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys:
 *   post:
 *     summary: Create an API key
 *     description: >
 *       Creates a key for a programmatic client. The plaintext key is
 *       returned in `key` exactly once — it is only stored as a SHA-256 hash.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/CreateApiKeyRequest" }
 *     responses:
 *       201:
 *         description: Key created (plaintext shown once)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey: { $ref: "#/components/schemas/ApiKey" }
 *                 key:
 *                   type: string
 *                   description: One-time plaintext key, e.g. "bsk_ab12…"
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const parsedBody = createApiKeySchema.safeParse(req.body);
    if (!parsedBody.success) {
      const { issues } = parsedBody.error;
      return res.status(400).json({
        error: issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
      });
    }

    const { name, scope, expiresAt } = parsedBody.data;
    const key = generateApiKey();

    const row = await ApiKey.create({
      name,
      scope,
      keyHash: hashApiKey(key),
      prefix: apiKeyPrefix(key),
      createdBy: req.user.id,
      expiresAt: expiresAt || null,
    });

    res.status(201).json({ apiKey: serializeApiKey(row), key });
  }
  catch (error) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     description: Soft-deletes a key (isRevoked). Revoking twice is a no-op success.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Key revoked
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       400:
 *         description: Invalid key id
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Key not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/:id/revoke", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const id = parseKeyId(req, res);
    if (id === null) {
      return;
    }

    const [updated] = await ApiKey.update({ isRevoked: true }, { where: { id } });
    if (updated === 0) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key revoked" });
  }
  catch (error) {
    console.error("Revoke API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: >
 *       Hard-deletes a key row (tidy-up for revoked keys). Deleting an active
 *       key is equivalent to revoke + delete.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Key deleted
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       400:
 *         description: Invalid key id
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Key not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.delete("/:id", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const id = parseKeyId(req, res);
    if (id === null) {
      return;
    }

    const deleted = await ApiKey.destroy({ where: { id } });
    if (deleted === 0) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key deleted" });
  }
  catch (error) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 5: Mount the router**

`backend/src/api/index.js` — add the import next to the other route imports:

```js
import apiKeys from "./apiKeys.js";
```

Add next to the other `router.use` lines (after `/users` keeps the docs grouping tidy):

```js
router.use("/api-keys", apiKeys);
```

- [ ] **Step 6: OpenAPI — schemas, security scheme, tag, info note**

`backend/src/api-docs.js`:

(a) Add these component schema constants above the `schemas` object (after `passkeySchema`):

```js
const apiKeySchema = {
  type: "object",
  description: "API key metadata (plaintext is shown once at creation and never stored)",
  properties: {
    id: { type: "integer" },
    name: { type: "string", maxLength: 50 },
    prefix: { type: "string", description: 'First 12 chars, e.g. "bsk_ab12cd34"' },
    scope: { type: "string", enum: ["admin", "seller"] },
    createdBy: { type: "integer", description: "User id of the creating admin" },
    isRevoked: { type: "boolean" },
    expiresAt: { type: "string", format: "date-time", nullable: true },
    lastUsedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "name", "prefix", "scope", "createdBy", "isRevoked", "expiresAt", "lastUsedAt", "createdAt"],
};

const apiKeyListItemSchema = {
  type: "object",
  description: "API key list row with the creating admin joined",
  properties: {
    ...apiKeySchema.properties,
    creator: {
      type: "object",
      properties: {
        id: { type: "integer" },
        username: { type: "string" },
      },
      required: ["id", "username"],
    },
  },
  required: [...apiKeySchema.required, "creator"],
};

const createApiKeyRequestSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50 },
    scope: { type: "string", enum: ["admin", "seller"], default: "admin" },
    expiresAt: { type: "string", format: "date-time", description: "Optional; must be in the future" },
  },
  required: ["name"],
};
```

(b) Add the three names to the `schemas` object:

```js
  ApiKey: apiKeySchema,
  ApiKeyListItem: apiKeyListItemSchema,
  CreateApiKeyRequest: createApiKeyRequestSchema,
```

(c) Add the security scheme next to `authToken` inside `components.securitySchemes`:

```js
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Long-lived API key created on the admin /api-keys page. Every endpoint that accepts the authToken cookie also accepts X-API-Key; the key acts as the admin who created it, restricted to the key's scope.",
        },
```

(d) Extend the `info.description` string (append after the existing sentence about the cookie):

```js
        + "\n\nAlternatively, programmatic clients authenticate with an "
        + "`X-API-Key` header instead of the cookie — see `POST /api-keys` "
        + "to mint one. Any endpoint accepting the `authToken` cookie also "
        + "accepts `X-API-Key`, except the unauthenticated auth endpoints.",
```

(e) Add a tag to the `tags` array:

```js
      { name: "Api Keys", description: "Long-lived API keys for programmatic clients" },
```

(f) In `backend/src/api/sales.js`, extend only the `/sell` docblock's `security` block (leave every other route's security block as `authToken` only):

```js
 *     security:
 *       - authToken: []
 *       - apiKeyHeader: []
```

- [ ] **Step 7: Update `EXPECTED_OPERATIONS` in `docs.test.js`**

`backend/test/docs.test.js` — inside the `EXPECTED_OPERATIONS` array, after the `// admin` block:

```js
  // api keys
  ["/api-keys", "get"],
  ["/api-keys", "post"],
  ["/api-keys/{id}/revoke", "post"],
  ["/api-keys/{id}", "delete"],
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeys.test.js`
Expected: PASS (9 tests).

Run: `pnpm --filter @beerswipe/backend test -- test/docs.test.js`
Expected: PASS (documents every endpoint incl. the 4 new operations; securitySchemes assertions unaffected).

Run: `pnpm --filter @beerswipe/backend test`
Expected: PASS — full suite green.

- [ ] **Step 9: Lint + commit**

Run: `pnpm --filter @beerswipe/backend run lint`
Expected: exits 0.

```bash
git add backend/src/api/apiKeys.js backend/src/api/index.js backend/src/validation/contracts.js backend/src/api-docs.js backend/src/api/sales.js backend/test/apiKeys.test.js backend/test/docs.test.js
git commit -m "feat(backend): API key management routes with OpenAPI docs (BS-122)"
```

---

### Task 6: End-to-end key auth tests (regression)

**Files:**
- Modify: `backend/test/apiKeys.test.js` (append two describes — no production code changes in this task)

**Interfaces:**
- Consumes: everything from Tasks 2–5. No new production exports.

- [ ] **Step 1: Write the end-to-end regression tests**

Append to `backend/test/apiKeys.test.js` (inside the existing `created`/helper scope — the `created.keys` array is already destroyed in `afterAll`):

```js
describe("X-API-Key end-to-end", () => {
  it("sells with an admin-scoped key minted via the API, recording the creator", async () => {
    const admin = await createAdmin();

    const mint = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "E2E admin key", scope: "admin" });
    const plaintext = mint.body.key;
    const keyId = mint.body.apiKey.id;

    const buyer = await User.create({
      username: `e2e-buyer-${uniqueSuffix()}`,
      credits: 100,
      isActive: true,
    });
    created.users.push(buyer.id);
    const drink = await Drink.create({
      name: `E2E drink ${uniqueSuffix()}`,
      price: 10,
      stock: 10,
      isActive: true,
      isAlcohol: false,
    });
    created.drinks.push(drink.id);

    // Admin-scoped key can sell AND manage keys.
    const sell = await request(app)
      .post("/api/v1/sales/sell")
      .set("X-API-Key", plaintext)
      .send({ userId: buyer.id, drinkId: drink.id, quantity: 1 });
    expect(sell.status).toBe(200);
    expect(JSON.stringify(sell.body)).not.toContain(plaintext);

    const sale = await Transaction.findOne({
      where: { type: "sale", userId: buyer.id },
      order: [["id", "DESC"]],
    });
    created.transactions.push(sale.id);
    expect(sale.adminId).toBe(admin.id);

    const manage = await request(app).get("/api/v1/api-keys").set("X-API-Key", plaintext);
    expect(manage.status).toBe(200);

    // lastUsedAt was touched by the requests above.
    const row = await ApiKey.findByPk(keyId);
    expect(row.lastUsedAt).not.toBeNull();

    const revoke = await request(app)
      .post(`/api/v1/api-keys/${keyId}/revoke`)
      .set("Cookie", cookieFor(admin));
    expect(revoke.status).toBe(200);

    // Revoked keys stop working on every route.
    const afterRevoke = await request(app)
      .post("/api/v1/sales/sell")
      .set("X-API-Key", plaintext)
      .send({ userId: buyer.id, drinkId: drink.id, quantity: 1 });
    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.body).toEqual({ error: "Invalid API key" });
  });

  it("restricts seller-scoped keys to seller routes (403 on management)", async () => {
    const admin = await createAdmin();
    const mint = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "E2E seller key", scope: "seller" });
    const plaintext = mint.body.key;

    const buyer = await User.create({
      username: `e2e-buyer-${uniqueSuffix()}`,
      credits: 100,
      isActive: true,
    });
    created.users.push(buyer.id);
    const drink = await Drink.create({
      name: `E2E drink ${uniqueSuffix()}`,
      price: 10,
      stock: 10,
      isActive: true,
      isAlcohol: false,
    });
    created.drinks.push(drink.id);

    const sell = await request(app)
      .post("/api/v1/sales/sell")
      .set("X-API-Key", plaintext)
      .send({ userId: buyer.id, drinkId: drink.id, quantity: 1 });
    expect(sell.status).toBe(200);

    const sale = await Transaction.findOne({
      where: { type: "sale", userId: buyer.id },
      order: [["id", "DESC"]],
    });
    created.transactions.push(sale.id);

    const manage = await request(app).get("/api/v1/api-keys").set("X-API-Key", plaintext);
    expect(manage.status).toBe(403);
    expect(manage.body).toEqual({ error: "Admin access required" });
  });

  it("rejects hard-deleted and past-expiry keys with the same 401", async () => {
    const admin = await createAdmin();

    const mint = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Delete me e2e" });
    const deletedKey = mint.body.key;
    const deletedId = mint.body.apiKey.id;

    const del = await request(app)
      .delete(`/api/v1/api-keys/${deletedId}`)
      .set("Cookie", cookieFor(admin));
    expect(del.status).toBe(200);

    const gone = await request(app).get("/api/v1/auth/me").set("X-API-Key", deletedKey);
    expect(gone.status).toBe(401);
    expect(gone.body).toEqual({ error: "Invalid API key" });

    const expiredPlaintext = generateApiKey();
    const expiredRow = await ApiKey.create({
      name: "Expired seed",
      scope: "admin",
      keyHash: hashApiKey(expiredPlaintext),
      prefix: apiKeyPrefix(expiredPlaintext),
      createdBy: admin.id,
      expiresAt: new Date(Date.now() - 60_000),
    });
    created.keys.push(expiredRow.id);

    const expired = await request(app).get("/api/v1/auth/me").set("X-API-Key", expiredPlaintext);
    expect(expired.status).toBe(401);
    expect(expired.body).toEqual({ error: "Invalid API key" });
  });
});
```

Note: the file header from Task 5 already statically imports `ApiKey, Drink, Transaction, User` and the crypto utils, and its `created` object + `afterAll` already cover `keys`, `users`, `drinks` and `transactions` — the tests above need no header changes.

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @beerswipe/backend test -- test/apiKeys.test.js`
Expected: PASS (12 tests — 9 from Task 5 + 3 end-to-end).

Run: `pnpm --filter @beerswipe/backend test`
Expected: PASS — full suite green.

- [ ] **Step 3: Commit**

```bash
git add backend/test/apiKeys.test.js
git commit -m "test(backend): end-to-end API key auth regression coverage (BS-122)"
```

---

### Task 7: Frontend API module + store

**Files:**
- Modify: `frontend/src/services/api.ts` (append `apiKeysAPI`)
- Create: `frontend/src/stores/apiKeys.ts`

**Interfaces:**
- Consumes: `types.ApiKeyScope/…` from `@beerswipe/types` (Task 1), `axios api` instance from `../services/api.js`.
- Produces: `apiKeysAPI = { getAll, create, revoke, remove }`; Pinia store `useApiKeysStore` with actions `listApiKeys`, `createApiKey`, `revokeApiKey`, `removeApiKey` (each returns `Promise<StoreActionResult<T>>`; mutations refetch the list; the plaintext key is returned to the caller and never kept in state). Consumed by Task 8.

- [ ] **Step 1: Add the API module**

`frontend/src/services/api.ts` — append after `leaderboardAPI` (before `export default api;`):

```ts
export const apiKeysAPI = {
  getAll: () => api.get<types.ListApiKeysResponse>('/api-keys'),

  create: (data: types.CreateApiKeyRequest) => api.post<types.CreateApiKeyResponse>('/api-keys', data),

  revoke: (id: number) => api.post<types.RevokeApiKeyResponse>(`/api-keys/${id}/revoke`),

  remove: (id: number) => api.delete<types.RevokeApiKeyResponse>(`/api-keys/${id}`),
};
```

- [ ] **Step 2: Add the store**

`frontend/src/stores/apiKeys.ts` (options-style, mirroring `stores/users.ts`):

```ts
import { defineStore } from 'pinia';
import type {
  ApiKeyListItem,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  StoreActionResult,
} from '@beerswipe/types';
import { apiKeysAPI } from '../services/api.js';

interface ApiKeysState {
  apiKeys: ApiKeyListItem[];
  loading: boolean;
  error: string | null;
}

export const useApiKeysStore = defineStore('apiKeys', {
  state: (): ApiKeysState => ({
    apiKeys: [],
    loading: false,
    error: null,
  }),

  actions: {
    async listApiKeys(): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.getAll();
        this.apiKeys = response.data.apiKeys;
        return { success: true };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to fetch API keys';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createApiKey(data: CreateApiKeyRequest): Promise<StoreActionResult<CreateApiKeyResponse>> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.create(data);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to create API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async revokeApiKey(id: number): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.revoke(id);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to revoke API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async removeApiKey(id: number): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.remove(id);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to delete API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm run typecheck:types` (root) and `pnpm --filter @beerswipe/frontend run typecheck` and `pnpm --filter @beerswipe/frontend run build`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/stores/apiKeys.ts
git commit -m "feat(frontend): api keys service module and pinia store (BS-122)"
```

---

### Task 8: Frontend view, modal, route, nav links

**Files:**
- Create: `frontend/src/views/ApiKeysView.vue`
- Create: `frontend/src/components/CreateApiKeyModal.vue`
- Modify: `frontend/src/router/index.ts` (import + route)
- Modify: `frontend/src/components/Navigation/DesktopNavbar.vue` (one link)
- Modify: `frontend/src/components/Navigation/MobileNavbar.vue` (one link)

**Interfaces:**
- Consumes: `useApiKeysStore` (Task 7), `Modal.vue` (props `show/title/closable/closeOnOverlay`, emits `close`), `useNotifications()`.
- Produces: admin-only page at `/api-keys`; `CreateApiKeyModal` with two phases (form → one-time key reveal) driven by props `{ show, created }` and emits `{ close, submit }` where `submit` payload is `CreateApiKeyRequest` (`{ name, scope, expiresAt? }`) and `created` is `CreateApiKeyResponse | null`.

- [ ] **Step 1: Create the modal component**

`frontend/src/components/CreateApiKeyModal.vue` (plain JS `<script setup>`, style matches `CreateUserModal.vue`; the reveal phase disables overlay/Escape closing so the one-time key cannot be lost accidentally):

```vue
<template>
  <Modal
    :show="show"
    :title="isReveal ? 'API Key Created' : 'Create API Key'"
    :closable="!isReveal"
    :close-on-overlay="!isReveal"
    @close="emit('close')"
  >
    <form v-if="!isReveal" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="apiKeyName">Name:</label>
        <input
          id="apiKeyName"
          v-model="form.name"
          type="text"
          maxlength="50"
          placeholder="e.g. Kiosk bar"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="apiKeyScope">Scope:</label>
        <select id="apiKeyScope" v-model="form.scope" class="form-input">
          <option value="admin">Admin — full access as the creating admin</option>
          <option value="seller">Seller — sell and history access only</option>
        </select>
      </div>

      <div class="form-group">
        <label for="apiKeyExpiry">Expires (optional):</label>
        <input
          id="apiKeyExpiry"
          v-model="form.expiryDate"
          type="date"
          :min="todayString"
          class="form-input"
        />
      </div>

      <p class="hint">
        The key is shown once after creation and cannot be retrieved again.
      </p>
    </form>

    <div v-else class="reveal">
      <p class="reveal-warning">
        ⚠️ Copy this key now — it will not be shown again.
      </p>
      <div class="key-box">
        <code class="key-text">{{ created.key }}</code>
        <button type="button" class="btn" @click="copyKey">
          {{ copied ? '✓ Copied' : 'Copy' }}
        </button>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <template v-if="!isReveal">
          <button type="button" @click="emit('close')" class="btn btn-secondary">Cancel</button>
          <button type="button" @click="handleSubmit" class="btn" :disabled="submitting">
            {{ submitting ? 'Creating...' : 'Create Key' }}
          </button>
        </template>
        <button v-else type="button" class="btn" @click="emit('close')">
          I've saved the key
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  created: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'submit'])

const submitting = ref(false)
const copied = ref(false)

const form = reactive({
  name: '',
  scope: 'admin',
  expiryDate: ''
})

const isReveal = computed(() => props.created !== null)

const todayString = new Date().toISOString().split('T')[0]

// Send the date as local end-of-day so an expiry chosen for "today" does not
// expire the moment it is created (UTC offset aside).
const handleSubmit = () => {
  if (submitting.value) return
  submitting.value = true
  const payload = {
    name: form.name.trim(),
    scope: form.scope
  }
  if (form.expiryDate) {
    const [y, m, d] = form.expiryDate.split('-').map(Number)
    payload.expiresAt = new Date(y, m - 1, d, 23, 59, 59).toISOString()
  }
  emit('submit', payload)
}

const copyKey = async () => {
  if (!props.created) return
  const key = props.created.key
  try {
    await navigator.clipboard.writeText(key)
  } catch {
    // Fallback for non-secure contexts (http on the LAN)
    const ta = document.createElement('textarea')
    ta.value = key
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// Reset the form when the modal opens; the parent re-enables submitting.
watch(() => props.show, (open) => {
  if (open) {
    submitting.value = false
    copied.value = false
    Object.assign(form, { name: '', scope: 'admin', expiryDate: '' })
  }
})
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-light-grey);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-input-bg);
  color: var(--color-light-grey);
}

.form-input:focus {
  outline: none;
  border-color: var(--green-7);
}

.hint {
  color: var(--color-medium-grey);
  font-size: 0.85rem;
  margin-top: 1rem;
}

.reveal-warning {
  color: var(--color-light-grey);
  font-weight: 600;
  margin-bottom: 1rem;
}

.key-box {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: rgba(34, 34, 34, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.key-text {
  font-family: monospace;
  font-size: 1rem;
  word-break: break-all;
  flex: 1;
  color: var(--color-white);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
```

- [ ] **Step 2: Create the view**

`frontend/src/views/ApiKeysView.vue` (mirrors `UsersView.vue` structure):

```vue
<template>
  <div class="api-keys-view">
    <div class="api-keys-header">
      <h1>API Keys</h1>
      <div class="header-actions">
        <button @click="openCreateModal" class="btn">
          Create API Key
        </button>
      </div>
    </div>

    <p class="page-hint">
      Long-lived credentials for programmatic clients (kiosk, third-party
      integrations). Each key acts as the admin who created it, limited to its
      scope. The plaintext key is shown once, at creation.
    </p>

    <div class="api-keys-table">
      <div v-if="apiKeysStore.loading" class="loading">Loading API keys...</div>
      <div v-else-if="apiKeysStore.apiKeys.length === 0" class="no-data">
        No API keys yet. Create one for each kiosk or integration.
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Scope</th>
            <th>Created by</th>
            <th>Created</th>
            <th>Last used</th>
            <th>Expires</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in apiKeysStore.apiKeys" :key="key.id" :class="{ muted: isInactive(key) }">
            <td>{{ key.name }}</td>
            <td><code class="key-mask">{{ key.prefix }}****</code></td>
            <td>
              <span class="scope" :class="key.scope">
                {{ key.scope }}
              </span>
            </td>
            <td>{{ key.creator.username }}</td>
            <td>{{ formatDate(key.createdAt) }}</td>
            <td>{{ formatDate(key.lastUsedAt) }}</td>
            <td>{{ formatDate(key.expiresAt) }}</td>
            <td>
              <span class="status" :class="statusClass(key)">
                {{ statusText(key) }}
              </span>
            </td>
            <td>
              <div class="actions">
                <button
                  v-if="!key.isRevoked"
                  @click="confirmRevoke(key)"
                  class="btn small"
                  title="Revoke key"
                >
                  Revoke
                </button>
                <button
                  v-if="key.isRevoked"
                  @click="confirmDelete(key)"
                  class="btn small danger"
                  title="Delete key"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CreateApiKeyModal
      :show="showCreateModal"
      :created="createdKey"
      @close="closeCreateModal"
      @submit="handleCreateApiKey"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useApiKeysStore } from '../stores/apiKeys'
import { useNotifications } from '@/composables/useNotifications'
import CreateApiKeyModal from '../components/CreateApiKeyModal.vue'

const apiKeysStore = useApiKeysStore()
const { showSuccess, showError } = useNotifications()

const showCreateModal = ref(false)
const createdKey = ref(null)

const isExpired = (key) => key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()
const isInactive = (key) => key.isRevoked || isExpired(key)

const statusText = (key) => {
  if (key.isRevoked) return 'Revoked'
  if (isExpired(key)) return 'Expired'
  return 'Active'
}

const statusClass = (key) => {
  if (key.isRevoked) return 'revoked'
  if (isExpired(key)) return 'expired'
  return 'active'
}

const formatDate = (value) => {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

const openCreateModal = () => {
  createdKey.value = null
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createdKey.value = null
}

const handleCreateApiKey = async (payload) => {
  const result = await apiKeysStore.createApiKey(payload)
  if (result.success) {
    createdKey.value = result.data
    // Modal stays open on the one-time reveal phase; the store already refreshed the list.
  } else {
    showError(result.error)
    closeCreateModal()
  }
}

const confirmRevoke = async (key) => {
  if (!window.confirm(`Revoke API key "${key.name}"? Clients using it will immediately lose access.`)) return
  const result = await apiKeysStore.revokeApiKey(key.id)
  if (result.success) {
    showSuccess(`API key "${key.name}" revoked`)
  } else {
    showError(result.error)
  }
}

const confirmDelete = async (key) => {
  if (!window.confirm(`Permanently delete API key "${key.name}"? This cannot be undone.`)) return
  const result = await apiKeysStore.removeApiKey(key.id)
  if (result.success) {
    showSuccess(`API key "${key.name}" deleted`)
  } else {
    showError(result.error)
  }
}

onMounted(() => {
  apiKeysStore.listApiKeys()
})
</script>

<style scoped>
.api-keys-view {
  max-width: 1400px;
  margin: 0 auto;
}

.api-keys-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.api-keys-header h1 {
  font-size: var(--font-size-4xl);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.page-hint {
  color: var(--color-medium-grey);
  max-width: 70ch;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .api-keys-header {
    flex-direction: column;
    align-items: stretch;
  }

  .api-keys-header h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .header-actions {
    justify-content: flex-start;
  }
}

.api-keys-table {
  background: var(--color-black);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e1e1e1;
}

th {
  background: var(--green-3);
  font-weight: 600;
  color: var(--color-white);
}

tr.muted {
  opacity: 0.6;
}

.key-mask {
  font-family: monospace;
  color: var(--color-light-grey);
}

.scope {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.scope.admin {
  background: var(--red-9);
  color: white;
}

.scope.seller {
  background: var(--blue-9);
  color: white;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status.active {
  background: var(--color-green);
  color: var(--color-white);
}

.status.revoked {
  background: var(--color-grey);
  color: var(--color-white);
}

.status.expired {
  background: var(--orange-9);
  color: white;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  background: var(--green-3);
  color: var(--color-white);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn:hover {
  background: var(--green-5);
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
}

.btn.danger {
  background: var(--red-8);
}

.btn.danger:hover {
  background: var(--red-9);
}

.loading,
.no-data {
  text-align: center;
  color: var(--color-medium-grey);
  padding: 3rem;
}
</style>
```

- [ ] **Step 3: Register the route**

`frontend/src/router/index.ts` — add the import next to the other view imports:

```ts
import ApiKeysView from '../views/ApiKeysView.vue'
```

Add the route after the `/drinks` route object:

```ts
  {
    path: '/api-keys',
    name: 'api-keys',
    component: ApiKeysView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
```

- [ ] **Step 4: Add the navbar links**

`frontend/src/components/Navigation/DesktopNavbar.vue` — insert after the Drinks `RouterLink` (currently line ~41):

```html
            <RouterLink v-if="authStore.isAdmin" to="/api-keys" class="navbar-link">API Keys</RouterLink>
```

`frontend/src/components/Navigation/MobileNavbar.vue` — insert after the Drinks `RouterLink` (currently line ~67):

```html
        <RouterLink v-if="authStore.isAdmin" to="/api-keys" class="mobile-nav-link" @click="handleNavClick">API Keys</RouterLink>
```

- [ ] **Step 5: Verify typecheck + build**

Run: `pnpm --filter @beerswipe/frontend run typecheck` and `pnpm --filter @beerswipe/frontend run build`
Expected: both exit 0. (Manual browser smoke test is optional at this step; the full manual gate is Task 9.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/ApiKeysView.vue frontend/src/components/CreateApiKeyModal.vue frontend/src/router/index.ts frontend/src/components/Navigation/DesktopNavbar.vue frontend/src/components/Navigation/MobileNavbar.vue
git commit -m "feat(frontend): API keys admin page with one-time key reveal modal (BS-122)"
```

---

### Task 9: Docs + full verification gate

**Files:**
- Modify: `backend/README.md` (API Keys subsection)

**Interfaces:**
- Consumes: all prior tasks. No production code.

- [ ] **Step 1: Document API keys in the backend README**

`backend/README.md` — the file is stale per AGENTS.md; add a new "API Keys" section (do not rewrite the rest of the file in this task). Find the auth documentation area (or append before the endpoint list) and add:

```markdown
## API Keys

Programmatic clients (the kiosk, third-party integrations) authenticate with a
long-lived API key instead of a login session:

- Create keys in the web UI on the **API Keys** page (admin only). The
  plaintext key (`bsk_…`) is shown **exactly once** at creation and is only
  stored as a SHA-256 hash — a lost key must be revoked and recreated.
- Send it on every request: `X-API-Key: bsk_…`. Any endpoint that accepts the
  `authToken` cookie also accepts `X-API-Key` (except the unauthenticated
  auth endpoints).
- A key acts as the admin who created it (`Transaction.adminId` records that
  admin), restricted to the key's scope: `admin` (everything) or `seller`
  (sell + history only).
- A leaked key is neutralized by revoking it on the API Keys page — do this
  immediately. Never put keys in URLs or logs; use HTTPS everywhere.

Management endpoints (admin only, cookie or admin-scoped key):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/api-keys` | List keys (name, masked prefix, scope, creator, status) |
| POST | `/api/v1/api-keys` | Create a key: `{ name, scope?, expiresAt? }` → returns the plaintext `key` once |
| POST | `/api/v1/api-keys/:id/revoke` | Revoke a key (soft delete) |
| DELETE | `/api/v1/api-keys/:id` | Hard-delete a key row |

Provision one key per kiosk ("Kiosk bar", "Kiosk upstairs") so each device can
be revoked individually; the kiosk reads its key from its own config.
```

- [ ] **Step 2: Full verification gate**

Run, from the repo root, in order:

```bash
pnpm --filter @beerswipe/backend run lint
pnpm --filter @beerswipe/backend test
pnpm run typecheck:types
pnpm run build:types
pnpm --filter @beerswipe/frontend run typecheck
pnpm --filter @beerswipe/frontend run build
```

Expected: every command exits 0 (backend lint may auto-fix; re-run tests if it changes files).

- [ ] **Step 3: Manual smoke test**

With the dev stack running (backend on `:8080`, frontend on `:5173`, Postgres up):

1. Log in as admin → "API Keys" appears in the navbar → open `/api-keys` (empty state).
2. Create a key named "Smoke test" (scope Admin) → plaintext key shown once with a Copy button → copy it → "I've saved the key" → the row appears (masked `bsk_…****`).
3. `curl -X POST http://localhost:8080/api/v1/sales/sell -H "X-API-Key: <key>" -H "Content-Type: application/json" -d '{"userId":1,"drinkId":1,"quantity":1}'` → 200 (repeat with a revoked key → 401).
4. Revoke the key in the UI → repeat the curl → `401 {"error":"Invalid API key"}`.
5. Cookie flows unchanged: login/logout, sales page, users page all work.

- [ ] **Step 4: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): document API keys and X-API-Key auth (BS-122)"
```

---

## Definition of done

- [ ] All tasks committed on `BS-122-API-key-management`
- [ ] Full gate (Task 9, Step 2) green
- [ ] Manual smoke test (Task 9, Step 3) passes
- [ ] `docs.test.js` covers the 4 new routes; the Swagger spec exposes `apiKeyHeader` and the Api Keys schemas
- [ ] Spec decisions honored: SHA-256 only, plaintext once, keys on all protected routes, scope overlay, no rate limiter / rotate endpoint (deferred)
