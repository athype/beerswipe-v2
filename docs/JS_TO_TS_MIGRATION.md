# JavaScript → TypeScript Migration Guide

## Overview

This document is the step-by-step playbook for migrating both **backend** and **frontend** from JavaScript to TypeScript. The shared `types/` package is already fully in TypeScript — it serves as the foundation for everything below.

### Current landscape

| Package | Language | Files to migrate |
|---------|----------|------------------|
| `types/` | ✅ TypeScript (done) | 0 |
| `backend/` | JavaScript (ESM) | 22 source + 3 scripts/migrations |
| `frontend/` | JavaScript (ESM, Vue SFC) | 12 `.js` + ~40 `.vue` SFCs |

### Migration principles

- **Incremental adoption.** TypeScript can coexist with JavaScript in the same project via `allowJs: true`. Rename one file at a time, verify, commit.
- **Start with the easiest wins.** Files that already import typed contracts or have JSDoc annotations convert trivially.
- **Backend and frontend are independent.** Migrate them in parallel — they share only the already-typed `@beerswipe/types` package.
- **No `strict: true` on day one.** Start with `strict: false`, tighten incrementally.
- **Runtime behavior must not change.** This is a type-level migration only.

---

## Phase 0 — Prerequisites

### 0.1 Install TypeScript

```bash
# Backend — @types/* packages only (typescript is already resolved via the workspace)
pnpm --filter @beerswipe/backend add -D @types/node @types/express @types/cookie-parser @types/cors @types/morgan @types/bcryptjs @types/jsonwebtoken @types/multer

# Frontend — vue-tsc only (typescript is already resolved via the workspace)
pnpm --filter @beerswipe/frontend add -D vue-tsc @types/node
```

> **Note:** `typescript` itself does **not** need to be installed in backend or frontend. The `@beerswipe/types` package already depends on `typescript ^5.8.3`, and pnpm resolves it across the workspace — `pnpm tsc --version` already works from both `backend/` and `frontend/`. You can verify this yourself:
>
> ```bash
> pnpm --filter @beerswipe/backend exec tsc --version   # ✅
> pnpm --filter @beerswipe/frontend exec tsc --version  # ✅
> ```
>
> If you prefer an explicit dependency (e.g. to pin a specific version independently of `types/`), add `-D typescript` to either command — it won't hurt, just adds a redundant entry to `devDependencies`.

### 0.2 Add tsconfig to backend

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "src/**/*.js"],
  "exclude": ["dist", "node_modules"]
}
```

Key choices:
- `module: "NodeNext"` — matches the existing ESM pattern and `types/` tsconfig.
- `allowJs: true` — lets `.js` and `.ts` coexist during migration.
- `checkJs: false` — don't type-check existing JS files (too noisy). Enable later.
- `strict: false` — start loose, tighten after migration is complete.

### 0.3 Convert frontend jsconfig.json → tsconfig.json

Rename `frontend/jsconfig.json` → `frontend/tsconfig.json` and merge in TypeScript-specific fields:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/views/*": ["./src/views/*"],
      "@/stores/*": ["./src/stores/*"],
      "@/composables/*": ["./src/composables/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.vue",
    "src/**/*.js",
    "src/**/*.jsx"
  ],
  "exclude": ["node_modules", "dist", "public"],
  "vueCompilerOptions": {
    "target": 3
  }
}
```

### 0.4 Add type-check scripts

**Backend `package.json`:**
```jsonc
{
  "scripts": {
    // … existing …
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "typecheck:watch": "tsc -p tsconfig.json --noEmit --watch"
  }
}
```

**Frontend `package.json`:**
```jsonc
{
  "scripts": {
    // … existing …
    "typecheck": "vue-tsc --noEmit",
    "typecheck:watch": "vue-tsc --noEmit --watch"
  }
}
```

**Root `package.json`:**
```jsonc
{
  "scripts": {
    // … existing …
    "typecheck": "pnpm -r run typecheck"
  }
}
```

### 0.5 Add Vue shims for frontend

Create `frontend/src/env.d.ts` (Vite + Vue type declarations):

