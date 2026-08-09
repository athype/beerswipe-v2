# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Staff are the only people who log in:**

- **Admins** — association board/bar managers. Manage users, credit balances, drinks and stock, CSV import/export, sales history, the leaderboard, and security (passkeys). Work from any device, typically desk or laptop.
- **Sellers** — bar volunteers at SV Ada events and borrels. Operate the Sales Terminal: search a customer, check age, add drinks to a cart, process the sale.

**Members and non-members** are the customers being billed — they hold an account (username, credits, date of birth, member status) but do not log in. Usernames are often student numbers.

## Product Purpose

Beer Machine is the drink selling and management system for the SV Ada student association: members prepay credits, bar staff sell drinks against those credits with built-in 18+ age verification, and the association keeps a complete, auditable record of every credit and sale.

Success means a busy bar line that moves fast, accurate balances and stock, legal alcohol service, and zero arguments about what someone drank or paid.

## Positioning

A prepaid-credit point-of-sale system built specifically for a student association bar, distinguished by:

- **Age verification at the point of sale** — a customer's date of birth gates whether alcohol can be sold to them, inline in the sales flow.
- **Gamified consumption tracking** — monthly drink-consumption leaderboard with podium, rankings, and per-period stats.
- **Phishing-resistant admin auth** — WebAuthn passkeys on top of JWT login.
- **A full audit trail** — every transaction recorded, viewable, and undoable.

## Operating Context

- Runs at SV Ada events/borrels where the bar is the busiest scene: volunteers behind the bar, noise, queues, phones and laptops as terminals.
- Customers pay cash or pin at the bar; staff top up credits on the account manually, in blocks of 10.
- Admin work (users, stock, history, leaderboard, security) happens outside rush hours from any device.
- Production deployment is at https://beer.sv-ada.nl behind Caddy (HTTPS is required for passkeys), with the frontend nginx-proxying `/api/v1` to the backend; Docker Compose based.
- Dutch law applies: alcohol may only be sold to customers aged 18+; the system enforces this per sale via date of birth.

## Capabilities and Constraints

**Confirmed functionality:**

- Login with username/password (JWT, HttpOnly cookies) and passwordless passkey (WebAuthn) login; first-run "Create Admin Account" flow.
- Roles: admin, seller, member, non-member.
- User management: create/edit users, add credits, CSV import/export (username, credits, dateOfBirth, isMember).
- Drink/inventory management: create/edit/delete drinks, price, stock, categories, active flag, CSV stock import/export.
- Sales terminal: search customer by username, search drinks, cart with quantities, age check, process sale, recent sales list.
- Transaction history with audit trail; undo transaction.
- Leaderboard: monthly consumption rankings with podium and stats.
- Dashboard: sales stats, recent transactions, low-stock alerts, quick actions.
- Global notification system; modals for credits, CSV import/export, create/edit user/drink, undo.
- Responsive UI with separate desktop and mobile navigation.

**Technical constraints:**

- Vue 3 + Vite + Pinia + Vue Router + axios; `@simplewebauthn/browser`; pnpm workspace monorepo sharing `@beerswipe/types` with the Express/PostgreSQL/Sequelize backend.
- Passkeys require HTTPS and the WebAuthn RP_ID/ORIGIN must match the deployment domain.
- Credits are integers; price/credit math is straightforward deduction.
- Frontend talks to the backend only through the REST API (`/api/v1`).

## Brand Commitments

- The UI and README use the name **"Beer Machine"** (login page and home page say "Beer Machine v3", subtitle "SV ADA Drink Management System"). The repository and packages are named `beerswipe`. The official product name is deliberately **undecided** — do not change naming without asking.
- Association identity is SV ADA; the production domain is beer.sv-ada.nl.
- Existing brand assets: `src/assets/logo.svg`, `src/assets/logo2.svg`, `src/assets/ada-logo.png`, `src/assets/bottleskyline-dark.svg`.

## Evidence on Hand

- Root `README.md`: full feature list, API endpoint reference, CSV formats, deployment/HTTPS/passkey documentation, production checklist.
- `frontend/src/router/index.ts`: all routes and role guards.
- Views: Home, Login, Dashboard, Admin Dashboard, Users, Drinks, Sales, Transaction History, Leaderboard, About.
- Real domain and deployment docs (Caddy, GHCR images, compose files).
- No testimonials, pricing, case studies, or external marketing materials exist — do not fabricate them.

## Product Principles

1. **The bar line wins.** The sales terminal must serve a sale in as few steps as possible — search, check, tap, done. Speed at the point of sale outranks feature richness.
2. **Every credit is traceable.** Balances, sales, top-ups, and undo operations are all recorded in the transaction history; nothing happens unlogged.
3. **Legal service is built into the flow, not bolted on.** The 18+ alcohol check is part of processing a sale, not an afterthought.
4. **Staff operate, members are data subjects.** Only admins and sellers have accounts; member accounts exist to be billed and checked, not to log in.
5. **Survive volunteer churn.** Bulk CSV import/export, simple role model, and clear documentation keep the system usable when the people change each year.

## Accessibility & Inclusion

- The sales terminal is used on touch devices (phones/tablets) in a busy, possibly low-light bar — controls need to be large and readable.
- Responsive layouts and a separate mobile navigation exist for phone use.
- No formal accessibility standard (e.g., WCAG) is documented in the repository; treat the codebase's existing responsive and keyboard-usable patterns as the current floor.
