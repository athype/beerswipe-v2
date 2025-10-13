# Beer Machine v3

A modern drink selling and management system for student associations. Features user management, credit system, inventory tracking, and sales processing with a responsive web interface.

## Features

- **Admin Authentication**: Secure JWT-based login system
- **User Management**: Support for admins, members, and non-members with CSV import/export
- **Credit System**: Add credits to user accounts and track balances
- **Inventory Management**: Manage drinks, stock levels, and categories
- **Sales Terminal**: Point-of-sale interface for processing transactions
- **Transaction History**: Complete audit trail of all operations
- **Dockerized**: Easy deployment with Docker Compose

## Technology Stack

**Backend**: Node.js, Express.js, PostgreSQL, Sequelize, JWT  
**Frontend**: Vue.js 3, Pinia, Vue Router, Vite  
**Deployment**: Docker, Docker Compose, Nginx, Caddy

## Quick Start

### Prerequisites
- Docker and Docker Compose
- (Production only) Domain name with DNS configured

### 1. Clone and Setup Environment
```bash
git clone <repository-url>
cd beerswipe-v2

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)
```

### 2. Development Setup (Local)

#### Option A: Full Docker Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build
# Access the application:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

#### Option B: Docker DB + Local Frontend & Backend
```bash
# Start PostgreSQL only
docker-compose -f docker-compose.dev.yml up postgres -d

# Start backend
cd backend
pnpm install
pnpm start

# Start frontend (in another terminal)
cd frontend
pnpm install
pnpm run dev

# Access the application:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

### 3. Production Setup (HTTPS with Caddy)

**Production domain:** https://beer.sv-ada.nl

```bash
# On your VPS/server
git clone <repository-url>
cd beerswipe-v2
git checkout beer-over-https

# Configure environment
cp .env.example .env
nano .env  # Update JWT_SECRET, DB_PASSWORD, and other production values

# Start services (includes automatic HTTPS via Caddy)
docker-compose up --build -d

# Check logs
docker-compose logs -f caddy
docker-compose logs -f frontend
docker-compose logs -f backend
```

**HTTPS is automatically handled by Caddy:**
- SSL certificates from Let's Encrypt
- Auto-renewal of certificates
- HTTP → HTTPS redirect
- Security headers configured

For detailed HTTPS setup instructions, see the **HTTPS Configuration** section below.

### 4. Initial Setup
1. Open the application in your browser
2. Click "Create Admin Account" on the login page
3. Create your first admin user
4. Log in and start managing users and drinks

## Environment Variables

Create a `.env` file in the root directory with the following variables:

**Development (localhost):**
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

**Production (beer.sv-ada.nl):**
```env
NODE_ENV=production
BEPORT=6969
BEURL=https://beer.sv-ada.nl
JWT_SECRET=your-super-secret-jwt-key-change-this

FEURL=https://beer.sv-ada.nl
FEPORT=443

DOMAIN=beer.sv-ada.nl

DB_HOST=postgres
DB_PORT=5432
DB_NAME=beermachine
DB_USER=postgres
DB_PASSWORD=your-secure-password-here
```

**Required Variables:**
- `NODE_ENV`: Environment (development/production)
- `BEPORT`: Backend server port
- `BEURL`: Backend API URL for frontend
- `JWT_SECRET`: Secret key for JWT token generation (change in production!)
- `DOMAIN`: Your domain name for HTTPS (production only)
- `DB_*`: Database connection settings

## HTTPS Configuration

The production setup uses **Caddy** as a reverse proxy for automatic HTTPS:

### Features:
- ✅ Automatic SSL certificates from Let's Encrypt
- ✅ Auto-renewal of certificates (no manual intervention)
- ✅ HTTP → HTTPS automatic redirect
- ✅ Security headers pre-configured
- ✅ Health checks for services

### Prerequisites for Production:
1. **Domain name** pointing to your server: `beer.sv-ada.nl`
2. **DNS A record** configured: `beer.sv-ada.nl → YOUR_VPS_IP`
3. **Ports open**: 80 (HTTP) and 443 (HTTPS)
4. **Email configured**: `info@sv-ada.nl` (for Let's Encrypt notifications)

### Deployment Steps:
```bash
# 1. Ensure DNS is configured
dig beer.sv-ada.nl  # Should return your VPS IP

# 2. Deploy with docker-compose
docker-compose up -d --build

# 3. Verify HTTPS is working
curl -I https://beer.sv-ada.nl  # Should show 200 OK with valid SSL

