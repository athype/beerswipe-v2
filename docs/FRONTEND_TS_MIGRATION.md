# Frontend TypeScript Migration

**Status: 2026-11-04 — complete.** This was the execution playbook for issue #36. The frontend toolchain has been live since #107; all 37 JavaScript-script SFCs were converted across the ten segments into the long-lived `refactor/frontend-ts` integration branch. `master` changes once, when the integration PR merges.

The shared `types/` package is TypeScript and is the source of truth for API contracts.

## Current state

| Area | State | Remaining |
|------|-------|-----------|
| `.vue` files | 49 total | **42 TS setup**, 7 with no script |
| TS modules | 20 files, 1,897 lines | services, stores, router, composables, utils, tests converted in #107 |
| Tests | 4 TS test files, 24 tests | none |
| `vue-tsc` | passes | `strict: true`, zero errors |
| Build | passes | `vite build` |

`frontend/tsconfig.json` has `strict: true`; `allowJs` and `checkJs` are removed, and the include is limited to `ts`, `tsx` and `vue`.

## Why strict starts on

The old backend playbook and the first draft of the frontend plan suggested starting on `strict: false` and tightening later. That is no longer the right trade-off here. I ran `vue-tsc --noEmit` against a temporary config with `"strict": true` on the current 20 TS modules and 5 TS SFCs: **zero errors**. So every SFC can be converted strict-clean from the start, without a second pass. This also matches the backend, which has been on `strict: true` since #142.

Segment 0 flips `strict` to `true`. Every later segment must stay green under it.

## Conventions

1. **Script block.** Change `<script setup>` to `<script setup lang="ts">`. Do not restructure the component or move the script.
2. **Type-only props.** Replace runtime prop objects with type-only props and `withDefaults`, preserving every default:
   ```ts
   const props = withDefaults(defineProps<{
     show?: boolean
     items?: CartItem[]
   }>(), {
     show: false,
     items: () => [],
   })
   ```
   Array and object defaults stay factories. If the script does not use `props`, call `defineProps<{...}>()` without assigning it; the template still sees the props.
3. **Typed emits.** Replace array emits with type-only emits. Quote event names containing a colon:
   ```ts
   const emit = defineEmits<{
     close: []
     confirm: []
     'update:quantity': [value: number]
   }>()
   ```
   Infer payload types from the current `emit` calls and the parent listeners.
4. **Typed refs.** `ref(null)` becomes `ref<User | null>(null)`; `ref([])` becomes `ref<Drink[]>([])`; DOM refs become `ref<HTMLInputElement | null>(null)`. Type `reactive` forms with a local interface.
5. **Typed boundaries.** Event handlers take `Event` and narrow `event.target` to the input or select element. File inputs use `File`. Computed getter/setters used for `v-model` are typed with `computed<T>({ get, set })`.
6. **Unknown catches.** `catch` variables are `unknown` under strict. Use `getErrorMessage(error, fallback)` from `src/utils/errors.ts`; do not read `error.message` directly.
7. **Store results.** Check `result.success === false` before reading `result.error`. This is the existing `ScanCodeModal` pattern.
8. **Shared types first.** Use domain types from `@beerswipe/types` (`User`, `Drink`, `Transaction`, `ApiKey`, `LeaderboardEntry`). Define local interfaces only for view-specific shapes such as cart lines, grouped sales and recent customers.
9. **No shortcuts.** No `any`, no `@ts-ignore`, no `@ts-expect-error`, no `@ts-nocheck`, no `as unknown as` to silence a prop mismatch. If a library type is missing, define a local interface or narrow with `unknown`.
10. **No behavior changes.** Keep prop names, default values, event names, templates, styles, route behavior and store calls identical. Do not mass-rename import specifiers; the codebase mixes `.js` store imports and extensionless imports, and both resolve today.

## Verification for every segment