```ts
/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_PORT?: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 0.6 Verify baseline

```bash
pnpm run typecheck:types   # should still pass (already green)
pnpm --filter @beerswipe/backend run typecheck   # expected: many errors — OK, we'll fix them
pnpm --filter @beerswipe/frontend run typecheck  # expected: many errors — OK
```

If `tsc` reports zero errors because `checkJs: false` and there are no `.ts` files yet, that's fine — the pipeline is in place, ready for the first `.ts` file.

---

## Phase 1 — Frontend API Client (easiest win)

**Why first:** `frontend/src/services/api.js` already imports types from `@beerswipe/types` via JSDoc `@typedef`. Converting to `.ts` is mostly deleting JSDoc and adding `: Type` annotations. It also immediately type-checks all store code that calls these API functions.

### 1.1 Rename and convert

Rename `api.js` → `api.ts`. Then:

1. Remove all `@typedef` JSDoc comments (lines 3–26).
2. Replace `@param {Type}` JSDoc with TypeScript parameter types.
3. Add explicit return types to each API method.
4. Fix the `import.meta.env` access (use `ImportMetaEnv` from the shim).

**Before (JSDoc):**
```js
/**
 * @typedef {import('@beerswipe/types').LoginRequest} LoginRequest
 */
// …
export const authAPI = {
  /** @param {LoginRequest} credentials */
  login: (credentials) => api.post('/auth/login', credentials),
};
```

**After (TypeScript):**
```ts
import type { LoginRequest, LoginResponse } from "@beerswipe/types";
// …
export const authAPI = {
  login: (credentials: LoginRequest) =>
    api.post<LoginResponse>("/auth/login", credentials),
};
```

**Full diff reference** — the conversions for each API group:

| API group | Request types to add | Response types to add |
|-----------|---------------------|-----------------------|
| `authAPI` | `LoginRequest`, `CreateBootstrapAdminRequest` | `LoginResponse`, `CurrentUserResponse` |
| `usersAPI` | `ListUsersQuery`, `CreateUserRequest`, `UpdateUserRequest`, `UserCsvExportParams` | `ListUsersResponse`, `CreateUserResponse`, `UserResponse` |
| `drinksAPI` | `ListDrinksQuery`, `CreateDrinkRequest`, `UpdateDrinkRequest`, `DrinkCsvExportParams` | `ListDrinksResponse`, `CreateDrinkResponse`, `DrinkResponse` |
| `salesAPI` | `SellRequest`, `TransactionHistoryQuery`, `SalesStatsQuery` | `SellResponse`, `TransactionHistoryResponse`, `SalesStatsResponse`, `UndoTransactionResponse` |
| `passkeysAPI` | (browser WebAuthn types) | Registration/Login responses |
| `leaderboardAPI` | `MonthlyLeaderboardQuery`, `UserRankQuery` | `MonthlyLeaderboardResponse`, `UserRankResponse` |

### 1.2 Fix the API base URL typing

The `API_URL` construction uses `import.meta.env` — ensure it's properly typed:

```ts
const API_URL: string = import.meta.env.PROD
  ? "/api/v1"
  : `${import.meta.env.VITE_API_URL || "http://localhost"}:${import.meta.env.VITE_API_PORT || 8080}/api/v1`;
```

### 1.3 Verify

```bash
pnpm --filter @beerswipe/frontend run typecheck
```

Expect: errors in files that **call** these API functions with wrong types. Those are real bugs caught immediately — fix them now or in Phase 2 when converting stores.

---

## Phase 2 — Frontend Pinia Stores

**Why second:** Stores call the typed API client from Phase 1. Converting them surfaces type mismatches between what the API returns and what the store expects.

### 2.1 Migration order (dependency-aware)

Convert in this order so each file's imports are already typed:

| # | File | Depends on |
|---|------|------------|
| 1 | `stores/auth.js` → `auth.ts` | `api.ts` |
| 2 | `stores/users.js` → `users.ts` | `api.ts` |
| 3 | `stores/drinks.js` → `drinks.ts` | `api.ts` |
| 4 | `stores/sales.js` → `sales.ts` | `api.ts` |
| 5 | `stores/leaderboard.js` → `leaderboard.ts` | `api.ts` |
| 6 | `stores/passkey.js` → `passkey.ts` | `api.ts` |
| 7 | `stores/admin.js` → `admin.ts` | `api.ts` |
| 8 | `stores/counter.js` → `counter.ts` | none (scaffold) |

### 2.2 Pattern: options store → typed options store

**Before (`auth.js`):**
```js
import { defineStore } from "pinia";
import { authAPI } from "../services/api.js";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),
  // …
});
```

**After (`auth.ts`):**
```ts
import { defineStore } from "pinia";
import type { AuthUser } from "@beerswipe/types";
import { authAPI } from "../services/api.js";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  }),

  getters: {
    isAdmin: (state): boolean => state.user?.userType === "admin",
    isSeller: (state): boolean => state.user?.userType === "seller",
    isAdminOrSeller: (state): boolean =>
      state.user?.userType === "admin" || state.user?.userType === "seller",
  },

  actions: {
    async login(credentials): Promise<StoreActionResult> {
      // …
    },
    // …
  },
});
```

> **Import paths:** Keep `.js` extensions during migration. The TS compiler with `allowJs` and `moduleResolution: "Bundler"` resolves them fine. Once all files are `.ts`, a follow-up PR can switch imports to `.ts` or drop extensions (Vite handles both).

### 2.3 Common issues to watch for

- **`state.user` is `null` initially** — every getter that accesses `state.user?.x` returns `T | undefined`. That's correct; the getter already handles it with optional chaining.
- **`StoreActionResult` from `@beerswipe/types`** — use it as the return type of async actions:
  ```ts
  import type { StoreActionResult } from "@beerswipe/types";
  async login(credentials: LoginRequest): Promise<StoreActionResult> { … }
  ```
- **`error.response?.data?.error`** — Axios errors are typed as `unknown`. Add a type guard or use `as` cast temporarily. A proper Axios error interceptor type is in Phase 9.

### 2.4 Verify

```bash
pnpm --filter @beerswipe/frontend run typecheck
```

---

## Phase 3 — Frontend Router & Composables

### 3.1 Router (`router/index.js` → `index.ts`)

Add typed route meta:

```ts
import type { RouteRecordRaw } from "vue-router";

