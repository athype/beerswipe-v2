import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test file imports src/app.js, which connects to Postgres, syncs the
    // schema, and runs the (find-then-create) admin seed on import. Files must
    // therefore execute one at a time: with parallel workers, two files can
    // race the seeding and one fails nondeterministically on the unique
    // username constraint.
    fileParallelism: false,
  },
});
