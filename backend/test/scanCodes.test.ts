import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { ApiKey, ScanCode, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";
import { generateScanCode } from "../src/utils/scanCodeCrypto.ts";
import { scanCodeParamSchema } from "../src/validation/contracts.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created: { users: number[]; keys: number[] } = { users: [], keys: [] };

type TestUser = {
  id: number;
  username: string;
  userType: string;
  credits: number;
};

async function createUser(
  userType: string,
  extra: { credits?: number; isActive?: boolean } = {},
): Promise<TestUser> {
  const username = `scan-${userType}-${uniqueSuffix()}`;
  const user = await User.create({
    username,
    userType,
    isActive: extra.isActive ?? true,
    credits: extra.credits ?? 0,
  });
  const id = user.get("id") as number;
  created.users.push(id);
  return { id, username, userType, credits: user.get("credits") as number };
}

function cookieFor(user: TestUser) {
  return [`authToken=${generateToken(user)}`];
}

// Inserts a key row directly, like apiKeyAuth.test.js does.
async function seedKey(admin: TestUser, scope: string) {
  const plaintext = generateApiKey();
  const row = await ApiKey.create({
    name: `Scan key ${uniqueSuffix()}`,
    scope,
    keyHash: hashApiKey(plaintext),
    prefix: apiKeyPrefix(plaintext),
    createdBy: admin.id,
  });
  created.keys.push(row.get("id") as number);
  return plaintext;
}

async function seedScanCode(user: TestUser) {
  const code = generateScanCode();
  await ScanCode.create({ userId: user.id, code });
  return code;
}

afterAll(async () => {
  // ScanCodes cascade on user delete, but the suite convention is to clear
  // dependent rows explicitly, in FK order.
  await ScanCode.destroy({ where: { userId: created.users } });
  await ApiKey.destroy({ where: { id: created.keys } });
  await User.destroy({ where: { id: created.users } });
});

describe("scanCodeParamSchema", () => {
  it("normalizes casing and whitespace, and rejects anything but 32 hex chars", () => {
    const code = generateScanCode();

    expect(scanCodeParamSchema.parse(`  ${code.toUpperCase()}  `)).toBe(code);
    expect(generateScanCode()).toMatch(/^[0-9a-f]{32}$/);

    for (const bad of ["", "abc", "z".repeat(32), "0".repeat(33)]) {
      expect(scanCodeParamSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("GET /api/v1/users/:id/scan-code", () => {
  it("creates a code on first access, then returns the same one", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member");

    const first = await request(app)
      .get(`/api/v1/users/${member.id}/scan-code`)
      .set("Cookie", cookieFor(admin));

    expect(first.status).toBe(200);
    expect(first.body.code).toMatch(/^[0-9a-f]{32}$/);
    // The code is random: it must not be derived from the username.
    expect(first.body.code).not.toBe(member.username);

    const second = await request(app)
      .get(`/api/v1/users/${member.id}/scan-code`)
      .set("Cookie", cookieFor(admin));

    expect(second.status).toBe(200);
    expect(second.body.code).toBe(first.body.code);

    const rows = await ScanCode.findAll({ where: { userId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].get("code")).toBe(first.body.code);
  });

  it("is available to sellers and to a seller-scoped API key", async () => {
    const admin = await createUser("admin");
    const seller = await createUser("seller");
    const member = await createUser("member");
    const key = await seedKey(admin, "seller");

    const viaSeller = await request(app)
      .get(`/api/v1/users/${member.id}/scan-code`)
      .set("Cookie", cookieFor(seller));
    expect(viaSeller.status).toBe(200);

    const viaKey = await request(app)
      .get(`/api/v1/users/${member.id}/scan-code`)
      .set("X-API-Key", key);
    expect(viaKey.status).toBe(200);
    expect(viaKey.body.code).toMatch(/^[0-9a-f]{32}$/);
  });

  it("requires authentication and an admin-or-seller caller", async () => {
    const member = await createUser("member");

    const anonymous = await request(app).get(`/api/v1/users/${member.id}/scan-code`);
    expect(anonymous.status).toBe(401);

    const denied = await request(app)
      .get(`/api/v1/users/${member.id}/scan-code`)
      .set("Cookie", cookieFor(member));
    expect(denied.status).toBe(403);
  });

  it("404s for an unknown user and 400s for a non-numeric id", async () => {
    const admin = await createUser("admin");

    const missing = await request(app)
      .get("/api/v1/users/99999999/scan-code")
      .set("Cookie", cookieFor(admin));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "User not found" });

    const malformed = await request(app)
      .get("/api/v1/users/not-a-number/scan-code")
      .set("Cookie", cookieFor(admin));
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "Invalid user id" });
  });
});

describe("POST /api/v1/users/:id/scan-code/regenerate", () => {
  it("rotates the code in place and invalidates the previous one", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member");
    const oldCode = await seedScanCode(member);

    const res = await request(app)
      .post(`/api/v1/users/${member.id}/scan-code/regenerate`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^[0-9a-f]{32}$/);
    expect(res.body.code).not.toBe(oldCode);

    // The old code stops resolving immediately; the new one resolves.
    const stale = await request(app)
      .get(`/api/v1/scan/lookup/${oldCode}`)
      .set("Cookie", cookieFor(admin));
    expect(stale.status).toBe(404);

    const fresh = await request(app)
      .get(`/api/v1/scan/lookup/${res.body.code}`)
      .set("Cookie", cookieFor(admin));
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.id).toBe(member.id);

    // Rotation overwrites the row rather than adding history.
    const rows = await ScanCode.findAll({ where: { userId: member.id } });
    expect(rows).toHaveLength(1);
  });

  it("creates a code when the user does not have one yet", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member");

    const res = await request(app)
      .post(`/api/v1/users/${member.id}/scan-code/regenerate`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);

    const lookup = await request(app)
      .get(`/api/v1/scan/lookup/${res.body.code}`)
      .set("Cookie", cookieFor(admin));
    expect(lookup.status).toBe(200);
    expect(lookup.body.user.id).toBe(member.id);
  });

  it("404s for an unknown user and is admin-or-seller only", async () => {
    const member = await createUser("member");

    const missing = await request(app)
      .post("/api/v1/users/99999999/scan-code/regenerate")
      .set("Cookie", cookieFor(member));
    expect(missing.status).toBe(403);

    const denied = await request(app)
      .post(`/api/v1/users/${member.id}/scan-code/regenerate`)
      .set("Cookie", cookieFor(member));
    expect(denied.status).toBe(403);

    const admin = await createUser("admin");
    const unknown = await request(app)
      .post("/api/v1/users/99999999/scan-code/regenerate")
      .set("Cookie", cookieFor(admin));
    expect(unknown.status).toBe(404);
  });
});

