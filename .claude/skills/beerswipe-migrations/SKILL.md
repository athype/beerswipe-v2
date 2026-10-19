---
name: beerswipe-migrations
description: Use when adding, changing, or debugging a database column, table, enum value, or index in beerswipe-v2. Covers the backend/src/migrate.js auto-migrator contract, the migrate-before-sync boot order, and the production failure modes that follow from getting either wrong.
---

# Beerswipe schema migrations

## Where schema changes go

Every schema change is an ordered, idempotent step in the `MIGRATIONS` array in `backend/src/migrate.js`. Do not add files to `backend/migrations/`; that directory is legacy (`002-add-passkey-support.js` predates the migrator).

A step has this shape:

```js
{
  name: "YYYY-MM-DD/feature",
  up: async (queryInterface) => {
    // inspect first, act only if needed
    return true;   // applied
    // return false; // already up to date
  },
}
```

Add the step at the end of `MIGRATIONS`. `runMigrations()` executes the array in order on every backend boot and logs `[migrate] applied: <name>` or `[migrate] up to date: <name>`.

Manual runs:

```bash
node src/migrate.js
docker exec beermachine_backend node src/migrate.js
```

## Boot order is load-bearing

`initializeDatabase()` in `backend/src/config/database.js` does, in this order:

1. `sequelize.authenticate()`
2. `runMigrations()`
3. `sequelize.sync({ alter: NODE_ENV === "development" })`
4. `runSeeds()`

Migrations run **before** `sync()`. Production syncs with `alter: false`, so it never adds a column to an existing table, but it does reconcile the model-declared indexes on every boot. If a model declares an index on a column that only the migrator adds, the column must exist before sync runs or boot fails with `column ... does not exist` and the container never starts. That is the 2026-10-09 `Transactions.saleGroupId` incident.

The comment in `docker-compose.deploy.yml` that says migrations run "after sync, before listening" is stale. The code, `AGENTS.md` and `backend/src/config/database.js` are the source of truth.

## Rules for every step

- Idempotent: inspect with `describeTable`, `showIndex` or `pg_type`, act only when needed.
- Return `true` when you changed something, `false` when it was already correct. The value is used for logging, not control flow.
- Fresh database: if the table does not exist, return `false` and let `sync()` create it from the model.
- New table with a foreign key: no-op when the parent table is missing. On an initialized database, `createTable` is what creates the table; keep the step and the model in lockstep.
- Check the column and the index separately. Dev's `sync({ alter: true })` can add a column without creating the model's index.
- Enum values: if `pg_type` has no row for the type, return `false` (fresh database). Otherwise check `pg_enum` and run `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- Backfilling a non-null column: add it nullable or with a default, update existing NULLs, then `changeColumn` to `allowNull: false`. See `2026-08-10/drinks-isAlcohol`.
- Never call `sequelize.sync()` inside a step. Do not import models into `migrate.js`; use `queryInterface` and raw SQL.
- Use the exact table and column names from the Sequelize models. Postgres identifiers are case-sensitive when quoted; the existing steps quote camelCase identifiers.

## Template: add a column

```js
{
  name: "2026-10-19/drinks-exampleField",
  up: async (queryInterface) => {
    let table;
    try {
      table = await queryInterface.describeTable("Drinks");
    }
    catch {
      // Fresh database: sync() creates the column from the model.
      return false;
    }
    if (table.exampleField) {
      return false;
    }
    await queryInterface.addColumn("Drinks", "exampleField", {
      type: DataTypes.STRING(50),
      allowNull: true,
    });
    return true;
  },
},
```

## Template: new table with a foreign key

```js
{
  name: "2026-10-19/example-table",
  up: async (queryInterface) => {
    let users;
    try {
      users = await queryInterface.describeTable("Users");
    }
    catch {
      users = null;
    }
    if (!users) {
      // Fresh database: sync() creates every table from the models.
      return false;
    }

    let table;
    try {
      table = await queryInterface.describeTable("ExampleThings");
    }
    catch {
      table = null;
    }
    if (table) {
      return false;
    }

    await queryInterface.createTable("ExampleThings", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    return true;
  },
},
```

## Checklist

1. Update the Sequelize model first, including any index declaration.
2. Add the migration step at the end of `MIGRATIONS` with a `YYYY-MM-DD/feature` name.
3. Run `node src/migrate.js` and confirm the expected `[migrate]` lines.
4. Test both paths: an existing database (step applies once) and a fresh database (step no-ops and sync creates everything).
5. Run `pnpm --filter @beerswipe/backend run typecheck` and `pnpm --filter @beerswipe/backend test`.
6. In the PR, reference the `migrate.js` step, never a legacy migration file.

## Failure modes to check first

- Container restarts with `column ... does not exist` at sync: a model index references a column the migration did not add before sync.
- Step logs `up to date` on an initialized database: a guard returns false too early, or the step was inserted before an earlier step that creates the table.
- Fresh database fails on a foreign key: the step tried to create a table before its parent existed. Add the parent-table guard.
- Deploy fails at backend boot: a throwing step blocks startup because migrations run before sync and before the server listens. Fix forward with an idempotent step or roll back `IMAGE_TAG`; see the `coolify-deploy` skill.
