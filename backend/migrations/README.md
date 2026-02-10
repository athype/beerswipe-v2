# Database Migrations

This folder contains database migration scripts for the Beer Machine application.

## Running Migrations

### For Development
In development mode, the application uses `sequelize.sync({ alter: true })` which automatically updates the database schema. You typically don't need to run migrations manually.

### For Production
For production databases, you should run migrations manually to ensure controlled schema updates.

#### Migration 001: Add Seller User Type

This migration adds the 'seller' user type to the User model.

**To apply the migration:**
```bash
node --env-file=../.env migrations/001-add-seller-user-type.js up
```

**To revert the migration:**
```bash
node --env-file=../.env migrations/001-add-seller-user-type.js down
```

**Migrating in docker container**
```bash
# Connect to the running backend container
docker exec -it beermachine_backend sh

# Once inside the container, run the migration
node migrations/001-add-seller-user-type.js up

# Exit the container
exit
```

**Note:** The down migration will fail if seller users exist in the database. You must delete all seller users before reverting.

## Creating New Migrations

1. Create a new file with format: `XXX-description.js` (e.g., `002-add-new-field.js`)
2. Implement `up()` and `down()` functions
3. Export both functions
4. Add CLI support for running migrations directly
5. Document the migration in this README

## Migration Best Practices

- Always test migrations on a development/staging database first
- Backup production database before running migrations
- Migrations should be idempotent where possible
- Include proper error handling
- Document any data transformations
- Consider rollback scenarios
