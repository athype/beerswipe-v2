# AGENTS.md

## Purpose
This document is the operating guide for contributors and coding agents working in this repository.

Use it to:
- understand architecture and boundaries before changing code
- run the right commands for backend, frontend, and docker workflows
- avoid breaking high risk auth, transaction, and passkey behavior
- follow consistent implementation and verification patterns

If guidance here conflicts with source code, source code wins.

## Scope
This guide applies to the entire repository:
- backend API and database behavior
- frontend Vue app and state management
- docker, reverse proxy, and deployment configs
- shared contracts between frontend and backend

Out of scope:
- product requirements and feature prioritization
- infrastructure operations outside repository config

## Repository Map
- `backend/`: Express API, Sequelize models, migrations, seeds, tests
- `frontend/`: Vue 3 app, Pinia stores, router, API client, components
- `types/`: shared TypeScript contracts package used by backend and frontend
- `docker-compose.dev.yml`: local dev topology
- `docker-compose.yml`: production topology
- `frontend/nginx.conf`: SPA + API reverse proxy inside frontend container
- `Caddyfile`: HTTPS reverse proxy for production entrypoint

## Source Of Truth Files
Read these before major changes:
- `README.md`
- `backend/README.md`
- `backend/src/app.js`
- `backend/src/api/index.js`
- `backend/src/middleware/auth.js`
- `backend/src/api/auth.js`
- `backend/src/api/sales.js`
- `backend/src/api/users.js`
- `backend/src/api/passkeys.js`
- `backend/src/utils/webauthn.js`
- `frontend/src/main.js`
- `frontend/src/router/index.js`
- `frontend/src/services/api.js`
- `frontend/src/stores/auth.js`
- `frontend/src/components/Modal.vue`

## Toolchain And Runtime
- Node.js: `^20.19.0 || >=22.12.0` (frontend and types engines)
- Package manager: `pnpm`
- Workspace model: root `pnpm-workspace.yaml` with one canonical lockfile at `pnpm-lock.yaml`
- Backend runtime: Express 5 + Sequelize + PostgreSQL
- Frontend runtime: Vue 3 + Vite + Pinia + Vue Router

## Command Matrix

### Workspace Root (`package.json`)
- install all deps: `pnpm install`
- build shared contracts: `pnpm run build:types`
- typecheck shared contracts: `pnpm run typecheck:types`

### Backend (`backend/package.json`)
- local dev watch: `pnpm --filter backend run dev`
- local run with env file: `pnpm --filter backend run start:local`
- production run: `pnpm --filter backend start`
- lint and fix: `pnpm --filter backend run lint`
- tests: `pnpm --filter backend test`
- seed: `pnpm --filter backend run seed`

### Frontend (`frontend/package.json`)
- dev server: `pnpm --filter frontend run dev`
- production build: `pnpm --filter frontend run build`
- preview build: `pnpm --filter frontend run preview`
- unit tests: `pnpm --filter frontend run test:unit`

### Docker workflows
- full local stack: `docker-compose -f docker-compose.dev.yml up --build`
- db only for local app dev: `docker-compose -f docker-compose.dev.yml up postgres -d`
- production stack: `docker-compose up -d --build`

## Backend Rules

### Request flow
`src/app.js` -> `src/api/index.js` -> route module -> model operations.

Keep route responsibilities narrow:
- validate request input early
- enforce auth and role middleware at route edge
- perform data changes
- return stable JSON response

### Auth and authorization
- Cookie based JWT is primary auth mechanism (`authToken` httpOnly cookie).
- `authenticateToken` must protect any non-public route.
- Use `requireAdmin` for admin-only operations.
- Use `requireAdminOrSeller` only where seller access is intended.
- Do not introduce localStorage token assumptions on backend or frontend.

### Transactions and financial integrity
Operations that update credits, stock, and transaction rows together must stay atomic.

Always use a Sequelize transaction for multi-entity updates, especially in:
- sale flow (`/sales/sell`)
- undo flow (`/sales/undo/:transactionId`)

Rollback on every early return after transaction start.

### Domain invariants
- Credits are added in blocks of 10 for standard add-credit operations.
- Undo flows intentionally use unchecked credit methods to reverse historical effects.
- Stock may never go negative.
- Keep transaction audit trail complete for credit and sale operations.

### Route ordering caveat
In `backend/src/api/users.js`, static routes like `/export-csv` must remain above parameterized routes like `/:id`.

