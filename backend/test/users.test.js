import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { User } from "../src/models/index.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const createdUserIds = [];

async function createUser(userType, extra = {}) {
  const user = await User.create({
    username: `users-${userType}-${uniqueSuffix()}`,
    userType,
    isActive: true,
    ...extra,
  });
  createdUserIds.push(user.id);
  return user;
}

function cookieFor(user) {
  return [`authToken=${generateToken(user)}`];
}

afterAll(async () => {
  await User.destroy({ where: { id: createdUserIds } });
});

describe("PUT /api/v1/users/:id", () => {
  it("updates the credit balance along with the other fields", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 10 });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 30, isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user.credits).toBe(30);
    expect(res.body.user.isActive).toBe(false);

    await member.reload();
    expect(member.credits).toBe(30);
  });

  it("leaves credits unchanged when userCredits is omitted", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 20 });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ username: `renamed-${uniqueSuffix()}` });

    expect(res.status).toBe(200);
    expect(res.body.user.credits).toBe(20);
  });

  it("clears the date of birth when null is sent", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { dateOfBirth: "2000-01-01" });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ dateOfBirth: null });

    expect(res.status).toBe(200);
    expect(res.body.user.dateOfBirth).toBeNull();

    await member.reload();
    expect(member.dateOfBirth).toBeNull();
  });

  it("leaves the date of birth unchanged when it is omitted", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { dateOfBirth: "2000-01-01" });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.user.dateOfBirth).toBe("2000-01-01");

    await member.reload();
    expect(member.dateOfBirth).toBe("2000-01-01");
  });

  it("rejects negative or non-integer credits without changing the balance", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 20 });

    for (const userCredits of [-10, 1.5]) {
      const res = await request(app)
        .put(`/api/v1/users/${member.id}`)
        .set("Cookie", cookieFor(admin))
        .send({ userCredits });

      expect(res.status).toBe(400);
    }

    await member.reload();
    expect(member.credits).toBe(20);
  });

  it("is admin-only", async () => {
    const seller = await createUser("seller");
    const member = await createUser("member", { credits: 20 });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(seller))
      .send({ userCredits: 10 });

    expect(res.status).toBe(403);
  });
});
