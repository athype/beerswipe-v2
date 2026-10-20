# JavaScript to TypeScript Migration

**Status: 2026-10-20.** This is the execution playbook for issue #35 (backend). The toolchain is live; what remains is converting files, wiring the entry points, and cleanup. Read the conventions before touching a file.

The shared `types/` package is already TypeScript and is the source of truth for API contracts.

## Current state

| Package | State | Remaining |
|---------|-------|-----------|
| `types/` | TypeScript | none |
| `frontend/` | 20 `.ts`, 0 `.js`; 5 of 49 `.vue` files use `lang="ts"` | 44 SFCs, tracked in #36 |
| `backend/` | toolchain live (#142), 3 modules converted | 28 `.js` files, 6,479 lines in `src/`, tracked in #35 |

Backend modules already converted: `src/api/scan.ts`, `src/models/ScanCode.ts`, `src/utils/scanCodeCrypto.ts`.

Baseline verified on 2026-10-20: clean `master`, frozen install, `pnpm --filter @beerswipe/backend run typecheck` reports zero errors.

## Why the previous revision was replaced

The old playbook was written before the toolchain landed in #142. It said to start with `strict: false`, keep `.js` extensions in backend imports, and complete Phase 0 and the frontend phases, all of which are already merged or tracked elsewhere. Following it today would walk the migration backwards. The live settings in `backend/tsconfig.json` are:

```json
{
  "target": "ES2023",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "lib": ["ES2023"],
  "types": ["node"],
  "strict": true,
  "noEmit": true,
  "allowJs": true,
  "checkJs": false,
  "allowImportingTsExtensions": true,
  "erasableSyntaxOnly": true,
  "verbatimModuleSyntax": true,
  "forceConsistentCasingInFileNames": true,
  "skipLibCheck": true
}
```

There is no build step. Node strips types at runtime (`engines: >=22.18.0`; Docker runs `node:24-alpine`), and `pnpm start` runs `node src/index.ts` once the entry point is converted. `allowImportingTsExtensions` exists because the stripped runtime needs the real file extension.

## Conventions

1. **Real extensions.** A converted file is imported as `./env.ts`, including from files that are still `.js`. `src/models/index.js` already imports `./ScanCode.ts`; that is the pattern.
2. **Type-only imports use `import type`.** `verbatimModuleSyntax` is on, so a value import used only as a type fails.
3. **Erasable syntax only.** No `enum`, `namespace`, parameter properties, or decorators in backend code. `erasableSyntaxOnly` enforces this. Reuse unions from `@beerswipe/types` (for example `UserType`) instead of inventing enums.
4. **Strict is already on.** Every converted file must be strict-clean immediately. Do not add `// @ts-nocheck`, and do not relax `tsconfig.json`.
5. **Keep every `@openapi` block byte-identical.** `test/docs.test.js` asserts that every route is documented, and `api-docs.js` scans `src/api/*.{js,ts}`.
6. **No behavior changes.** This migration renames files and adds types. Route order, guards, transaction handling, response shapes, and credit rules must not move.
7. **Schema changes stay in `src/migrate.js`.** Never add files to `backend/migrations/`; `002-add-passkey-support.js` is legacy and stays as-is.
8. **`tsc` does not check `.js` importers.** A missed `.js` specifier pointing at a converted file is invisible to typecheck and only fails when the app boots. The suite is the gate for import paths, so always run both.
9. **Do not reformat or rename unrelated code.** Keep diffs reviewable.

## Verification for every segment

```bash
pnpm --filter @beerswipe/backend run typecheck
pnpm --filter @beerswipe/backend test
```

The suite boots the real app, so it needs Postgres. Use the dev database (`docker-compose -f docker-compose.dev.yml up postgres -d`) or the portable Postgres recipe in the repo notes. `test.fileParallelism` is off by design; do not change it.

Lint is not a gate: the backend baseline is red (`unicorn/filename-case` fires on model and util files, plus `isNaN`, `no-dupe-keys`, `process.env`). Report the delta against the base branch only.

CI (`.github/workflows/ci.yml`) runs typecheck and tests on every PR to `master`, with a Postgres 15 service. A merge to `master` builds and deploys to production, so a segment that cannot be verified end to end does not ship.

## Segment plan

One segment per branch, per PR, per Claude Code session. Branches target `master`. Squash merge.

| # | Branch | Files | Lines | Gate |
|---|--------|-------|-------|------|
| 0 | `chore/backend-ts-types` | `backend/package.json`, `pnpm-lock.yaml` | 0 code | typecheck + suite unchanged |
| 1 | `refactor/backend-ts-foundations` | `env`, `config/database`, `middlewares` | 117 | app boots |
| 2 | `refactor/backend-ts-validation-utils` | `validation/contracts`, `utils/apiKeyCrypto`, `utils/webauthn` | 162 | suite |
| 3 | `refactor/backend-ts-models` | `models/*` (6 files) | 435 | suite, credits and sales tests |
| 4 | `refactor/backend-ts-auth-middleware` | `middleware/auth` + `src/types/express.d.ts` | 145 | auth and API-key tests, manual login |
| 5 | `refactor/backend-ts-routes-a` | `api/auth`, `api/leaderboard`, `api/apiKeys`, `api/admin` | 1,347 | suite, docs test |
| 6 | `refactor/backend-ts-routes-drinks` | `api/drinks` | 792 | drinks tests, CSV smoke |
| 7 | `refactor/backend-ts-routes-users` | `api/users` | 998 | users tests, CSV smoke |
| 8 | `refactor/backend-ts-routes-passkeys` | `api/passkeys` | 620 | passkey tests, manual register/login |
| 9 | `refactor/backend-ts-routes-sales` | `api/sales` | 971 | sales tests, manual sell/undo |
| 10 | `refactor/backend-ts-wiring` | `api/index`, `api-docs` | 494 | suite, docs test |
| 11 | `refactor/backend-ts-entrypoints` | `app`, `index`, seeds, `scripts/seed`, `migrate`, package scripts | 398 | suite, boot, migrate, Docker build |
| 12 | `chore/backend-ts-cleanup` | `tsconfig`, `AGENTS.md`, `backend/README.md` | 0 runtime | full verification |

Ordering is dependency-driven: foundations, models, auth middleware, routes, wiring, entry points. Routes go risk-ascending; sales is last because it moves credits and stock.

---

## Segment 0: dependencies

Add the type packages that the converted code will need. No source files change in this segment.

```bash
pnpm --filter @beerswipe/backend add -D \
  @types/jsonwebtoken \
  @types/cookie-parser \
  @types/cors \
  @types/morgan \
  @types/multer \
  @types/swagger-jsdoc \
  @types/swagger-ui-express
```

`csv-parser` and `helmet` ship their own declarations; do not add `@types` packages for them (`@types/csv-parser` does not exist).

Commit `backend/package.json` and `pnpm-lock.yaml` together, then confirm the baseline:

```bash
pnpm --filter @beerswipe/backend run typecheck
pnpm --filter @beerswipe/backend test
```

## Segment 1: config foundations

Scope: `src/env.js`, `src/config/database.js`, `src/middlewares.js`.

- `env.ts`: keep the Zod schema identical. Export `type Env = z.infer<typeof envSchema>`, annotate `env: Env`, and give `apiDocsEnabled()` a `boolean` return type. Keep reading live `process.env` inside `apiDocsEnabled()`, because tests toggle it at request time.
- `config/database.ts`: `initializeDatabase(): Promise<void>`. The dynamic imports of `../migrate.js` and `../seeds/index.js` stay `.js` until segment 11.
- `middlewares.ts`: `notFound` returns `void`; `errorHandler` keeps its four arguments and is typed as Express's error handler. The emoji strings and status logic do not change.

Update every importer specifier in the same commit. `env.js` has 10 importers, `database.js` has 13, `middlewares.js` has 1:

```bash
rg -n 'env\.js|config/database\.js|middlewares\.js' backend --glob '!node_modules'
```

Gate: typecheck, suite, and a real boot (`pnpm --filter @beerswipe/backend run dev` against the dev database).

## Segment 2: validation and utilities

Scope: `src/validation/contracts.js`, `src/utils/apiKeyCrypto.js`, `src/utils/webauthn.js`.

- `contracts.ts`: keep the Zod schemas semantically identical. Export inferred types only where a consumer will use them. If `z.ZodIssueCode.custom` is flagged in Zod 4, use the `"custom"` literal; that is not a behavior change.
- `apiKeyCrypto.ts`: annotate the hash and prefix helpers as returning `string`, and keep the `node:crypto` usage identical.
- `webauthn.ts`: type the in-memory challenge store (`Map` with an expiry entry) and the `@simplewebauthn/server` option objects. If a library type is narrower than runtime reality, declare a local input type; do not fall back to `any`.

Importer counts: `contracts` 7, `apiKeyCrypto` 7, `webauthn` 1.

Gate: typecheck and the suite, with attention to `apiKeyUtils`, `apiKeyAuth`, `apiKeyModel`, `apiKeys` and `passkeys`.

## Segment 3: models

Scope: `src/models/User.js`, `Drink.js`, `Transaction.js`, `Passkey.js`, `ApiKey.js`, `index.js`.

- `User.ts` and `Drink.ts` carry instance methods and domain invariants, so type them:

```ts
export interface UserInstance
  extends Model<UserAttributes, UserCreationAttributes>, UserAttributes {
  validatePassword: (password: string) => Promise<boolean>;
  canLogin: () => boolean;
  // ...
}

const User = sequelize.define<UserInstance, UserAttributes>("User", { /* ... */ });

// Sequelize 6 types the prototype as Model<any, any>; cast once for the assignments.
const userPrototype = User.prototype as UserInstance;
userPrototype.validatePassword = async function (password: string): Promise<boolean> {
  // ...
};
```

The second generic is required. `sequelize.define<UserInstance>` alone infers `Model<any, any>` and every prototype assignment fails. Verify this against the installed typings before changing the pattern.

- `Transaction.ts`, `Passkey.ts`, `ApiKey.ts` are data-only: keep `define()` with no generics and export an attribute interface for call sites.
- `models/index.ts` holds the associations. Keep every association, alias and `onDelete` identical. This file has 21 importers, so update them all in the same commit.
- Typed creation attributes surface two existing test helpers that pass `userType: string`: `test/drinks-restock.test.ts:31` and `test/scanCodes.test.ts:33`. Change the helper parameter to `UserType` from `@beerswipe/types`.

Gate: typecheck and the suite, especially credits, sales and scan-code tests. Do not change hooks or method semantics to satisfy the compiler.

## Segment 4: auth middleware

Scope: `src/middleware/auth.js` plus a new `src/types/express.d.ts`.

- Declare the request augmentation in one place:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: UserInstance;
      apiKey?: {
        id: number;
        name: string;
        scope: "admin" | "seller";
        prefix: string;
        createdBy: number;
      };
    }
  }
}
```

- `jwt.verify` returns `string | JwtPayload`. Narrow to an object with `id`, `username` and `userType` before use.
- Preserve the existing precedence exactly: cookie or `Authorization` header goes through JWT auth, otherwise `X-API-Key`, otherwise 401. A presented but invalid JWT still returns 403.
- Preserve the API-key behavior: the key acts as its creating admin with `userType` overlaid from the key scope, and `lastUsedAt` is throttled to one write per minute per key.
- 18 files import this module; update all specifiers in the same commit.

Gate: typecheck, `apiKeyAuth`, `apiKeys`, `creditAdjustment`, `users`, plus a manual login and a kiosk-style API-key call.

## Segment 5: routes A

Scope: `src/api/auth.js`, `leaderboard.js`, `apiKeys.js`, `admin.js`.

- Keep guards at the route edge: `authenticateRequest` then `requireAdmin` or `requireAdminOrSeller`.
- `auth.ts`: login, logout, `/me`, bootstrap admin. Cookie flags and response shapes stay as they are.
- `leaderboard.ts`: aggregates and date bounds unchanged.
- `apiKeys.ts`: scopes, revoke and delete. Only ever return the key prefix, never the hash or the full key.
- `admin.ts`: profile and admin CRUD.
- Keep `@openapi` blocks verbatim and keep route order.

Gate: typecheck, suite, docs test.

## Segment 6: drinks route

Scope: `src/api/drinks.js`.

- `multer` and `csv-parser` imports now have types. `req.file` is `Express.Multer.File | undefined`; guard it before reading `buffer`.
- Keep CSV export headers and content types identical.
- Keep the stock invariants: stock never goes negative, `add-stock` and restock behavior unchanged, permanent delete unchanged.
- Keep static routes above parameterized ones.

Gate: typecheck, drinks and restock tests, and a manual CSV import and export.

## Segment 7: users route

Scope: `src/api/users.js`.

- **Route order is load-bearing.** `/export-csv` must stay above `/:id`.
- CSV import: `req.file.buffer`, csv-parser row shapes, and coercion of `userType` through the existing enum. A bad row must still fail the same way.
- Credits: `add-credits` and `PUT /:id` stay admin-only and in blocks of 10; the signed adjustment row logic does not change.
- Scan-code routes (`/users/:id/scan-code`) stay as they are.
- `Transaction.finished` is missing from Sequelize's typings and is checked in this file. Use a narrow cast such as `tx as Transaction & { finished?: string }` or a local boolean; do not change when rollback runs.

Gate: typecheck, users tests, CSV import and export smoke.

## Segment 8: passkeys route

Scope: `src/api/passkeys.js`.

- Type the `@simplewebauthn/server` verification options and the stored challenge lifecycle. The challenge store is in memory with a TTL; do not move it.
- Keep the registration and login response shapes, and keep the rename endpoint returning only metadata. Credential material must not leak (see #129).
- Preserve the existing 400/401/404 behavior for expired or unknown challenges.

Gate: typecheck, passkey tests, and a manual register and login from the web UI.

## Segment 9: sales route

Scope: `src/api/sales.js`.

- This is the money path. Preserve `sequelize.transaction` usage, every early-return rollback, ascending row locking by id, `saleGroupId` grouping, whole-group undo, and `Transaction.adminId = req.user.id`.
- `Transaction.finished` needs the same narrow treatment as segment 7.
- Keep the seller undo window logic and the API-key `userType` overlay behavior identical.
- Keep basket quantity merges and stock deductions identical.

Gate: typecheck, `sales-multi`, `sales-concurrency`, and a manual sell plus undo across a multi-drink basket. If anything in this segment needs a behavior change, stop and report it instead.

## Segment 10: wiring

Scope: `src/api/index.js`, `src/api-docs.js`.

- `api/index.ts` mounts every router and the docs route under `/api/v1`. Keep mount order and prefixes identical.
- `api-docs.ts` keeps the component schemas and the glob that finds `src/api/*.{js,ts}`. Do not rewrite YAML annotations.
- `test/docs.test.js` has a hardcoded endpoint list; every route must still be documented.

Gate: typecheck, suite, docs test.

## Segment 11: entry points and scripts

Scope: `src/app.js`, `src/index.js`, `src/seeds/index.js`, `src/seeds/adminSeed.js`, `scripts/seed.js`, `src/migrate.js`, `backend/package.json`.

- `app.ts`: keep top-level `await initializeDatabase()` and the CORS callback logic. Narrow the CORS origin type, do not change allowed origins.
- `index.ts`: `err.code` needs a `NodeJS.ErrnoException` narrowing before the `EADDRINUSE` check.
- Seeds and `scripts/seed.ts`: annotate return types and reuse model creation attributes.
- `migrate.ts`: the manual-run guard uses `process.argv[1]?.endsWith("migrate.js")`. Rename it and update the guard to `.endsWith("migrate.ts")`, otherwise `node src/migrate.ts` silently does nothing. Update every command reference in `AGENTS.md` and `backend/README.md` in the same PR.
- `package.json`: `main`, `start`, `start:local`, `dev` and `seed` must point at the `.ts` files.
- Verify the Docker image still builds and boots; the Dockerfile runs `pnpm start` and does not need a build stage.

Gate: typecheck, suite, `node src/migrate.ts`, `pnpm start` boot, Docker image build.

## Segment 12: cleanup

- Decide `allowJs`. Tests stay `.js` (decision recorded here), so keep `"allowJs": true` and `"checkJs": false` and add a comment in `tsconfig.json` saying they exist for legacy tests. Do not remove `test` from `include`.
- Update `AGENTS.md` and `backend/README.md` where they still describe `.js` entry points or the old migration flow.
- Close #35 with the PR list.
- Optional follow-up: convert the remaining test files (about 2,700 lines) and then delete `allowJs`. That is a separate issue, not a blocker.

## Definition of done

```bash
# no runtime JavaScript left in src, seeds or scripts
git ls-files 'backend/src/**/*.js' 'backend/scripts/**/*.js'

# clean gates
pnpm --filter @beerswipe/backend run typecheck
pnpm --filter @beerswipe/backend test

# production image still builds and boots
docker build -f backend/Dockerfile -t beerswipe-backend .
```

`backend/migrations/002-add-passkey-support.js` stays by design. It predates the auto migrator and is not executed.

The API contract is unchanged: same paths, same cookie auth, same response shapes. The Vue app, kiosk and ADA site must not need changes.

## After #35: NestJS (#31)

NestJS is a separate project, not part of this migration. Two constraints make combining them expensive:

- Nest depends on legacy decorators plus `emitDecoratorMetadata`, which Node's type stripping cannot emit. A Nest backend needs a compile step again, so the no-build runtime from #142 goes away and Docker grows a build stage.
- `@nestjs/sequelize` is built on `sequelize-typescript` and expects `@Table`-decorated model classes. The `sequelize.define()` models in this repo do not plug into it, so the model layer gets revisited either way.

When that project starts, freeze the HTTP contract, do not combine it with an ORM change (#21), and decide the model strategy before writing controllers.
