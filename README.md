# Beer Machine v3

A comprehensive drink selling and management system designed for student associations. This system provides user management, inventory tracking, sales processing, and transaction history with a modern web interface.

## Features

### Authentication & User Management
- **Admin Login**: Secure JWT-based authentication for admin users
- **User Types**: Support for admins, members, and donators
- **Bulk Import**: CSV import functionality for bulk user creation
- **User Search**: Quick search and filtering capabilities

### Credit System
- **Block Credit Addition**: Add credits in blocks of 10 (no payment processing)
- **Balance Tracking**: Real-time credit balance monitoring
- **Transaction History**: Complete audit trail of all credit operations

### Inventory Management
- **Drink Management**: Add, edit, and manage drink inventory
- **Stock Tracking**: Real-time stock levels with low-stock alerts
- **Category Organization**: Organize drinks by categories
- **Price Management**: Flexible pricing in credits

### Sales Terminal
- **Quick Sales**: Intuitive point-of-sale interface
- **Customer Search**: Fast customer lookup and selection
- **Shopping Cart**: Multi-item sales with quantity controls
- **Real-time Updates**: Instant inventory and balance updates

### Reporting & Analytics
- **Transaction History**: Detailed transaction logs with filtering
- **Sales Analytics**: Revenue tracking and top-selling items
- **Export Capabilities**: Data export for external analysis
- **Dashboard Metrics**: Key performance indicators and statistics

### Technical Features
- **Multi-Environment**: SQLite for development, PostgreSQL for production
- **Dockerized**: Complete containerization with Docker Compose
- **RESTful API**: Clean API design with proper error handling
- **Responsive UI**: Modern Vue.js frontend with mobile support
- **Data Validation**: Comprehensive input validation and sanitization

## Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js 5
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Sequelize
- **Authentication**: JWT with bcryptjs
- **Validation**: Zod schemas
- **File Processing**: Multer for CSV uploads

### Frontend
- **Framework**: Vue.js 3
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **HTTP Client**: Axios
- **Build Tool**: Vite
- **CSS**: Scoped component styles

### DevOps
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (production)
- **Environment Management**: Multi-stage configurations
- **Database**: PostgreSQL with persistent volumes

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git for cloning the repository

### 1. Clone the Repository
```bash
git clone <repository-url>
cd beermachine_v3
```

### 2. Development Setup
```bash
# Start development environment with SQLite
docker-compose -f docker-compose.dev.yml up --build

# Start the postgres db for development
docker-compose -f docker-compose.dev.yml up postgres -d

# The application will be available at:
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
```

### 3. Production Setup
```bash
# Start production environment with PostgreSQL
docker-compose up --build -d

# The application will be available at:
# Frontend: http://localhost
# Backend API: http://localhost:3000
```

### 4. Initial Setup
1. Open the application in your browser
2. Click "Create Admin Account" on the login page
3. Create your first admin user
4. Log in with your admin credentials

## Configuration

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development|production|test
PORT=3000
JWT_SECRET=your-secret-key

# PostgreSQL (production)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=beermachine
DB_USER=postgres
DB_PASSWORD=password
```

#### Frontend (Vite configuration)
```env
VITE_API_URL=http://localhost:3000/api/v1
```

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
- `isMember`: true for members, false for donators

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Admin login
- `POST /api/v1/auth/create-admin` - Create admin user

### Users
- `GET /api/v1/users` - List users (with pagination and filters)
- `POST /api/v1/users` - Create new user
- `POST /api/v1/users/:id/add-credits` - Add credits to user
- `POST /api/v1/users/import-csv` - Bulk import from CSV
- `PUT /api/v1/users/:id` - Update user

### Drinks
- `GET /api/v1/drinks` - List drinks (with pagination and filters)
- `POST /api/v1/drinks` - Create new drink
- `PUT /api/v1/drinks/:id` - Update drink
- `POST /api/v1/drinks/:id/add-stock` - Add inventory stock
- `DELETE /api/v1/drinks/:id` - Soft delete drink

### Sales
- `POST /api/v1/sales/sell` - Process sale transaction
- `GET /api/v1/sales/history` - Transaction history
- `GET /api/v1/sales/stats` - Sales statistics

## Database Schema

### Users Table
- `id` (Primary Key)
- `username` (Unique)
- `password` (Hashed, nullable for non-admin users)
- `credits` (Integer, default 0)
- `dateOfBirth` (Date, nullable)
- `userType` (Enum: admin, member, donator)
- `isActive` (Boolean, default true)

### Drinks Table
- `id` (Primary Key)
- `name` (Unique)
- `description` (Text, nullable)
- `price` (Integer, credits)
- `stock` (Integer, default 0)
- `category` (String, default 'beverage')
- `isActive` (Boolean, default true)

### Transactions Table
- `id` (Primary Key)
- `userId` (Foreign Key to Users)
- `drinkId` (Foreign Key to Drinks, nullable)
- `adminId` (Foreign Key to Users - processing admin)
- `type` (Enum: sale, credit_addition)
- `amount` (Integer, credits involved)
- `quantity` (Integer, for sales)
- `description` (String)
- `transactionDate` (DateTime, auto-generated)

## Development

### Backend Development
```bash
cd backend
pnpm install
pnpm dev  # Starts with file watching
```

### Frontend Development
```bash
cd frontend
pnpm install
pnpm dev  # Starts Vite dev server
```

### Running Tests
```bash
# Backend tests
cd backend
pnpm test

# Frontend tests
cd frontend
pnpm test:unit
```

## Deployment

### Docker Production
1. Update environment variables in `.env.production`
2. Build and start services:
```bash
docker-compose up --build -d
```

### Manual Deployment
1. Build frontend: `cd frontend && pnpm build`
2. Set environment variables for production
3. Start backend: `cd backend && pnpm start`
4. Serve frontend static files with nginx

## Security Considerations

- JWT tokens expire after 24 hours
- Passwords are hashed with bcryptjs
- Input validation on all endpoints
- SQL injection protection via Sequelize
- CORS configured for development/production
- Helmet.js for security headers

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Check PostgreSQL container is running
- Verify environment variables
- Check network connectivity between containers

**Frontend API Calls Failing**
- Ensure backend is running on correct port
- Check CORS configuration
- Verify API URL in frontend environment

**CSV Import Errors**
- Check file format matches expected structure
- Ensure usernames are unique
- Verify date format (DD-MM-YYYY)

### Logs
```bash
# View all container logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Create an issue in the repository with:
   - Error description
   - Steps to reproduce
   - Environment details
   - Relevant log output