```bash
pnpm --filter @beerswipe/frontend run typecheck
pnpm --filter @beerswipe/frontend run test:unit
pnpm --filter @beerswipe/frontend run build
```

`vue-tsc` checks templates against prop types, so a wrong prop shape or missing required prop fails even when the app would render. That is the main safety net.

The CI frontend job runs `build:types`, `test:unit`, `typecheck` and `build` on every PR. Add a manual smoke for the views touched by the segment; the final segment runs the whole flow once more.

Lint is not part of the frontend toolchain today; do not add it as part of this migration.

## Segment plan

One segment per branch, per PR, per Claude Code session. Segment branches target `refactor/frontend-ts`, and each segment is squash merged into it. The integration branch merges to `master` once at the end, so the migration produces one production deploy instead of eleven.

| # | Branch | Files | Lines | Gate |
|---|--------|-------|-------|------|
| 0 | `chore/frontend-ts-setup` | `tsconfig`, CI trigger, `utils/errors.ts` + test, this doc, #36 | 0 SFC | typecheck, tests, build |
| 1 | `refactor/frontend-ts-shell` | `App`, `Modal`, `NavBar`, `BottleMark`, `DesktopNavbar`, `MobileNavbar`, `NotificationContainer` | 1,003 | typecheck, build, nav/logout smoke |
| 2 | `refactor/frontend-ts-user-admin` | `AddCreditsModal`, `AdminForm`, `AdminList`, `CreateUserModal`, `EditUserModal`, `CsvImportModal` | 1,014 | typecheck, build, admin/users smoke |
| 3 | `refactor/frontend-ts-api-stock-passkeys` | `CreateApiKeyModal`, `StockCsvExportModal`, `StockCsvImportModal`, `UndoTransactionModal`, `PasskeyList`, `PasskeyRegistration` | 1,146 | typecheck, build, smoke |
| 4 | `refactor/frontend-ts-leaderboard` | `LeaderboardPodium`, `LeaderboardTable`, `MonthSelector` | 694 | typecheck, build, month switch smoke |
| 5 | `refactor/frontend-ts-drink-sale-modals` | `AddStockModal`, `CreateEditDrinkModal`, `CsvExportModal`, `SaleConfirmModal`, `UndoSaleConfirmModal` | 851 | typecheck, build, sale confirm smoke |
| 6 | `refactor/frontend-ts-views-a` | `LoginView`, `HomeView`, `DashboardView`, `LeaderboardView` | 1,091 | typecheck, tests, build, smoke |
| 7 | `refactor/frontend-ts-views-b` | `ApiKeysView`, `AdminDashboardView`, `UsersView` | 1,326 | typecheck, build, smoke |
| 8 | `refactor/frontend-ts-views-c` | `DrinksView`, `TransactionHistoryView` | 1,341 | typecheck, build, smoke |
| 9 | `refactor/frontend-ts-sales-view` | `SalesView` | 1,517 | typecheck, tests, build, full sell/undo smoke |
| 10 | `chore/frontend-ts-cleanup` | remove `allowJs`/`checkJs`, fix passkey casts, docs, final merge | 0 SFC | full verification |

The 7 script-less SFCs are exempt: `Footer.vue`, `AboutView.vue` and the five icons. The 5 already-TS SFCs need no conversion: `ScanCodeModal`, `ShoppingListModal`, `DeleteDrinkConfirmModal`, `Dither`, `CountUp`.

---

## Segment 0: setup

- Create `refactor/frontend-ts` from `master` and add it to the `ci.yml` `pull_request` branch list.
- Flip `"strict": true` in `frontend/tsconfig.json`. Keep `allowJs` and `checkJs` until segment 10.
- Add `src/utils/errors.ts` with `getErrorMessage(error: unknown, fallback: string): string` and a unit test covering Error, string, empty message and unknown values.
- Update the `strict: false` comment in `components/modals/ScanCodeModal.vue` so it no longer claims truthiness narrowing is disabled.
- Add this playbook and replace the generic #36 body with the segment checklist.

