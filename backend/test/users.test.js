import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { Transaction, User } from "../src/models/index.js";

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
  // Both FKs on Transactions point at Users and neither cascades, so audit rows
  // have to go first or the user delete fails on the foreign key.
  await Transaction.destroy({
    where: {
      userId: createdUserIds,
    },
  });
  await Transaction.destroy({
    where: {
      adminId: createdUserIds,
    },
  });
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

  it("records a credit_adjustment audit row for a raised balance", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 10 });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 50 });

    expect(res.status).toBe(200);

    const audit = await Transaction.findOne({
      where: { userId: member.id, type: "credit_adjustment" },
      order: [["id", "DESC"]],
    });

    expect(audit).not.toBeNull();
    expect(audit.amount).toBe(40);
    expect(audit.adminId).toBe(admin.id);
    // The description is the human-readable half of the audit trail.
    expect(audit.description).toContain("10");
    expect(audit.description).toContain("50");
  });

  it("records a negative amount when the edit lowers the balance", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 50 });

    const res = await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 20 });

    expect(res.status).toBe(200);

    const audit = await Transaction.findOne({
      where: { userId: member.id, type: "credit_adjustment" },
      order: [["id", "DESC"]],
    });

    expect(audit).not.toBeNull();
    expect(audit.amount).toBe(-30);
  });

  it("records nothing when the balance is unchanged or omitted", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 20 });

    // Omitted entirely...
    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ isActive: false });

    // ...and sent with the value it already holds.
    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 20 });

    const count = await Transaction.count({
      where: { userId: member.id, type: "credit_adjustment" },
    });

    expect(count).toBe(0);
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
