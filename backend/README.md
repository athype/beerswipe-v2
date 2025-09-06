# Beer Machine v3 API

A drink management system API for SV ADA, built with Express.js and PostgreSQL.

## Features

- User management (members, donators, admins)
- Credit system with transaction tracking
- Drink inventory management
- Sales processing
- Authentication and authorization
- CSV user import
- Transaction history and reporting

## Setup

```
pnpm install
```

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
pnpm run seed
```

## Development

```
pnpm run dev
```

## Production

```
pnpm start
```

## Lint

```
pnpm run lint
```

## Test

```
pnpm test
```

## API Endpoints

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
