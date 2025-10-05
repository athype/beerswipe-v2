# Beer Machine v3

A modern drink selling and management system for student associations. Features user management, credit system, inventory tracking, and sales processing with a responsive web interface.

## Features

- 🔐 **Admin Authentication**: Secure JWT-based login system
- 👥 **User Management**: Support for admins, members, and non-members with CSV import/export
- 💰 **Credit System**: Add credits to user accounts and track balances
- 🍻 **Inventory Management**: Manage drinks, stock levels, and categories
- 🛒 **Sales Terminal**: Point-of-sale interface for processing transactions
- 📊 **Transaction History**: Complete audit trail of all operations
- 🐳 **Dockerized**: Easy deployment with Docker Compose

## Technology Stack

**Backend**: Node.js, Express.js, PostgreSQL, Sequelize, JWT  
**Frontend**: Vue.js 3, Pinia, Vue Router, Vite  
**Deployment**: Docker, Docker Compose, Nginx

## Quick Start

### Prerequisites
- Docker and Docker Compose

### 1. Clone and Setup Environment
```bash
git clone <repository-url>
cd beermachine_v3

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)
```

### 2.1 Development Setup Docker
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build
# Access the application:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

### 2.2 Development Setup Docker DB local FE and BE
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up postgres -d
# to start backend
cd backend
pnpm start
# to start frontend
cd frontend
npm run dev
# Access the application:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

### 3. Production Setup
```bash
# Start production environment
docker-compose up --build -d

# Access the application:
# Frontend: http://localhost
# Backend API: http://localhost:8080
```

### 4. Initial Setup
1. Open the application in your browser
2. Click "Create Admin Account" on the login page
3. Create your first admin user
4. Log in and start managing users and drinks

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Application Settings
NODE_ENV=development
BEPORT=8080
BEURL=http://localhost:8080/api/v1
JWT_SECRET=your-secret-key-here

# Frontend Settings  
FEURL=http://localhost:5173
FEPORT=5173

# Database Settings (PostgreSQL)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=beermachine
DB_USER=postgres
DB_PASSWORD=password
```

**Required Variables:**
- `BEPORT`: Backend server port
- `BEURL`: Backend API URL for frontend
- `JWT_SECRET`: Secret key for JWT token generation
- `DB_*`: Database connection settings

## CSV Import Format

Import users in bulk using CSV files with the following format:

```csv
username,credits,dateOfBirth,isMember
513286,10,13-05-2002,true
john_doe,0,15-03-1995,false
```

**Fields:**
- `username`: Unique string identifier
- `credits`: Initial credit amount (number)
- `dateOfBirth`: DD-MM-YYYY format
- `isMember`: true for members, false for non-members

## API Endpoints

**Authentication**
- `POST /api/v1/auth/login` - Admin login
- `POST /api/v1/auth/create-admin` - Create admin user

**Users** (Admin only)
- `GET /api/v1/users` - List users with pagination/filters
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `POST /api/v1/users/:id/add-credits` - Add credits
- `POST /api/v1/users/import-csv` - CSV import
- `GET /api/v1/users/export-csv` - CSV export

**Drinks** (Admin only)
- `GET /api/v1/drinks` - List drinks
- `POST /api/v1/drinks` - Create drink
- `PUT /api/v1/drinks/:id` - Update drink
- `POST /api/v1/drinks/:id/add-stock` - Add stock
- `DELETE /api/v1/drinks/:id` - Delete drink

**Sales** (Admin only)
- `POST /api/v1/sales/sell` - Process sale
- `GET /api/v1/sales/history` - Transaction history
- `GET /api/v1/sales/stats` - Sales statistics

## CSV Import/Export

Import users in bulk using CSV files with this format:

```csv
username,credits,dateOfBirth,isMember
513286,10,13-05-2002,true
john_doe,0,15-03-1995,false
```

**Fields:**
- `username`: Unique identifier (string)
- `credits`: Initial credit amount (number)
- `dateOfBirth`: DD-MM-YYYY format
- `isMember`: true for members, false for non-members

## Development

### Local Development (without Docker)
```bash
# Backend
cd backend
pnpm install
pnpm dev

# Frontend (in another terminal)
cd frontend  
pnpm install
pnpm dev
```

### Testing
```bash
cd backend && pnpm test  # Backend tests
cd frontend && pnpm test:unit  # Frontend tests
```

## Troubleshooting

**Database Connection Issues**
- Ensure PostgreSQL container is running: `docker-compose logs postgres`
- Check environment variables in `.env`
- Verify database credentials

**API Connection Issues**  
- Confirm backend is running on correct port
- Check `BEURL` in `.env` matches frontend expectations
- Review CORS settings if accessing from different domains

**CSV Import Errors**
- Verify CSV format matches expected structure
- Ensure usernames are unique
- Check date format is DD-MM-YYYY

**View Logs**
```bash
docker-compose logs          # All services
docker-compose logs backend  # Backend only
docker-compose logs postgres # Database only
```

## License

Proprietary source avalable license
