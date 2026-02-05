/**
 * Migration: Add 'seller' to userType enum
 * 
 * This migration adds the 'seller' user type to the existing User.userType enum.
 * Sellers have access to sales-related endpoints but not admin management features.
 * 
 * Run this migration if you already have a production database.
 * For development, Sequelize's alter: true will handle this automatically.
 */

import { Sequelize } from "sequelize";
import { env } from "../src/env.js";

const sequelize = new Sequelize(env.DATABASE_URL || env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "postgres",
  logging: console.log,
});

async function up() {
  
  console.log("Running migration: Add 'seller' to userType enum");
  
  try {
    // For PostgreSQL, we need to alter the enum type
    // This is done by creating a new type and converting the column
    
    await sequelize.query(`
      -- Step 1: Create a new enum type with the seller value
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Users_userType_new') THEN
          CREATE TYPE "enum_Users_userType_new" AS ENUM ('admin', 'seller', 'member', 'non-member');
        END IF;
      END$$;
    `);
    
    await sequelize.query(`
      -- Step 2: Alter the column to use the new type
      ALTER TABLE "Users" 
        ALTER COLUMN "userType" TYPE "enum_Users_userType_new" 
        USING "userType"::text::"enum_Users_userType_new";
    `);
    
    await sequelize.query(`
      -- Step 3: Drop the old enum type
      DROP TYPE IF EXISTS "enum_Users_userType";
    `);
    
    await sequelize.query(`
      -- Step 4: Rename the new type to the original name
      ALTER TYPE "enum_Users_userType_new" RENAME TO "enum_Users_userType";
    `);
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

async function down() {
  
  console.log("Reverting migration: Remove 'seller' from userType enum");
  
  try {
    // Check if any users have seller type
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "Users" WHERE "userType" = 'seller';
    `);
    
    if (results[0].count > 0) {
      throw new Error(`Cannot revert migration: ${results[0].count} seller users exist. Delete them first.`);
    }
    
    // Revert to original enum without seller
    await sequelize.query(`
      CREATE TYPE "enum_Users_userType_new" AS ENUM ('admin', 'member', 'non-member');
    `);
    
    await sequelize.query(`
      ALTER TABLE "Users" 
        ALTER COLUMN "userType" TYPE "enum_Users_userType_new" 
        USING "userType"::text::"enum_Users_userType_new";
    `);
    
    await sequelize.query(`
      DROP TYPE "enum_Users_userType";
    `);
    
    await sequelize.query(`
      ALTER TYPE "enum_Users_userType_new" RENAME TO "enum_Users_userType";
    `);
    
    console.log("Migration reverted successfully");
  } catch (error) {
    console.error("Migration revert failed:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === "up") {
    await up();
  } else if (command === "down") {
    await down();
  } else {
    console.log("Usage: node migrations/001-add-seller-user-type.js [up|down]");
    process.exit(1);
  }
  
  await sequelize.close();
  process.exit(0);
}

export { up, down };