### Migrations and schema
- Development currently relies on `sequelize.sync({ alter: true })` during startup.
- Production schema changes should use migration files in `backend/migrations/`.
- New migration naming pattern: `XXX-description.js` with `up()` and `down()`.

## Frontend Rules

### Data flow
Use this path for server data:
`services/api.js` -> Pinia store action -> view/component.

Do not bypass stores with ad hoc axios calls in components.

### Auth lifecycle
- App mounts first, then `authStore.initializeAuth()` runs in `frontend/src/main.js`.
- Route guards in `frontend/src/router/index.js` rely on store state and route meta.
- Preserve guard semantics for `requiresAuth`, `requiresAdmin`, `requiresAdminOrSeller`.

### API client constraints
- Keep grouped API modules in `frontend/src/services/api.js` (`authAPI`, `usersAPI`, etc.).
- Keep 401 handling behavior consistent with current redirect policy.
- Keep `withCredentials: true` enabled for cookie-based auth.

### Store conventions
- Return `{ success: boolean, data?, error? }` from async actions.
- Maintain `loading` and `error` state for user feedback.
- When a mutation changes list state, refresh or reconcile store data explicitly.

### Modal and component patterns
- Reuse `frontend/src/components/Modal.vue` for modal shell behavior.
- Keep modal form state local to modal component.
- Emit success/close events and trigger parent/store refresh explicitly.

## Cross Cutting Guardrails

### Passkeys (WebAuthn)
- Backend challenge storage is in-memory with TTL (not persisted across restarts).
- Registration and login depend on challenge lifecycle in `backend/src/utils/webauthn.js`.
- Frontend passkey flow must go through store and API modules, not direct browser-only shortcuts.

### Deployment and proxy behavior
- Frontend nginx must keep dynamic upstream resolution (`resolver 127.0.0.11`, variable-based `proxy_pass`) to avoid startup race issues.
- Caddy is the public HTTPS entrypoint in production compose.
- Keep `/api/` proxy behavior aligned with backend route prefix `/api/v1`.

### Shared contract status
`types/` now contains shared TypeScript contracts for domain and API payloads.
Treat backend route responses as the runtime source of truth and keep `types/` aligned when routes change.

## Task Playbooks

### Add a backend endpoint
1. Choose route module in `backend/src/api/`.
2. Add auth middleware (`authenticateToken`, `requireAdmin`, or `requireAdminOrSeller`) at route definition.
3. Validate input and return clear 4xx errors for client mistakes.
4. Add/adjust model logic as needed.
5. Use transaction if mutating multiple entities.
6. Verify frontend API client mapping in `frontend/src/services/api.js`.

### Add or change frontend server interaction
1. Add/adjust API function in `frontend/src/services/api.js`.
2. Update corresponding Pinia store action and keep return shape consistent.
3. Update view/component to use store action.
4. Preserve loading/error handling and notification behavior.
5. Confirm route and role assumptions match backend guards.

### Change auth or passkey behavior
1. Trace full flow in backend auth/passkey routes and frontend auth/passkey stores.
2. Confirm cookie flags, auth checks, and redirect behavior remain coherent.
3. Re-test login, logout, protected route access, passkey register/login.
4. Verify challenge expiration handling and retry UX.

### Change docker/proxy configuration
1. Validate updates against both `docker-compose.dev.yml` and `docker-compose.yml`.
2. Keep nginx `/api/` proxy aligned with backend service URL and route prefix.
3. Keep Caddy forwarding to frontend stable.
4. Document new env vars in `.env.example` and root `README.md` if needed.

## Verification Checklist

### Minimum checks before merging
- backend changes: run `pnpm --filter backend test` and `pnpm --filter backend run lint` from repo root
- frontend changes: run `pnpm --filter frontend run test:unit` and `pnpm --filter frontend run build` from repo root
- integration touching auth/sales/passkeys: manual smoke test across frontend + backend

### Manual smoke tests for high risk changes
- login/logout via password and protected route redirects
- passkey register and passkey login
- sell drink updates credits and stock correctly
- undo transaction restores previous state correctly
- CSV import/export routes still function

## Known Gaps And Cautions
- `backend/test/api.test.js` and `backend/test/app.test.js` appear to contain legacy expectations that may not reflect current route responses.
- Do not treat those two tests as canonical API behavior without reviewing current route code.
- If you update API response shapes, align frontend store expectations immediately.

## Pull Request Expectations
- Keep changes focused and minimal.
- Update docs when changing commands, env vars, routes, or auth behavior.
- Do not commit secrets in `.env` files.
- Prefer explicit, descriptive commit messages and include validation steps in PR notes.
