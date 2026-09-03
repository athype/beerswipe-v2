import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { ApiKey, Drink, Transaction, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created = { keys: [], users: [], drinks: [], transactions: [] };

async function createAdmin(userType = "admin") {
  const admin = await User.create({
    username: `mgmt-${userType}-${uniqueSuffix()}`,
    userType,
    isActive: true,
  });
  created.users.push(admin.id);
  return admin;
}

function cookieFor(user) {
  return [`authToken=${generateToken(user)}`];
}

afterAll(async () => {
  // Dependency order: sales rows first, then keys, drinks, users.
  await Transaction.destroy({ where: { id: created.transactions } });
  await ApiKey.destroy({ where: { id: created.keys } });
  await Drink.destroy({ where: { id: created.drinks } });
  await User.destroy({ where: { id: created.users } });
});

describe("POST /api/v1/api-keys", () => {
  it("creates a key, returning the plaintext exactly once", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Kiosk bar" });

    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^bsk_[0-9a-f]{32}$/);
    expect(res.body.apiKey).toEqual({
      id: expect.any(Number),
      name: "Kiosk bar",
      prefix: res.body.key.slice(0, 12),
      scope: "admin", // default
      createdBy: admin.id,
      isRevoked: false,
      expiresAt: null,
      lastUsedAt: null,
      createdAt: expect.any(String),
    });
    created.keys.push(res.body.apiKey.id);

    // Never returned again anywhere
    const list = await request(app)
      .get("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(res.body.key);
  });

  it("accepts seller scope and a future expiry, echoing an ISO timestamp", async () => {
    const admin = await createAdmin();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Kiosk upstairs", scope: "seller", expiresAt });

    expect(res.status).toBe(201);
    expect(res.body.apiKey.scope).toBe("seller");
    expect(res.body.apiKey.expiresAt).toBe(expiresAt);
    created.keys.push(res.body.apiKey.id);
  });

  it("rejects invalid payloads with 400", async () => {
    const admin = await createAdmin();
    const cases = [
      { name: "" },
      { name: "x".repeat(51) },
      { name: "Fine", expiresAt: "2020-01-01T00:00:00.000Z" }, // past
      { name: "Fine", scope: "superuser" }, // invalid enum
    ];
    for (const body of cases) {
      const res = await request(app)
        .post("/api/v1/api-keys")
        .set("Cookie", cookieFor(admin))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it("is admin-only: seller cookie 403, no cookie 401", async () => {
    const seller = await createAdmin("seller");
    const forbidden = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(seller))
      .send({ name: "Nope" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Admin access required" });

    const anon = await request(app).post("/api/v1/api-keys").send({ name: "Nope" });
    expect(anon.status).toBe(401);
  });
});

describe("GET /api/v1/api-keys", () => {
  it("lists keys with creator usernames and never hashes", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "List me" });
    created.keys.push(create.body.apiKey.id);

    const res = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(res.status).toBe(200);
    const row = res.body.apiKeys.find((k) => k.id === create.body.apiKey.id);
    expect(row).toMatchObject({
      name: "List me",
      prefix: create.body.key.slice(0, 12),
      scope: "admin",
      creator: { id: admin.id, username: admin.username },
      isRevoked: false,
    });
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(create.body.key);
    expect(bodyText).not.toContain("keyHash");
  });
});

describe("POST /api/v1/api-keys/:id/revoke", () => {
  it("soft-deletes a key and tolerates double revoke", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Revoke me" });
    const id = create.body.apiKey.id;
    created.keys.push(id);

    const revoke = await request(app)
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set("Cookie", cookieFor(admin));
    expect(revoke.status).toBe(200);
    expect(revoke.body).toEqual({ message: "API key revoked" });

    const again = await request(app)
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set("Cookie", cookieFor(admin));
    expect(again.status).toBe(200);

    const list = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(list.body.apiKeys.find((k) => k.id === id).isRevoked).toBe(true);
  });

  it("404s on an unknown id", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post("/api/v1/api-keys/99999999/revoke")
      .set("Cookie", cookieFor(admin));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/api-keys/:id", () => {
  it("hard-deletes a key", async () => {
    const admin = await createAdmin();
    const create = await request(app)
      .post("/api/v1/api-keys")
      .set("Cookie", cookieFor(admin))
      .send({ name: "Delete me" });
    const id = create.body.apiKey.id;

    const del = await request(app).delete(`/api/v1/api-keys/${id}`).set("Cookie", cookieFor(admin));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ message: "API key deleted" });

    const list = await request(app).get("/api/v1/api-keys").set("Cookie", cookieFor(admin));
    expect(list.body.apiKeys.find((k) => k.id === id)).toBeUndefined();
  });

  it("404s on an unknown id", async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .delete("/api/v1/api-keys/99999999")
      .set("Cookie", cookieFor(admin));
    expect(res.status).toBe(404);
  });
});