Gate: typecheck, tests and build. This segment changes no component behavior.

## Segment 1: shell and navigation

Files: `App.vue`, `components/Modal.vue`, `components/NavBar.vue`, `components/Navigation/BottleMark.vue`, `components/Navigation/DesktopNavbar.vue`, `components/Navigation/MobileNavbar.vue`, `components/NotificationContainer.vue`.

- `Modal.vue`: type `show`, `title`, `closable` and `closeOnOverlay` with defaults; type the `close` emit; `handleEscape(e: KeyboardEvent)`; keep the two `watch` calls and the body overflow side effect.
- `NavBar.vue`: emits `logout`, no props.
- `BottleMark.vue`: type its props from the existing runtime declaration.
- `DesktopNavbar.vue` and `MobileNavbar.vue`: emits `logout`; type the open/menu refs and any click-outside handlers.
- `NotificationContainer.vue`: uses the typed `useNotifications` composable; no props.
- `App.vue`: `onMounted`, `authStore.initializeAuth()`, `logout(): Promise<void>` and `router.push`.

Gate plus a manual smoke of navigation, logout and notifications.

## Segment 2: user and admin components

Files: `AddCreditsModal`, `AdminForm`, `AdminList`, `CreateUserModal`, `EditUserModal`, `CsvImportModal`.

- Convert every runtime prop object to type-only props with the same defaults.
- `AdminList.vue` uses the global `confirm`; keep it.
- `CsvImportModal.vue`: `ref<HTMLInputElement | null>(null)`, `ref<File | null>(null)`, `handleFileChange(event: Event)` with an `HTMLInputElement` narrowing; the `import` emit carries a `File`.
- Use `getErrorMessage` in catch blocks.
- Type form models with local interfaces that match the fields already bound in the template.

Gate plus admin/users smoke, including CSV import.

## Segment 3: API key, stock, undo and passkeys

Files: `CreateApiKeyModal`, `StockCsvExportModal`, `StockCsvImportModal`, `UndoTransactionModal`, `PasskeyList`, `PasskeyRegistration`.

- Stock CSV components use file input refs and `File`, same pattern as segment 2.
- `UndoTransactionModal` takes a transaction prop; type it from `@beerswipe/types` and keep the optional/undo guard behavior.
- `PasskeyList` takes the device list; type it with the shared passkey type or a local device interface.
- `PasskeyRegistration` emits registered; type `navigator` usage and the WebAuthn calls. Do not change the browser flow.
- API key form types come from `@beerswipe/types` where they exist.

Gate plus API key, stock CSV and passkey smoke.

## Segment 4: leaderboard components

Files: `LeaderboardPodium`, `LeaderboardTable`, `MonthSelector`.

- Define one local `LeaderboardEntry` interface and share it between podium and table. Include rank, userId, username, userType, transactionCount, totalDrinks and totalSpent.
- `LeaderboardPodium` declares `entries` as both required and defaulted. Preserve both; type it as `LeaderboardEntry[]`.
- `MonthSelector`: `year` and `month` are required numbers; emits `update:year`, `update:month` and `change` with `{ year: number; month: number }`. Narrow `event.target` to `HTMLSelectElement` in the three change handlers.

Gate plus a month switch smoke.

## Segment 5: drink and sale modals

Files: `components/modals/AddStockModal`, `CreateEditDrinkModal`, `modals/CsvExportModal`, `modals/SaleConfirmModal`, `modals/UndoSaleConfirmModal`.

- `AddStockModal`: type the computed getter/setter for `quantity` and the `update:quantity` emit.
- `CreateEditDrinkModal`: `drink: Drink | null`; type the form model and emits.
- `CsvExportModal`: type the export options props and emits.
- `SaleConfirmModal`: `user: User | null`, `items: CartItem[]`, `total: number`, `processing: boolean`; `calculateAge(dateOfBirth: string | null): number | null`.
- `UndoSaleConfirmModal`: type the transaction/sale prop and the confirm emit.

