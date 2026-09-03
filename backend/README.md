# Beer Machine v3 API

A drink management system API for SV ADA, built with Express.js and PostgreSQL.

## Features

- User management (members, non-members, admins)
- Credit system with transaction tracking
- Drink inventory management
- Sales processing
- Authentication and authorization
- CSV user import
- Transaction history and reporting

## Setup

```
# Install dependencies once from repository root
pnpm install

# Run backend from repository root
pnpm --filter @beerswipe/backend run dev
```

This repository is a pnpm workspace monorepo.
- Use the root `pnpm-lock.yaml` as the single lockfile.
- Do not create or maintain `backend/pnpm-lock.yaml`.
- Backend package name: `@beerswipe/backend`.

## Environment Variables

Copy `.env.example` to `.env` and configure your database settings:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=beermachine
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

## Database

The application uses PostgreSQL. Start the database with Docker:

```
docker-compose -f docker-compose.dev.yml up postgres -d
```

## Database Seeding

The application automatically creates a default admin user on first startup:
- Username: `pos`
- Password: `ADAdeventer`

To manually run database seeds:

```
pnpm --filter @beerswipe/backend run seed
```

## Development

```
pnpm --filter @beerswipe/backend run dev
```

## Production

```
pnpm --filter @beerswipe/backend start
```

## Lint

```
pnpm --filter @beerswipe/backend run lint
```

## Test

```
pnpm --filter @beerswipe/backend test
```

## API Documentation

Every endpoint is documented with OpenAPI (via `@openapi` annotations above each route in `backend/src/api/`) and browsable interactively:

- Swagger UI: `http://localhost:8080/api/v1/docs/`
- Raw spec: `http://localhost:8080/api/v1/docs/spec.json`

Authentication is a same-origin `authToken` cookie — log in through the Swagger UI (`POST /auth/login`), then protected endpoints work with "Try it out".

Docs are enabled by default outside production. To control them explicitly, set `ENABLE_API_DOCS=true|false` (e.g. `ENABLE_API_DOCS=true` on a production instance for debugging).

> The list below is **stale and incomplete** — treat the Swagger UI at `/api/v1/docs/` as the source of truth for the API surface.

### Authentication
- `POST /api/v1/auth/login` - Admin login
- `POST /api/v1/auth/create-admin` - Create admin user

### Users
- `GET /api/v1/users` - List all users
- `POST /api/v1/users` - Create new user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user
- `POST /api/v1/users/import-csv` - Import users from CSV

### Drinks
- `GET /api/v1/drinks` - List all drinks
- `POST /api/v1/drinks` - Create new drink
- `PUT /api/v1/drinks/:id` - Update drink
- `DELETE /api/v1/drinks/:id` - Delete drink

### Sales
- `POST /api/v1/sales/purchase` - Process drink purchase
- `POST /api/v1/sales/add-credits` - Add credits to user
- `GET /api/v1/sales/transactions` - Get transaction history
- `GET /api/v1/sales/stats` - Get sales statistics

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