# 4. Check Caddy logs
docker-compose logs caddy
```

### Adding Subdomains (Future):
To add subdomains like `api.beer.sv-ada.nl` or `admin.beer.sv-ada.nl`, edit the `Caddyfile` and uncomment the relevant sections.

### Troubleshooting HTTPS:
- **Certificate not issued**: Check DNS propagation (can take 10-30 min)
- **Port blocked**: Verify firewall allows ports 80 and 443
- **Logs**: `docker-compose logs caddy` for detailed error messages

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
- `POST /api/v1/drinks/import-csv` - CSV stock import
- `GET /api/v1/drinks/export-csv` - CSV stock export
- `DELETE /api/v1/drinks/:id` - Delete drink

**Sales** (Admin only)
- `POST /api/v1/sales/sell` - Process sale
- `GET /api/v1/sales/history` - Transaction history
- `GET /api/v1/sales/stats` - Sales statistics

## CSV Import/Export

### Users Import/Export

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

### Stock Import/Export

Import and export stock (drinks) data using CSV files with this format:

```csv
name,description,price,stock,category,isActive
Heineken,Dutch lager beer,5,100,beverage,true
Coca Cola,Classic soft drink,3,150,beverage,true
Chips,Potato chips snack,2,50,snack,true
```

**Fields:**
- `name`: Drink name (required, unique)
- `description`: Drink description (optional)
- `price`: Price in credits (required for new drinks)
- `stock`: Stock quantity (number, default: 0)
- `category`: Category like "beverage", "snack" (default: "beverage")
- `isActive`: true or false (default: true)

**Import behavior:**
- Existing drinks (matched by name) will have their stock and other fields updated
- New drinks will be created if they don't exist
- You can use this to bulk update stock levels or add new products

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

### Database Connection Issues
- Ensure PostgreSQL container is running: `docker-compose logs postgres`
- Check environment variables in `.env`
- Verify database credentials

### API Connection Issues  
- Confirm backend is running on correct port
- Check `BEURL` in `.env` matches frontend expectations
- Review CORS settings if accessing from different domains

### HTTPS/SSL Issues (Production)
- **No certificate**: Check DNS points to correct IP (`dig beer.sv-ada.nl`)
- **Certificate errors**: Wait 10-30 min for DNS propagation
- **Port blocked**: Ensure firewall allows ports 80 and 443
- **Logs**: `docker-compose logs caddy` for detailed errors

### CSV Import Errors
- Verify CSV format matches expected structure
- Ensure usernames are unique
- Check date format is DD-MM-YYYY

### View Logs
```bash
docker-compose logs          # All services
docker-compose logs backend  # Backend only
docker-compose logs frontend # Frontend only
docker-compose logs postgres # Database only
docker-compose logs caddy    # Reverse proxy (production)
```

### Service Not Accessible
```bash
# Check all services are running
docker-compose ps

# Restart specific service
docker-compose restart frontend
docker-compose restart backend

# Rebuild if needed
docker-compose up -d --build
```

## Security Best Practices

### Production Checklist:
- [ ] Changed `JWT_SECRET` from default value
- [ ] Changed `DB_PASSWORD` from default value
- [ ] PostgreSQL not exposed externally (port 5432 not in docker-compose.yml ports)
- [ ] Using HTTPS in production (via Caddy)
- [ ] Domain DNS configured correctly
- [ ] Email configured in Caddyfile for SSL notifications
- [ ] Regular backups of PostgreSQL volume
- [ ] Environment variables not committed to git (.env in .gitignore)

### Network Security:
- Backend and database only accessible via internal Docker network
- Frontend served through Caddy reverse proxy
- HTTPS enforced with automatic redirect from HTTP
- Security headers configured in Caddy

## Architecture

```
Internet → Caddy (HTTPS) → Frontend (Nginx) → Backend (Express) → PostgreSQL
                  ↓
            SSL Certificates
            (Let's Encrypt)
```

**Production (beer.sv-ada.nl):**
- Caddy handles HTTPS termination and reverse proxying
- Frontend served as static files via Nginx
- Backend API accessible internally to frontend
- Database isolated in Docker network

## Backup and Recovery

### Database Backup:
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres beermachine > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres beermachine < backup.sql
```

### Volume Backup:
```bash
# Backup all volumes
docker run --rm -v beermachine_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data
```

## Additional Documentation

- **CODEOWNERS**: See `.github/CODEOWNERS` for repository ownership

## License

Proprietary source avalable license
