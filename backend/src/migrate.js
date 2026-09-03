import { DataTypes } from "sequelize";
import { sequelize } from "./config/database.js";

// Ordered schema migrations.
//
// Production boots with `sequelize.sync({ alter: false })`, so the database
// never changes shape by itself — every schema change after the initial sync
// belongs here as a step. Steps are idempotent (check before acting), so they
// are safe to run on every container start, in dev (where sync already alters)
// and against a fresh database (where sync created the column from the model).
//
// Steps run in order at every backend boot (see app.js) and can also be
// triggered manually:
//   node src/migrate.js
//   docker exec beermachine_backend node src/migrate.js
const MIGRATIONS = [
  {
    name: "2026-08-10/drinks-isAlcohol",
    up: async (queryInterface) => {
      let table;
      try {
        table = await queryInterface.describeTable("Drinks");
      }
      catch {
        // Table does not exist yet — sync() creates it with the column from the model.
        return false;
      }
      if (table.isAlcohol) {
        if (table.isAlcohol.allowNull) {
          await queryInterface.sequelize.query('UPDATE "Drinks" SET "isAlcohol" = false WHERE "isAlcohol" IS NULL;');
          await queryInterface.changeColumn("Drinks", "isAlcohol", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          });
          return true;
        }
        return false;
      }
      await queryInterface.addColumn("Drinks", "isAlcohol", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      return true;
    },
  },
  {
    name: "2026-09-03/api-keys",
    up: async (queryInterface) => {
      let table;
      try {
        table = await queryInterface.describeTable("ApiKeys");
      }
      catch {
        table = null;
      }
      // sync({ alter: false }) already creates missing tables from the model on
      // boot; this step exists for databases whose schema is not driven by sync
      // and for manual `node src/migrate.js` runs. Model and step stay in lockstep.
      if (table) {
        return false;
      }
      await queryInterface.createTable("ApiKeys", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        keyHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        prefix: { type: DataTypes.STRING(12), allowNull: false },
        scope: {
          type: DataTypes.ENUM("admin", "seller"),
          allowNull: false,
          defaultValue: "admin",
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
        },
        isRevoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        expiresAt: { type: DataTypes.DATE, allowNull: true },
        lastUsedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      return true;
    },
  },
];

export async function runMigrations() {
  const queryInterface = sequelize.getQueryInterface();

  for (const migration of MIGRATIONS) {
    const applied = await migration.up(queryInterface);
    /* eslint-disable no-console */
    console.log(`[migrate] ${applied ? "applied" : "up to date"}: ${migration.name}`);
    /* eslint-enable no-console */
  }
}

// Allow manual runs: `node src/migrate.js` (or via docker exec).
if (process.argv[1]?.endsWith("migrate.js")) {
  try {
    await sequelize.authenticate();
    await runMigrations();
    /* eslint-disable no-console */
    console.log("[migrate] done");
    /* eslint-enable no-console */
    process.exit(0);
  }
  catch (error) {
    console.error("[migrate] failed:", error);
    process.exit(1);
  }
}