// Extend vue-router's RouteMeta
declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresAdminOrSeller?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
    meta: { requiresAuth: true, requiresAdminOrSeller: true },
  },
  // …
];
```

### 3.2 Composables (`useNotifications.js` → `useNotifications.ts`)

These are usually small — add return types and parameter types.

```ts
import { ref } from "vue";

interface Notification {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export function useNotifications() {
  const notifications = ref<Notification[]>([]);
  // …
  return { notifications, addNotification, removeNotification };
}
```

### 3.3 Main entry (`main.js` → `main.ts`)

Update the import paths from `.js` to `.ts`:

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js"; // keep .js until router is .ts

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
```

> **Note:** `main.js` imports `App.vue` and other `.vue` files. These don't need extensions in imports — Vite resolves them. Keep the `.vue` extension if the current code uses it.

### 3.4 Verify

```bash
pnpm --filter @beerswipe/frontend run typecheck
pnpm --filter @beerswipe/frontend run dev   # runtime smoke test
```

---

## Phase 4 — Backend Validation Layer

**Why now:** `backend/src/validation/contracts.js` is the bridge between runtime validation (Zod) and the shared types. Converting it to TypeScript with `z.input<>` / `z.output<>` / `z.infer<>` gives you type-safe route handlers for free.

### 4.1 Rename and convert

Rename `contracts.js` → `contracts.ts`.

**Before:**
```js
import { z } from "zod";
export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
```

**After:**
```ts
import { z } from "zod/v4";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// Inferred types for use in route handlers
export type LoginRequest = z.infer<typeof loginRequestSchema>;
```

> **Zod v4 note:** Backend already imports from `zod/v4`. Keep that import path — it's the Zod 4 entry point.

### 4.2 Export inferred types for every schema

Add `z.infer` / `z.input` / `z.output` exports for each schema:

| Schema | Inferred types to export |
|--------|-------------------------|
| `loginRequestSchema` | `LoginRequest` |
| `sellRequestSchema` | `SellRequest` |
| `passkeyRegisterVerifySchema` | `PasskeyRegisterVerifyRequest` |
| `passkeyLoginOptionsSchema` | `PasskeyLoginOptionsRequest` |
| `passkeyLoginVerifySchema` | `PasskeyLoginVerifyRequest` |

### 4.3 Align with shared types

Compare the inferred Zod types against the equivalent interfaces in `@beerswipe/types`. If they differ, the shared types package is the **source of truth for API contracts** — update the Zod schemas to match. Common gaps:

- `SellRequest` in `types/src/sales.ts` has `quantity?: number` with no default. The Zod schema defaults to `1`. Both are valid, but document the difference.
- Passkey types in `types/src/passkeys.ts` are more detailed than the Zod schemas — ensure the Zod schemas validate at least what the types declare.

### 4.4 Verify

```bash
pnpm --filter @beerswipe/backend run typecheck
```

---

## Phase 5 — Backend Config & Utilities

**Why now:** These have no route dependencies and are imported everywhere. Typing them first reduces errors when we later convert routes.

### 5.1 `env.js` → `env.ts`

The `env.js` already uses `zod/v4` for validation. The conversion is minimal:

```ts
import { z } from "zod/v4";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),
  JWT_SECRET: z.string().default("your-secret-key-change-in-production"),
  FEURL: z.string().default("http://localhost"),
  FEPORT: z.coerce.number().default(5173),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("beermachine"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("your-secure-password-here"),
  RP_NAME: z.string().default("Beer-Machine"),
  RP_ID: z.string().optional(),
  DOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// eslint-disable-next-line node/no-process-env
export const env: Env = envSchema.parse(process.env);
```

### 5.2 `config/database.js` → `database.ts`

```ts
import { Sequelize } from "sequelize";
import type { Options } from "sequelize";
import { env } from "../env.js";

const sequelizeOptions: Options = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "postgres",
  logging: env.NODE_ENV === "development" ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

export const sequelize = new Sequelize(
  env.DATABASE_URL || env.DB_NAME,
  env.DB_USER,
  env.DB_PASSWORD,
  sequelizeOptions,
);

export async function initializeDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    await sequelize.sync({ alter: env.NODE_ENV === "development" });
    console.log("All models were synchronized successfully.");

    const { runSeeds } = await import("../seeds/index.js");
    await runSeeds();
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    throw error;
  }
}
```

### 5.3 `utils/webauthn.js` → `webauthn.ts`

This file uses `@simplewebauthn/server`. Types come from the library:

```ts
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server";
```

Add parameter and return types to each exported function.

### 5.4 Verify

```bash
pnpm --filter @beerswipe/backend run typecheck
```

---

## Phase 6 — Backend Middleware

### 6.1 `middleware/auth.js` → `auth.ts`

Extend the Express `Request` type to include `req.user`:

```ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { User } from "../models/index.js";
import type { AuthUser } from "@beerswipe/types";

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User & { id: number; username: string; userType: string };
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let token: string | undefined = req.cookies?.authToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader?.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: number;
      username: string;
      userType: string;
    };
    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid token or user inactive" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.userType !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireAdminOrSeller(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    !req.user ||
    (req.user.userType !== "admin" && req.user.userType !== "seller")
  ) {
    res.status(403).json({ error: "Admin or seller access required" });
    return;
  }
  next();
}

export function generateToken(user: {
  id: number;
  username: string;
  userType: string;
}): string {
  return jwt.sign(
    { id: user.id, username: user.username, userType: user.userType },
    env.JWT_SECRET,
    { expiresIn: "24h" },
  );
}
```

### 6.2 `middlewares.js` → `middlewares.ts`

```ts
import type { Request, Response, NextFunction } from "express";

export function notFound(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({ error: `Not Found - ${req.originalUrl}` });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
}
```

### 6.3 Verify

```bash
pnpm --filter @beerswipe/backend run typecheck
```

---

## Phase 7 — Backend Models (Sequelize)

**Why this is the hardest phase:** Sequelize's `define()` API has notoriously poor TypeScript inference. There are three approaches:

| Approach | Effort | Type safety | Risk |
|----------|--------|-------------|------|
| **A: Keep `define()`, add manual type declarations** | Low | Medium | Low |
| **B: Convert to class-based models extending `Model`** | High | High | Medium |
| **C: Adopt `sequelize-typescript` decorators** | High | High | High (new dependency, decorator config) |

**Recommendation: Approach A** for the migration. It's pragmatic and doesn't change runtime behavior. Approach B can be done later as a follow-up.

### 7.1 Model type pattern (Approach A)

For each model file, define:
1. **Attributes interface** — the shape of a record from the DB.
2. **Creation attributes interface** — the shape needed to create a new record (optional fields omitted).
3. **Instance interface** — the Sequelize Model instance with custom methods.

**Example: `models/User.ts`**

```ts
import bcrypt from "bcryptjs";
import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from "sequelize";
import { sequelize } from "../config/database.js";
import type { UserType } from "@beerswipe/types";

// ── Attribute interfaces ──

export interface UserAttributes {
  id: number;
  username: string;
  password: string | null;
  credits: number;
  dateOfBirth: string | null;
  userType: UserType;
  isActive: boolean;
}

export interface UserCreationAttributes
  extends Omit<UserAttributes, "id" | "credits" | "isActive"> {
  credits?: number;
  isActive?: boolean;
}

// ── Instance interface ──

export interface UserInstance
  extends Model<UserAttributes, UserCreationAttributes>,
    UserAttributes {
  validatePassword(password: string): Promise<boolean>;
  canLogin(): boolean;
  addCredits(amount: number): Promise<UserInstance>;
  deductCredits(amount: number): Promise<UserInstance>;
  addCreditsUnchecked(amount: number): Promise<UserInstance>;
  deductCreditsUnchecked(amount: number): Promise<UserInstance>;
}

// ── Model definition ──

const User = sequelize.define<UserInstance>(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: { notEmpty: true, len: [1, 50] },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { len: [6, 255] },
    },
    credits: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0 },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    userType: {
      type: DataTypes.ENUM("admin", "seller", "member", "non-member"),
      allowNull: false,
      defaultValue: "member",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    hooks: {
      beforeCreate: async (user: UserInstance) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user: UserInstance) => {
        if (user.changed("password") && user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  },
);

// ── Instance methods ──

User.prototype.validatePassword = async function (
  this: UserInstance,
  password: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

User.prototype.canLogin = function (this: UserInstance): boolean {
  return (
    (this.userType === "admin" || this.userType === "seller") &&
    this.password !== null
  );
};

User.prototype.addCredits = function (
  this: UserInstance,
  amount: number,
): Promise<UserInstance> {
  if (amount % 10 !== 0) {
    throw new Error("Credits can only be added in blocks of 10");
  }
  this.credits += amount;
  return this.save();
};

User.prototype.deductCredits = function (
  this: UserInstance,
  amount: number,
): Promise<UserInstance> {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save();
};

User.prototype.addCreditsUnchecked = function (
  this: UserInstance,
  amount: number,
): Promise<UserInstance> {
  this.credits += amount;
  return this.save();
};

User.prototype.deductCreditsUnchecked = function (
  this: UserInstance,
  amount: number,
): Promise<UserInstance> {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save();
};

export default User;
```

### 7.2 Repeat for all models

| Model | File | Notes |
|-------|------|-------|
| `User` | `models/User.ts` | Template above |
| `Drink` | `models/Drink.ts` | `isInStock()`, `deductStock()`, `addStock()` instance methods |
| `Transaction` | `models/Transaction.ts` | Associations to User (×2) and Drink |
| `Passkey` | `models/Passkey.ts` | Association to User |

### 7.3 `models/index.js` → `index.ts`

```ts
import Drink from "./Drink.js";
import Passkey from "./Passkey.js";
import Transaction from "./Transaction.js";
import User from "./User.js";
import type { UserInstance } from "./User.js";
import type { DrinkInstance } from "./Drink.js";
import type { TransactionInstance } from "./Transaction.js";
import type { PasskeyInstance } from "./Passkey.js";

// ── Associations ──

User.hasMany(Transaction, { foreignKey: "userId", as: "transactions" });
User.hasMany(Transaction, { foreignKey: "adminId", as: "processedTransactions" });
User.hasMany(Passkey, { foreignKey: "userId", as: "passkeys", onDelete: "CASCADE" });
Drink.hasMany(Transaction, { foreignKey: "drinkId", as: "transactions" });
Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });
Transaction.belongsTo(User, { foreignKey: "adminId", as: "admin" });
Transaction.belongsTo(Drink, { foreignKey: "drinkId", as: "drink" });
Passkey.belongsTo(User, { foreignKey: "userId", as: "user" });

export { Drink, Passkey, Transaction, User };
export type { DrinkInstance, PasskeyInstance, TransactionInstance, UserInstance };
```

### 7.4 Verify

```bash
pnpm --filter @beerswipe/backend run typecheck
pnpm --filter @beerswipe/backend run dev   # runtime smoke test — critical for models
```

---

## Phase 8 — Backend API Routes

**Why now:** Models, middleware, and validation are typed. Routes are the last backend piece — and the largest.

### 8.1 Migration order

Convert routes from least-dependent to most-dependent:

| # | File | Notes |
|---|------|-------|
| 1 | `api/index.js` → `index.ts` | Router aggregator |
| 2 | `api/auth.js` → `auth.ts` | Login, logout, bootstrap admin |
| 3 | `api/admin.js` → `admin.ts` | Admin CRUD |
| 4 | `api/users.js` → `users.ts` | User CRUD, import/export |
| 5 | `api/drinks.js` → `drinks.ts` | Drink CRUD, import/export |
| 6 | `api/leaderboard.js` → `leaderboard.ts` | Leaderboard queries |
| 7 | `api/passkeys.js` → `passkeys.ts` | WebAuthn endpoints |
| 8 | `api/sales.js` → `sales.ts` | Sales, history, undo |

### 8.2 Route handler pattern

```ts
import { Router, type Request, type Response } from "express";
import { authenticateToken, requireAdminOrSeller } from "../middleware/auth.js";
import { sellRequestSchema, type SellRequest } from "../validation/contracts.js";
import { User, Drink, Transaction } from "../models/index.js";

const router = Router();

router.post(
  "/sell",
  authenticateToken,
  requireAdminOrSeller,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = sellRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      res.status(400).json({ error: messages });
      return;
    }

    const { userId, drinkId, quantity } = parsed.data as SellRequest;

    const dbTransaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction: dbTransaction });
      if (!user) {
        await dbTransaction.rollback();
        res.status(404).json({ error: "User not found" });
        return;
      }

      // … business logic …

      await dbTransaction.commit();
      res.json({ message: "Sale completed successfully", transaction: { /* … */ } });
    } catch (error) {
      if (!dbTransaction.finished) await dbTransaction.rollback();
      console.error("Sale error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
```

### 8.3 Key typing points for routes

- **`req.query`** — Cast with `as` or use a type assertion. The Zod schemas already validate; for unvalidated query params, define a query interface:
  ```ts
  interface HistoryQuery {
    userId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  }
  // In handler:
  const { userId, type, startDate, endDate, page = "1", limit = "50" } =
    req.query as unknown as HistoryQuery;
  ```

- **`req.user`** — Already typed via the global Express augmentation in Phase 6. Access as `req.user!.id` or guard:
  ```ts
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const adminId = req.user.id; // narrowed
  ```

- **`req.params`** — Generic `Record<string, string>` by default. For `/:id` routes:
  ```ts
  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  ```

- **Sequelize transactions** — Cast the `transaction` variable:
  ```ts
  import type { Transaction as SequelizeTransaction } from "sequelize";
  let dbTransaction: SequelizeTransaction | null = null;
  ```

### 8.4 `api/index.js` → `index.ts`

```ts
import { Router } from "express";
import authRoutes from "./auth.js";
import adminRoutes from "./admin.js";
import usersRoutes from "./users.js";
import drinksRoutes from "./drinks.js";
import salesRoutes from "./sales.js";
import leaderboardRoutes from "./leaderboard.js";
import passkeysRoutes from "./passkeys.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/users", usersRoutes);
router.use("/drinks", drinksRoutes);
router.use("/sales", salesRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/passkeys", passkeysRoutes);

export default router;
```

### 8.5 Verify

```bash
pnpm --filter @beerswipe/backend run typecheck
pnpm --filter @beerswipe/backend run dev   # critical: run the app and test key flows
```

---

## Phase 9 — Frontend Vue Components (SFC)

**Why last:** Components depend on typed stores and typed API. Converting them earlier would mean fighting type errors from untyped dependencies.

### 9.1 Strategy: convert `<script>` → `<script setup lang="ts">`

This is the biggest file count (~40 `.vue` files) but the lowest risk. Each component conversion is mechanical:

1. Change `<script>` → `<script setup lang="ts">`
2. If the component uses Options API (`export default { … }`), consider converting to `<script setup>` (Composition API) — but this is **optional**. You can keep Options API with `<script lang="ts">`:
   ```vue
   <script lang="ts">
   import { defineComponent } from "vue";
   export default defineComponent({ … });
   </script>
   ```
3. Add types to `ref<>()`, `reactive<>()`, `computed<>()`, props with `defineProps<{}>()`, and emits with `defineEmits<{}>()`.

### 9.2 Pattern: Options API → `<script lang="ts">`

Minimal change — just add `lang="ts"` and annotate:

```vue
<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { Drink } from "@beerswipe/types";

export default defineComponent({
  props: {
    drink: {
      type: Object as PropType<Drink>,
      required: true,
    },
  },
  data(): { quantity: number } {
    return { quantity: 1 };
  },
  computed: {
    totalCost(): number {
      return this.drink.price * this.quantity;
    },
  },
});
</script>
```

### 9.3 Pattern: Composition API → `<script setup lang="ts">`

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { Drink, User } from "@beerswipe/types";
import { useDrinksStore } from "@/stores/drinks.js";

interface Props {
  drink: Drink;
  user: User;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "sold", drinkId: number): void;
  (e: "cancel"): void;
}>();