describe("GET /api/v1/scan/lookup/:code", () => {
  it("resolves a code to exactly the fields the kiosk needs", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 25 });
    const code = await seedScanCode(member);

    const res = await request(app)
      .get(`/api/v1/scan/lookup/${code}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: member.id, username: member.username, credits: 25 },
    });
    // The code itself is never echoed back.
    expect(JSON.stringify(res.body)).not.toContain(code);
    expect(JSON.stringify(res.body)).not.toContain("scanCode");
  });

  it("accepts the code in any casing", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member");
    const code = await seedScanCode(member);

    const res = await request(app)
      .get(`/api/v1/scan/lookup/${code.toUpperCase()}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(member.id);
  });

  it("works with the kiosk's seller-scoped API key", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 10 });
    const code = await seedScanCode(member);
    const key = await seedKey(admin, "seller");

    const res = await request(app)
      .get(`/api/v1/scan/lookup/${code}`)
      .set("X-API-Key", key);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: member.id,
      username: member.username,
      credits: 10,
    });
  });

  it("404s for an unknown code and 400s for malformed ones", async () => {
    const admin = await createUser("admin");
    const cookie = cookieFor(admin);

    const unknown = await request(app)
      .get(`/api/v1/scan/lookup/${generateScanCode()}`)
      .set("Cookie", cookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: "Scan code not found" });

    for (const bad of ["abc", "z".repeat(32), "0".repeat(33), "not-a-code"]) {
      const res = await request(app)
        .get(`/api/v1/scan/lookup/${bad}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid scan code" });
    }
  });

  it("403s when the code resolves to an inactive user", async () => {
    const admin = await createUser("admin");
    const inactive = await createUser("member", { isActive: false });
    const code = await seedScanCode(inactive);

    const res = await request(app)
      .get(`/api/v1/scan/lookup/${code}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "User is inactive" });
  });

  it("requires authentication and an admin-or-seller caller", async () => {
    const member = await createUser("member");
    const code = await seedScanCode(member);

    const anonymous = await request(app).get(`/api/v1/scan/lookup/${code}`);
    expect(anonymous.status).toBe(401);

    const denied = await request(app)
      .get(`/api/v1/scan/lookup/${code}`)
      .set("Cookie", cookieFor(member));
    expect(denied.status).toBe(403);
  });
});
