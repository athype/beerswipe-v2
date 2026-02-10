# GitHub Copilot Instructions for BeerSwipe v2

## Project Overview
BeerSwipe v2 is a modern drink selling and management system for student associations. It features user management, credit system, inventory tracking, and sales processing with a responsive web interface.

**Core Features:**
- Admin and seller authentication (JWT-based with httpOnly cookies, passkey support)
- User management (admins, sellers, members, non-members) with CSV import/export
- Credit system for user accounts
- Inventory management for drinks and stock
- Point-of-sale terminal
- Transaction history and audit trail
- Dockerized deployment

## Technology Stack

### Backend
- **Runtime:** Node.js (ES modules)
- **Framework:** Express.js 5.x
- **Database:** PostgreSQL with Sequelize ORM
- **Authentication:** JWT (jsonwebtoken) with httpOnly cookies, WebAuthn/Passkeys (@simplewebauthn/server)
- **Validation:** Zod schemas
- **Security:** Helmet, bcryptjs
- **Testing:** Vitest, Supertest

### Frontend
- **Framework:** Vue.js 3 (Composition API)
- **State Management:** Pinia
- **Routing:** Vue Router 4
- **Build Tool:** Vite
- **HTTP Client:** Axios
- **Authentication:** @simplewebauthn/browser for passkey support
- **Testing:** Vitest, Vue Test Utils

### Deployment
- Docker & Docker Compose
- Nginx (frontend serving)
- Caddy (reverse proxy with automatic HTTPS)
- PostgreSQL (database)

## Architecture
```
Internet → Caddy (HTTPS) → Frontend (Nginx) → Backend (Express) → PostgreSQL
```

- Caddy handles HTTPS termination and reverse proxying
- Frontend is served as static files via Nginx
- Backend API is accessible internally to frontend
- Database is isolated in Docker network

## Development Setup

### Prerequisites
- Node.js 20.19.0+ or 22.12.0+
- pnpm (package manager)
- Docker & Docker Compose (for full stack development)

### Local Development Commands

**Backend:**
```bash
cd backend
pnpm install
pnpm dev          # Start with hot reload
pnpm start        # Start production mode
pnpm lint         # Run ESLint
pnpm test         # Run tests
pnpm seed         # Seed database
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev          # Start dev server (localhost:5173)
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm test:unit    # Run unit tests
```

**Docker Development:**
```bash
# Full development environment
docker-compose -f docker-compose.dev.yml up --build

# PostgreSQL only (for local frontend/backend)
docker-compose -f docker-compose.dev.yml up postgres -d
```

## Code Style and Conventions

### General Guidelines
- **ES Modules:** Always use `import/export` syntax, never `require()`
- **File Naming:** Use kebab-case for all files (enforced by ESLint)
- **Indentation:** 2 spaces (no tabs)
- **Quotes:** Double quotes for strings
- **Semicolons:** Always use semicolons
- **Console Logs:** Use sparingly; wrap in `/* eslint-disable no-console */` comments when necessary

### Backend Conventions
- **API Structure:** Follow RESTful conventions
- **Routes:** Organized in `/src/api/` by resource (users.js, drinks.js, sales.js, etc.)
- **Models:** Sequelize models in `/src/models/` (User.js, Drink.js, Transaction.js)
- **Middleware:** Auth and validation middleware in `/src/middleware/`
- **Validation:** Use Zod schemas for request validation
- **Error Handling:** Use consistent error response format with proper HTTP status codes
- **Environment Variables:** Access via `env.js`, never use `process.env` directly (enforced by ESLint rule `node/no-process-env`)
- **Database:** Use Sequelize ORM for all database operations
- **Authentication:** 
  - JWT tokens stored in httpOnly cookies for session management
  - Bcrypt for password hashing
  - WebAuthn/Passkeys for passwordless authentication
  - Cookie settings: httpOnly, secure (in production), sameSite