Gate plus sale confirm and undo modal smoke.

## Segment 6: views A

Files: `LoginView`, `HomeView`, `DashboardView`, `LeaderboardView`.

- `LoginView`: type the two `reactive` forms, use `getErrorMessage` in the three catch blocks, and keep the store result handling and router pushes identical.
- `HomeView` and `DashboardView`: type refs, computed stats and any local view models.
- `LeaderboardView`: type the month state and the leaderboard store result.

Gate plus login, dashboard and leaderboard smoke.

## Segment 7: views B

Files: `ApiKeysView`, `AdminDashboardView`, `UsersView`.

- `ApiKeysView`: use the API key types from `@beerswipe/types`, type the create/revoke modal state and keep the one-time key display behavior.
- `AdminDashboardView`: type the admin list/form state and the selected admin.
- `UsersView`: type filters, pagination, selected user and the modal payloads. Use a local query interface that matches the existing values.

Gate plus admin, users and API key smoke.

## Segment 8: views C

Files: `DrinksView`, `TransactionHistoryView`.

- `DrinksView`: type the drink filters, selected drink and modal payloads from `Drink`.
- `TransactionHistoryView`: type the filters, pagination and transaction rows from the shared transaction type; keep the seller/admin visibility rules.

Gate plus drinks and history smoke.

## Segment 9: sales terminal

Files: `views/SalesView.vue`.

This is the largest and highest-risk conversion. Type the local models explicitly:

```ts
interface CartItem {
  drink: Drink
  quantity: number
}

interface RecentCustomer {
  // match the fields the template already reads
}
```

- `selectedUser: Ref<User | null>`, `cart: Ref<CartItem[]>`, `recentCustomers: Ref<RecentCustomer[]>`, `undoTarget`.
- Type the `Map` instances used for category and sale grouping.
- Type `drinkCategoryOf`, `calculateAge` and every handler parameter.
- Use `getErrorMessage` in catch blocks.
- Keep the sale, recent-customer persistence and undo-window logic identical.

Gate plus the full sell and undo flow.

## Segment 10: cleanup

- Remove `allowJs` and `checkJs` from `frontend/tsconfig.json`; remove `src/**/*.js` and `src/**/*.jsx` from `include`. Keep `env.d.ts` and the `.vue` include.
- Remove the two `as any` casts in `stores/passkey.ts` and type the WebAuthn options response instead.
- Update `AGENTS.md` and the frontend documentation for the new state.
- Remove the temporary `refactor/frontend-ts` CI trigger.
- Open the integration PR `refactor/frontend-ts` -> `master`, run the full verification, merge with a merge commit and close #36.

## Definition of done

- No `<script setup>` without `lang="ts"`. The 7 script-less SFCs are exempt.
- 37 JS SFCs converted; the 5 existing TS SFCs remain.
- `strict: true`; `allowJs` and `checkJs` removed; include limited to `ts`, `tsx` and `vue`.
- `pnpm --filter @beerswipe/frontend run typecheck` passes with zero errors.
- `pnpm --filter @beerswipe/frontend run test:unit` passes.
- `pnpm --filter @beerswipe/frontend run build` passes.
- No `any`, `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`; the two passkey store casts are gone.
- Manual smoke: login, dashboard, leaderboard, admin/users, drinks, transaction history, API keys, passkeys, CSV import/export, sale and undo.

## Integration

`refactor/frontend-ts` is created from `master` and is the only branch that merges back. Each segment PR targets it, and CI runs on those PRs because the branch is in the `ci.yml` trigger list. The final PR to `master` is a merge commit so the segment history lands, and it is the only production deploy for the migration. Segment 10 removes the temporary trigger before that PR.
