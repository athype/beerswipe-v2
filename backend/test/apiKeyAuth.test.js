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

async function createAdmin() {
  const admin = await User.create({
    username: `key-admin-${uniqueSuffix()}`,
    userType: "admin",
    isActive: true,
  });
  created.users.push(admin.id);
  return admin;
}

// Inserts a key row directly (the /api-keys routes arrive in Task 5).
async function seedKey(admin, { scope = "admin", isRevoked = false, expiresAt = null } = {}) {
  const plaintext = generateApiKey();
  const row = await ApiKey.create({
    name: `Seed key ${uniqueSuffix()}`,
    scope,
    keyHash: hashApiKey(plaintext),
    prefix: apiKeyPrefix(plaintext),
    createdBy: admin.id,
    isRevoked,
    expiresAt,
  });
  created.keys.push(row.id);
  return { plaintext, row };
}

async function createSellableUserAndDrink() {
  const user = await User.create({
    username: `key-buyer-${uniqueSuffix()}`,
    credits: 100,
    isActive: true,
  });
  created.users.push(user.id);
  const drink = await Drink.create({
    name: `Key drink ${uniqueSuffix()}`,
    price: 10,
    stock: 10,
    isActive: true,
    isAlcohol: false,
  });
  created.drinks.push(drink.id);
  return { user, drink };
}

afterAll(async () => {
  await Transaction.destroy({ where: { id: created.transactions } });
  await ApiKey.destroy({ where: { id: created.keys } });
  await Drink.destroy({ where: { id: created.drinks } });
  await User.destroy({ where: { id: created.users } });
});

describe("API key authentication", () => {
  it("rejects requests with no credential at all (unchanged 401)", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Access token required" });
  });

  it("authenticates /me with a valid key, honoring the key scope", async () => {
    const admin = await createAdmin();
    const { plaintext } = await seedKey(admin, { scope: "seller" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("X-API-Key", plaintext);

    expect(res.status).toBe(200);
    // /me wraps the user (CurrentUserResponse.user in @beerswipe/types).
    expect(res.body.user).toEqual({
      id: admin.id,
      username: admin.username,
      userType: "seller", // overlay: creator is admin, key scope is seller
      credits: admin.credits,
    });
  });

  it("treats unknown, revoked and expired keys as identical 401s", async () => {
    const admin = await createAdmin();
    const { plaintext: goodKey } = await seedKey(admin);
    const { plaintext: revokedKey } = await seedKey(admin, { isRevoked: true });
    const { plaintext: expiredKey } = await seedKey(admin, { expiresAt: new Date(Date.now() - 60_000) });
    const unknownKey = `bsk_${"0".repeat(32)}`;
    const badKeys = [unknownKey, revokedKey, expiredKey, "not-a-key"];

    // sanity: the good key works
    const ok = await request(app).get("/api/v1/auth/me").set("X-API-Key", goodKey);
    expect(ok.status).toBe(200);

    for (const key of badKeys) {
      const res = await request(app).get("/api/v1/auth/me").set("X-API-Key", key);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid API key" });
    }
  });

  it("lets an admin-scoped key sell and attributes the sale to the creator admin", async () => {
    const admin = await createAdmin();
    const { plaintext } = await seedKey(admin, { scope: "admin" });
    const { user, drink } = await createSellableUserAndDrink();

    const res = await request(app)
      .post("/api/v1/sales/sell")
      .set("X-API-Key", plaintext)
      .send({ userId: user.id, drinkId: drink.id, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.transaction.admin).toEqual({ id: admin.id, username: admin.username });
    expect(JSON.stringify(res.body)).not.toContain(plaintext);

    const sale = await Transaction.findOne({
      where: { type: "sale", userId: user.id },
      order: [["id", "DESC"]],
    });
    created.transactions.push(sale.id);
    expect(sale.adminId).toBe(admin.id);
  });

  it("keeps cookie auth working and never falls back past a presented JWT", async () => {
    const admin = await createAdmin();
    const token = generateToken(admin);
    const { plaintext } = await seedKey(admin);

    // Valid cookie + bogus key header: cookie wins (browser context).
    const cookieWins = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`authToken=${token}`])
      .set("X-API-Key", `bsk_${"f".repeat(32)}`);
    expect(cookieWins.status).toBe(200);
    expect(cookieWins.body.user.userType).toBe("admin");

    // Invalid JWT + valid key: the presented-but-invalid JWT fails (403), no fallback.
    const jwtWins = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", ["authToken=definitely-not-a-token"])
      .set("X-API-Key", plaintext);
    expect(jwtWins.status).toBe(403);
  });
});