const quantity = ref<number>(1);
const totalCost = computed<number>(() => props.drink.price * quantity.value);

onMounted((): void => {
  console.log("Component mounted");
});
</script>
```

### 9.4 Migration order for components

Convert leaf components first (no children), then parents:

| Priority | Components |
|----------|------------|
| 1 — icons | `components/icons/*.vue` (6 files) |
| 2 — modals | `components/modals/*.vue` (3 files: `AddStock.vue`, `CreateEditDrink.vue`, `CsvExport.vue`) |
| 3 — shared | `components/*.vue` excluding `Modal.vue` |
| 4 — shell | `components/Modal.vue`, `App.vue` |
| 5 — views | `views/*.vue` (10 files) |

### 9.5 Common Vue TS patterns to apply

- **Template refs:**
  ```ts
  const inputRef = ref<HTMLInputElement | null>(null);
  ```

- **Store references:**
  ```ts
  const drinksStore = useDrinksStore();
  // `drinksStore` is already typed from Phase 2
  ```

- **Router:**
  ```ts
  import { useRouter, useRoute } from "vue-router";
  const router = useRouter();
  const route = useRoute();
  const userId = Number(route.params.id); // string → number
  ```

### 9.6 Verify

```bash
pnpm --filter @beerswipe/frontend run typecheck
pnpm --filter @beerswipe/frontend run dev    # smoke test a few views
pnpm --filter @beerswipe/frontend run build  # ensure production build works
```

---

## Phase 10 — Entry Points, Tests, Scripts & Cleanup

### 10.1 Backend entry points

| File | Action |
|------|--------|
| `src/app.js` → `app.ts` | Add Express `Application` type annotation |
| `src/index.js` → `index.ts` | Minimal change — just rename, add `void` return |

**`src/index.ts`:**
```ts
import app from "./app.js";
import { env } from "./env.js";

const port = env.PORT;

app.listen(port, (): void => {
  console.log(`Server running on port ${port}`);
});
```

### 10.2 Backend seeds

| File | Action |
|------|--------|
| `seeds/index.js` → `index.ts` | Add return types |
| `seeds/adminSeed.js` → `adminSeed.ts` | Type seed data against model creation attributes |

### 10.3 Backend scripts

| File | Action |
|------|--------|
| `scripts/seed.js` → `seed.ts` | Add types |

### 10.4 Backend migrations

Migrations are run once and are historical record — **leave them as `.js`.** If a new migration is needed, write it in TypeScript.

### 10.5 Frontend tests

| File | Action |
|------|--------|
| `src/components/__tests__/HelloWorld.spec.js` → `.ts` | Add types to test utilities |

Also update `vitest.config.js` → `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
  },
});
```

### 10.6 Cleanup: remove `allowJs`

Once **every `.js` file in `src/` has been renamed to `.ts`** and the project compiles clean:

**Backend `tsconfig.json`:**
```json
{
  "compilerOptions": {
    // "allowJs": true,        ← REMOVE
    "checkJs": false,          ← REMOVE
    "strict": true,            ← ENABLE (incrementally, see 10.7)
  },
  "include": ["src/**/*.ts"]   // ← remove *.js
}
```

**Frontend `tsconfig.json`:**
```json
{
  "compilerOptions": {
    // "allowJs": true,        ← REMOVE
    "checkJs": false,          ← REMOVE
    "strict": true,            ← ENABLE
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.vue"
    // remove *.js, *.jsx
  ]
}
```

### 10.7 Incremental strictness

Enable these flags one at a time, fixing errors after each:

```jsonc
{
  // Step 1 — already enabled via "strict": true:
  //   strictNullChecks, strictFunctionTypes, strictBindCallApply,
  //   strictPropertyInitialization, noImplicitAny, noImplicitThis

  // Step 2 — add after strict passes:
  "noUncheckedIndexedAccess": true,   // catches arr[0] being T | undefined
  "exactOptionalPropertyTypes": true, // { x?: string } means x cannot be undefined
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

---

## Package Installation Summary

### Backend — new devDependencies

```bash
pnpm --filter @beerswipe/backend add -D \
  @types/node \
  @types/express \
  @types/cookie-parser \
  @types/cors \
  @types/morgan \
  @types/bcryptjs \
  @types/jsonwebtoken \
  @types/multer
```

### Frontend — new devDependencies

```bash
pnpm --filter @beerswipe/frontend add -D \
  vue-tsc \
  @types/node
```

### Optional but recommended

| Package | Why |
|---------|-----|
| `@types/sequelize` (backend) | Sequelize types (may already be included with `sequelize` v6+) |
| `@total-typescript/ts-reset` (both) | Fixes some TS default lib type holes |

---

## Migration Checklist

### Pre-flight
- [ ] Phase 0.1: Install `@types/*` packages in backend (`typescript` already resolved via workspace)
- [ ] Phase 0.1: Install `vue-tsc`, `@types/node` in frontend (`typescript` already resolved via workspace)
- [ ] Phase 0.2: Create `backend/tsconfig.json`
- [ ] Phase 0.3: Convert `frontend/jsconfig.json` → `tsconfig.json`
- [ ] Phase 0.4: Add `typecheck` scripts to all `package.json` files
- [ ] Phase 0.5: Create `frontend/src/env.d.ts`
- [ ] Phase 0.6: Verify `pnpm run typecheck` runs (even with errors)

### Frontend
- [ ] Phase 1: `services/api.js` → `api.ts`
- [ ] Phase 2.1: `stores/auth.js` → `auth.ts`
- [ ] Phase 2.2: `stores/users.js` → `users.ts`
- [ ] Phase 2.3: `stores/drinks.js` → `drinks.ts`
- [ ] Phase 2.4: `stores/sales.js` → `sales.ts`
- [ ] Phase 2.5: `stores/leaderboard.js` → `leaderboard.ts`
- [ ] Phase 2.6: `stores/passkey.js` → `passkey.ts`
- [ ] Phase 2.7: `stores/admin.js` → `admin.ts`
- [ ] Phase 2.8: `stores/counter.js` → `counter.ts`
- [ ] Phase 3.1: `router/index.js` → `index.ts`
- [ ] Phase 3.2: `composables/useNotifications.js` → `.ts`
- [ ] Phase 3.3: `main.js` → `main.ts`
- [ ] Phase 9: All `.vue` SFCs → `<script lang="ts">` or `<script setup lang="ts">`
- [ ] Phase 10.5: Tests and configs → `.ts`
- [ ] Phase 10.6: Remove `allowJs`, enable `strict`

### Backend
- [ ] Phase 4: `validation/contracts.js` → `contracts.ts`
- [ ] Phase 5.1: `env.js` → `env.ts`
- [ ] Phase 5.2: `config/database.js` → `database.ts`
- [ ] Phase 5.3: `utils/webauthn.js` → `webauthn.ts`
- [ ] Phase 6.1: `middleware/auth.js` → `auth.ts`
- [ ] Phase 6.2: `middlewares.js` → `middlewares.ts`
- [ ] Phase 7.1: `models/User.js` → `User.ts`
- [ ] Phase 7.2: `models/Drink.js` → `Drink.ts`
- [ ] Phase 7.3: `models/Transaction.js` → `Transaction.ts`
- [ ] Phase 7.4: `models/Passkey.js` → `Passkey.ts`
- [ ] Phase 7.5: `models/index.js` → `index.ts`
- [ ] Phase 8.1: `api/index.js` → `index.ts`
- [ ] Phase 8.2: `api/auth.js` → `auth.ts`
- [ ] Phase 8.3: `api/admin.js` → `admin.ts`
- [ ] Phase 8.4: `api/users.js` → `users.ts`
- [ ] Phase 8.5: `api/drinks.js` → `drinks.ts`
- [ ] Phase 8.6: `api/leaderboard.js` → `leaderboard.ts`
- [ ] Phase 8.7: `api/passkeys.js` → `passkeys.ts`
- [ ] Phase 8.8: `api/sales.js` → `sales.ts`
- [ ] Phase 10.1: `app.js` → `app.ts`, `index.js` → `index.ts`
- [ ] Phase 10.2: Seeds → `.ts`
- [ ] Phase 10.3: `scripts/seed.js` → `.ts`
- [ ] Phase 10.4: Migrations — leave as `.js`
- [ ] Phase 10.6: Remove `allowJs`, enable `strict`

### Final
- [ ] `pnpm run typecheck` passes across all packages
- [ ] `pnpm --filter @beerswipe/backend run dev` runs without errors
- [ ] `pnpm --filter @beerswipe/frontend run build` succeeds
- [ ] Full integration smoke test (login, sell, undo, CRUD, leaderboard)
- [ ] Docker build (`docker-compose -f docker-compose.dev.yml up --build`) still works

---

## Appendix A: Import Path Conventions

During migration, the project uses these patterns:

| Context | Pattern | Example |
|---------|---------|---------|
| Backend `.ts` importing `.ts` | Keep `.js` extension | `import { env } from "../env.js";` |
| Frontend `.ts` importing `.ts` | Vite resolves without extensions | `import { useAuthStore } from "../stores/auth";` |
| Frontend `.vue` importing `.ts` | Vite resolves without extensions | `import { useAuthStore } from "@/stores/auth";` |
| All packages importing types | `@beerswipe/types` | `import type { User } from "@beerswipe/types";` |

> **Why `.js` extensions in backend?** The `NodeNext` module resolution (used by both `types/tsconfig.json` and the new `backend/tsconfig.json`) requires explicit extensions in ESM. TypeScript with `NodeNext` expects `.js` in import paths even when the source is `.ts` — this is the same pattern already used by `types/src/index.ts`.

Once migration is complete, the backend can switch to `moduleResolution: "Bundler"` (like the frontend) and drop extensions, but that's a separate change outside this migration's scope.

## Appendix B: Sequelize TypeScript Alternatives (Future)

If Approach A (typed `define()`) proves insufficient, two paths exist:

### B: Class-based models (built-in Sequelize)

```ts
import { Model, DataTypes } from "sequelize";

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare username: string;
  // …
}
```

### C: `sequelize-typescript` decorators

```bash
pnpm --filter @beerswipe/backend add sequelize-typescript
```

```ts
import { Table, Column, Model } from "sequelize-typescript";

@Table
class User extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  declare id: number;
}
```

This requires `experimentalDecorators: true` in `tsconfig.json`.

## Appendix C: Vue SFC `defineProps` with defaults

When props have defaults, use `withDefaults`:

```ts
interface Props {
  quantity?: number;
  showTotal?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  quantity: 1,
  showTotal: true,
});
```
