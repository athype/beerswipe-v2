import express from "express";
import helmet from "helmet";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import docsRouter from "../src/api-docs.js";
import { apiDocsEnabled } from "../src/env.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Assigning undefined to process.env writes the string "undefined" — delete instead.
  if (ORIGINAL_ENV.ENABLE_API_DOCS === undefined)
    delete process.env.ENABLE_API_DOCS;
  else
    process.env.ENABLE_API_DOCS = ORIGINAL_ENV.ENABLE_API_DOCS;
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
});

// Every route declared in backend/src/api/*.js, as [openapi path, method].
// A route added without OpenAPI docs fails the "documents every endpoint"
// test below.
const EXPECTED_OPERATIONS = [
  // api/index.js
  ["/", "get"],
  // auth
  ["/auth/login", "post"],
  ["/auth/me", "get"],
  ["/auth/logout", "post"],
  ["/auth/create-admin", "post"],
  // users
  ["/users", "get"],
  ["/users/export-csv", "get"],
  ["/users/{id}", "get"],
  ["/users", "post"],
  ["/users/{id}/add-credits", "post"],
  ["/users/import-csv", "post"],
  ["/users/{id}", "put"],
  // drinks
  ["/drinks/export-csv", "get"],
  ["/drinks", "get"],
  ["/drinks/{id}", "get"],
  ["/drinks", "post"],
  ["/drinks/{id}", "put"],
  ["/drinks/{id}/add-stock", "post"],
  ["/drinks/import-csv", "post"],
  ["/drinks/{id}", "delete"],
  // sales
  ["/sales/sell", "post"],
  ["/sales/history", "get"],
  ["/sales/stats", "get"],
  ["/sales/undo/{transactionId}", "delete"],
  // leaderboard
  ["/leaderboard/monthly", "get"],
  ["/leaderboard/rank/{userId}", "get"],
  // passkeys
  ["/passkeys/register-options", "post"],
  ["/passkeys/register-verify", "post"],
  ["/passkeys/login-options", "post"],
  ["/passkeys/login-verify", "post"],
  ["/passkeys", "get"],
  ["/passkeys/{id}", "delete"],
  ["/passkeys/{id}", "put"],
  // admin
  ["/admin", "get"],
  ["/admin/profile", "get"],
  ["/admin/profile", "put"],
  ["/admin", "post"],
  ["/admin/{id}", "put"],
  ["/admin/{id}", "delete"],
  // api keys
  ["/api-keys", "get"],
  ["/api-keys", "post"],
  ["/api-keys/{id}/revoke", "post"],
  ["/api-keys/{id}", "delete"],
];

// Mounts the docs router exactly like production does (api/index.js mounts
// it at /docs under the /api/v1 prefix), minus the database.
function createDocsApp(router) {
  const app = express();
  app.use(helmet());
  app.get("/control", (_req, res) => res.send("ok"));
  app.use("/api/v1/docs", router);
  return app;
}

async function fetchSpec(app) {
  const res = await request(app).get("/api/v1/docs/spec.json");
  return { res, spec: res.body };
}

describe("apiDocsEnabled()", () => {
  it("is enabled by default outside production", () => {
    delete process.env.ENABLE_API_DOCS;
    process.env.NODE_ENV = "development";
    expect(apiDocsEnabled()).toBe(true);
  });

  it("is disabled by default in production", () => {
    delete process.env.ENABLE_API_DOCS;
    process.env.NODE_ENV = "production";
    expect(apiDocsEnabled()).toBe(false);
  });

  it("ENABLE_API_DOCS=true overrides production", () => {
    process.env.ENABLE_API_DOCS = "true";
    process.env.NODE_ENV = "production";
    expect(apiDocsEnabled()).toBe(true);
  });

  it("ENABLE_API_DOCS=false disables docs in development", () => {
    process.env.ENABLE_API_DOCS = "false";
    process.env.NODE_ENV = "development";
    expect(apiDocsEnabled()).toBe(false);
  });
});

describe("API docs (enabled by default in test env)", () => {
  const app = createDocsApp(docsRouter);

  it("serves the Swagger UI at /api/v1/docs/", async () => {
    const res = await request(app)
      .get("/api/v1/docs/")
      .expect("Content-Type", /text\/html/)
      .expect(200);

    expect(res.text).toMatch(/id="swagger-ui"/);
    expect(res.text).toContain("Beer Machine API");
  });

  it("exposes the raw spec at /api/v1/docs/spec.json", async () => {
    const { res, spec } = await fetchSpec(app);

    expect(res.status).toBe(200);
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBeTruthy();
    expect(spec.servers).toEqual([{ url: "/api/v1" }]);
    expect(spec.components.securitySchemes.authToken).toEqual(expect.objectContaining({
      type: "apiKey",
      in: "cookie",
      name: "authToken",
    }));
  });

  it("documents every endpoint in the API surface", async () => {
    const { spec } = await fetchSpec(app);

    const missing = EXPECTED_OPERATIONS.filter(([path, method]) => {
      const operation = spec.paths?.[path]?.[method];
      return !operation || typeof operation.summary !== "string" || operation.summary.length === 0;
    });
    const withoutSuccessResponse = EXPECTED_OPERATIONS.filter(([path, method]) => {
      const operation = spec.paths?.[path]?.[method];
      return !operation || !Object.keys(operation.responses ?? {}).some(code => code.startsWith("2"));
    });

    expect({ missing, withoutSuccessResponse }).toEqual({ missing: [], withoutSuccessResponse: [] });
  });

  it("relaxes the helmet CSP for the docs route only", async () => {
    const control = await request(app).get("/control");
    expect(control.headers["content-security-policy"]).toBeTruthy();

    const { res } = await fetchSpec(app);
    expect(res.status).toBe(200);
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });
});

describe("API docs (disabled)", () => {
  it("returns 404 when ENABLE_API_DOCS=false", async () => {
    process.env.ENABLE_API_DOCS = "false";

    // Fresh module registry so the gating decision sees the new env var.
    vi.resetModules();
    const freshDocsRouter = (await import("../src/api-docs.js")).default;
    const app = createDocsApp(freshDocsRouter);

    await request(app).get("/api/v1/docs/").expect(404);
    await request(app).get("/api/v1/docs/spec.json").expect(404);
  });
});