### Frontend Conventions
- **Component Structure:** Vue 3 Composition API with `<script setup>`
- **Views:** Page components in `/src/views/` (e.g., UsersView.vue, DrinksView.vue)
- **Components:** Reusable components in `/src/components/`
- **State:** Use Pinia stores in `/src/stores/`
- **Routing:** Define routes in `/src/router/`
- **API Calls:** Use services in `/src/services/` (e.g., apiService.js)
- **Styling:** Component-scoped styles with `<style scoped>`

### ESLint Configuration
- Uses `@antfu/eslint-config` base configuration
- Custom rules enforced:
  - `no-console`: Warn on console usage
  - `node/no-process-env`: Error on direct process.env access
  - `unicorn/filename-case`: Enforce kebab-case filenames
  - `perfectionist/sort-imports`: Enforce sorted imports
  - `ts/consistent-type-definitions`: Prefer `type` over `interface`

## API Endpoints

**Authentication:**
- `POST /api/v1/auth/login` - Admin/seller login (sets httpOnly cookie)
- `POST /api/v1/auth/logout` - Logout (clears httpOnly cookie, can be called with or without authentication)
- `POST /api/v1/auth/create-admin` - Create admin user
- `GET /api/v1/auth/me` - Get current authenticated user (requires authentication)

**Passkey Authentication:**
- `POST /api/v1/passkeys/register-options` - Generate passkey registration challenge
- `POST /api/v1/passkeys/register-verify` - Verify and store passkey
- `POST /api/v1/passkeys/login-options` - Generate passkey authentication challenge
- `POST /api/v1/passkeys/login-verify` - Verify passkey and issue token
- `GET /api/v1/passkeys` - List user's registered passkeys
- `DELETE /api/v1/passkeys/:id` - Remove a passkey
- `PUT /api/v1/passkeys/:id` - Update passkey device name

**Users (Admin only):**
- `GET /api/v1/users` - List users (with pagination/filters)
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `POST /api/v1/users/:id/add-credits` - Add credits
- `POST /api/v1/users/import-csv` - Import users from CSV
- `GET /api/v1/users/export-csv` - Export users to CSV

**Drinks (Admin only):**
- `GET /api/v1/drinks` - List drinks
- `POST /api/v1/drinks` - Create drink
- `PUT /api/v1/drinks/:id` - Update drink
- `POST /api/v1/drinks/:id/add-stock` - Add stock
- `POST /api/v1/drinks/import-csv` - Import stock from CSV
- `GET /api/v1/drinks/export-csv` - Export stock to CSV
- `DELETE /api/v1/drinks/:id` - Delete drink

**Sales (Admin and Seller):**
- `POST /api/v1/sales/sell` - Process sale
- `GET /api/v1/sales/history` - Transaction history
- `GET /api/v1/sales/stats` - Sales statistics

## Passkey Authentication

The system supports WebAuthn/Passkeys for passwordless authentication:

### Features
- **Passwordless Login:** Authenticate using biometrics (Touch ID, Face ID) or security keys
- **Multi-Device Support:** Register multiple passkeys per user (phone, laptop, security key)
- **Phishing-Resistant:** Domain-bound credentials prevent phishing attacks
- **Hybrid Approach:** Passkeys work alongside traditional password authentication

### Implementation Details
- **Backend:** Uses `@simplewebauthn/server` for WebAuthn operations
- **Frontend:** Uses `@simplewebauthn/browser` for credential management
- **Storage:** Passkey credentials stored in separate `Passkeys` table
- **Challenge Management:** Temporary challenge storage with 5-minute expiration
- **Counter Verification:** Signature counter prevents credential cloning

### User Flow
1. **Registration:** User registers passkey from security settings
2. **Authentication:** User can login with passkey or fallback to password
3. **Management:** Users can view, rename, and delete registered passkeys
4. **Device Naming:** Each passkey has a user-friendly name (e.g., "iPhone 13")

## Testing

### Backend Tests
- Located in `/backend/test/`
- Use Vitest as test runner
- Use Supertest for API testing
- Run with `pnpm test`

### Frontend Tests
- Located alongside components in `__tests__/` directories
- Use Vitest and Vue Test Utils
- Run with `pnpm test:unit`

