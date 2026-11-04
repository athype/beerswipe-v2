# @beerswipe/frontend

This template should help get you started developing with Vue 3 in Vite.

## TypeScript

The frontend is fully TypeScript. `frontend/tsconfig.json` runs with `strict: true` and no `allowJs`/`checkJs`; every SFC with a script uses `<script setup lang="ts">` (the script-less SFCs are exempt). Check types with:

```sh
pnpm --filter @beerswipe/frontend run typecheck
```

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
# Install dependencies once from repository root
pnpm install
```

This repository is a pnpm workspace monorepo.
- Use the root `pnpm-lock.yaml` as the single lockfile.
- Do not create or maintain `frontend/pnpm-lock.yaml`.
- Frontend package name: `@beerswipe/frontend`.

### Compile and Hot-Reload for Development

```sh
pnpm --filter @beerswipe/frontend run dev
```

### Compile and Minify for Production

```sh
pnpm --filter @beerswipe/frontend run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
pnpm --filter @beerswipe/frontend run test:unit
```
