# @beerswipe/types

Shared TypeScript contracts for Beer Machine domain entities and API payloads.

This package is part of a pnpm workspace monorepo.
- Install dependencies from repository root with `pnpm install`.
- Use the root `pnpm-lock.yaml` as the single lockfile.

## Scope

This package provides compile-time contracts only. It intentionally contains no runtime business logic.

## Modules

- `common`: shared utility types (pagination, action results, ISO date alias)
- `domain`: core domain entities and enums (`UserType`, `TransactionType`, etc.)
- `auth`: auth endpoint request/response contracts
- `admin`: admin profile and management contracts
- `users`: user management and CSV contracts
- `drinks`: drink management and CSV contracts
- `sales`: sale, history, stats, and undo contracts
- `leaderboard`: monthly leaderboard and rank contracts
- `passkeys`: passkey/WebAuthn application-level contracts

## Build

From the repository root:

```bash
pnpm --filter @beerswipe/types build
```

## Typecheck

From the repository root:

```bash
pnpm --filter @beerswipe/types typecheck
```

## Consumption in JavaScript

JavaScript consumers can import types through JSDoc:

```js
/** @typedef {import('@beerswipe/types').LoginRequest} LoginRequest */
```

Keep these contracts aligned with backend route responses when API payloads change.
