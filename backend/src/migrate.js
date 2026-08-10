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
