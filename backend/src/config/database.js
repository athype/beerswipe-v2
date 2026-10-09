import { Sequelize } from "sequelize";
import { env } from "../env.js";

// Use PostgreSQL for both development and production
const sequelize = new Sequelize(env.DATABASE_URL || env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "postgres",
  logging: env.NODE_ENV === "development" ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export { sequelize };

export async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    // Migrate before sync. Production syncs with `alter: false`, so it never
    // adds a column to an existing table — but it does reconcile the model's
    // declared indexes on every boot. An index whose column only the migrator
    // adds (Transactions.saleGroupId) must therefore land first, or sync fails
    // with `column ... does not exist` and the container never starts.
    const { runMigrations } = await import("../migrate.js");
    await runMigrations();

    await sequelize.sync({ alter: env.NODE_ENV === "development" });
    console.log("All models were synchronized successfully.");

    const { runSeeds } = await import("../seeds/index.js");
    await runSeeds();
  }
  catch (error) {
    console.error("Unable to connect to the database:", error);
    throw error;
  }
}
