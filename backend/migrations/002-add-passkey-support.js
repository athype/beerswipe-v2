/**
 * Migration: Add passkey support and seller user type
 * 
 * This migration:
 * 1. Adds 'seller' to userType enum
 * 2. Creates Passkeys table for WebAuthn authentication
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
  console.log("Running migration: Add passkey support and seller user type");
  
  try {
    // Step 1: Check if seller is already in the enum
    const [enumValues] = await sequelize.query(`
      SELECT e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'enum_Users_userType';
    `);
    
    const hasSeller = enumValues.some(row => row.enumlabel === 'seller');
    
    if (!hasSeller) {
      console.log("Adding 'seller' to userType enum...");
      
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Users_userType_new') THEN
            CREATE TYPE "enum_Users_userType_new" AS ENUM ('admin', 'seller', 'member', 'non-member');
          END IF;
        END$$;
      `);
      
      await sequelize.query(`
        ALTER TABLE "Users" 
          ALTER COLUMN "userType" TYPE "enum_Users_userType_new" 
          USING "userType"::text::"enum_Users_userType_new";
      `);
      
      await sequelize.query(`
        DROP TYPE IF EXISTS "enum_Users_userType";
      `);
      
      await sequelize.query(`
        ALTER TYPE "enum_Users_userType_new" RENAME TO "enum_Users_userType";
      `);
      
      console.log("✓ Updated userType enum");
    } else {
      console.log("✓ userType enum already contains 'seller' (skipped)");
    }
    
    // Step 2: Create Passkeys table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Passkeys" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
        "credentialId" TEXT NOT NULL UNIQUE,
        "publicKey" TEXT NOT NULL,
        "counter" BIGINT NOT NULL DEFAULT 0,
        "transports" TEXT[],
        "deviceName" VARCHAR(100),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_passkeys_userId" ON "Passkeys"("userId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_passkeys_credentialId" ON "Passkeys"("credentialId");
    `);
    
    console.log("✓ Created Passkeys table with indexes");
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

async function down() {
  console.log("Reverting migration: Remove passkey support (keeping seller user type)");
  
  try {
    // Only drop Passkeys table, keep seller type in case migration 001 needs it
    await sequelize.query(`DROP TABLE IF EXISTS "Passkeys";`);
    console.log("✓ Dropped Passkeys table");
    
    console.log("Note: Seller user type is preserved (managed by migration 001)");
    console.log("Migration reverted successfully");
  } catch (error) {
    console.error("Migration revert failed:", error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === "up") {
    await up();
  } else if (command === "down") {
    await down();
  } else {
    console.log("Usage: node migrations/002-add-passkey-support.js [up|down]");
    process.exit(1);
  }
  
  await sequelize.close();
  process.exit(0);
}

export { up, down };