### Test Conventions
- Test files use `.test.js` or `.spec.js` extension
- Group related tests with `describe()` blocks
- Use descriptive test names
- Test both happy path and error cases

## Database Schema

### User Types
The system supports four user types:
- **Admin:** Full access to all features, user management, inventory, sales, and reports
- **Seller:** Can process sales and view transaction history (POS terminal access)
- **Member:** Regular members with credit accounts, cannot login to admin portal
- **Non-member:** Guest users with credit accounts, cannot login to admin portal

### Key Models
- **User:** username (required), password (nullable, required for admin/seller login unless using passkey), credits, dateOfBirth, userType (admin/seller/member/non-member), isActive
- **Passkey:** userId, credentialId, publicKey, counter, transports, deviceName, lastUsedAt
- **Drink:** name, description, price, stock, category, isActive
- **Transaction:** userId, drinkId, amount, price, timestamp, type

### Database Operations
- Use Sequelize models for all database operations
- Use transactions for operations that modify multiple records
- Always validate input before database operations

## Security Considerations
- **Authentication:**
  - JWT tokens stored in httpOnly cookies (prevents XSS attacks)
  - Secure flag enabled in production (HTTPS only)
  - SameSite attribute to prevent CSRF
  - Passkey/WebAuthn support for passwordless authentication (phishing-resistant)
- **Password Security:** Passwords hashed with bcryptjs (10 rounds)
- **HTTP Headers:** Helmet middleware for security headers
- **CORS:** Configured for frontend domain only
- **Input Validation:** Zod schemas for all API inputs
- **SQL Injection Prevention:** Sequelize ORM with parameterized queries
- **Secrets Management:** Environment variables for sensitive data (never commit .env)
- **Session Security:** Automatic token expiration and refresh mechanisms

## CSV Import/Export

### Users CSV Format
```csv
username,credits,dateOfBirth,isMember
513286,10,13-05-2002,true
john_doe,0,15-03-1995,false
```

### Stock/Drinks CSV Format
```csv
name,description,price,stock,category,isActive
Heineken,Dutch lager beer,5,100,beverage,true
Coca Cola,Classic soft drink,3,150,beverage,true
```

## Common Tasks

### Adding a New API Endpoint
1. Create or update route handler in `/backend/src/api/`
2. Add Zod validation schema if needed
3. Update controller logic
4. Add corresponding service method in frontend `/src/services/`
5. Add tests for the new endpoint
6. Update API documentation if needed

### Adding a New View
1. Create view component in `/frontend/src/views/`
2. Add route in `/frontend/src/router/`
3. Create or update Pinia store if state management needed
4. Add navigation link in appropriate component
5. Add unit tests

### Database Migrations
1. Update model in `/backend/src/models/`
2. Consider adding migration script if needed
3. Update seed data if applicable
4. Test with fresh database

## Environment Variables

### Development (.env)
```env
NODE_ENV=development
BEPORT=8080
BEURL=http://localhost:8080/api/v1
JWT_SECRET=your-secret-key-here
FEURL=http://localhost:5173
FEPORT=5173
DOMAIN=localhost
DB_HOST=postgres
DB_PORT=5432
DB_NAME=beermachine
DB_USER=postgres
DB_PASSWORD=password
```

### Production
- Always change JWT_SECRET from default
- Always change DB_PASSWORD from default
- Set DOMAIN to production domain (e.g., beer.sv-ada.nl)
- Use HTTPS URLs for BEURL and FEURL

## Troubleshooting

### Backend Issues
- Check database connection: `docker-compose logs postgres`
- Verify environment variables in `.env`
- Check backend logs: `docker-compose logs backend`

### Frontend Issues
- Verify BEURL points to correct backend
- Check CORS settings if cross-origin issues
- Check frontend logs: `docker-compose logs frontend`

### Database Issues
- Ensure PostgreSQL is running
- Check database credentials
- Try reseeding: `pnpm seed`

## Additional Notes
- Production domain: https://beer.sv-ada.nl
- License: Proprietary source available
- Author: Krisztian Kozari
- Caddy handles automatic HTTPS with Let's Encrypt in production
