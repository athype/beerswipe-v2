import { Op } from "sequelize";
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
    username: `adjust-${userType}-${uniqueSuffix()}`,
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

function latestAdjustmentFor(userId) {
  return Transaction.findOne({
    where: { userId, type: "credit_adjustment" },
    order: [["id", "DESC"]],
  });
}

afterAll(async () => {
  // Neither Transactions FK cascades, so audit rows must go before the users.
  await Transaction.destroy({
    where: {
      [Op.or]: [
        { userId: createdUserIds },
        { adminId: createdUserIds },
      ],
    },
  });
  await User.destroy({ where: { id: createdUserIds } });
});

describe("credit adjustment audit trail", () => {
  it("undoing a raised balance deducts the credited amount back", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 10 });

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 50 })
      .expect(200);

    const audit = await latestAdjustmentFor(member.id);
    expect(audit.amount).toBe(40);

    const res = await request(app)
      .delete(`/api/v1/sales/undo/${audit.id}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);

    await member.reload();
    expect(member.credits).toBe(10);

    // The undo consumes the audit row.
    expect(await Transaction.findByPk(audit.id)).toBeNull();
  });

  it("undoing a lowered balance restores the removed credits", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 50 });

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 20 })
      .expect(200);

    const audit = await latestAdjustmentFor(member.id);
    expect(audit.amount).toBe(-30);

    const res = await request(app)
      .delete(`/api/v1/sales/undo/${audit.id}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);

    await member.reload();
    expect(member.credits).toBe(50);
  });

  it("refuses to undo a raise the member has already spent", async () => {
    const admin = await createUser("admin");
    // Balance was raised 10 -> 50, then all 50 were spent on sales.
    const member = await createUser("member", { credits: 0 });

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 50 })
      .expect(200);

    const audit = await latestAdjustmentFor(member.id);

    // Simulate the member spending the credits: undoing the adjustment would
    // have to drive the balance negative, so it must be refused instead.
    await member.update({ credits: 5 });

    const res = await request(app)
      .delete(`/api/v1/sales/undo/${audit.id}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient credits/i);

    await member.reload();
    expect(member.credits).toBe(5);

    // The row survives a refused undo so it can still be reversed later.
    expect(await Transaction.findByPk(audit.id)).not.toBeNull();
  });

  it("does not let sellers undo a credit adjustment", async () => {
    const admin = await createUser("admin");
    const seller = await createUser("seller");
    const member = await createUser("member", { credits: 10 });

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 30 })
      .expect(200);

    const audit = await latestAdjustmentFor(member.id);

    const res = await request(app)
      .delete(`/api/v1/sales/undo/${audit.id}`)
      .set("Cookie", cookieFor(seller));

    expect(res.status).toBe(403);

    await member.reload();
    expect(member.credits).toBe(30);
  });

  it("surfaces adjustments in the transaction history type filter", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 10 });

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 30 })
      .expect(200);

    const res = await request(app)
      .get(`/api/v1/sales/history?type=credit_adjustment&userId=${member.id}`)
      .set("Cookie", cookieFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].type).toBe("credit_adjustment");
    expect(res.body.transactions[0].amount).toBe(20);
  });

  it("leaves the credit-addition aggregate in stats untouched", async () => {
    const admin = await createUser("admin");
    const member = await createUser("member", { credits: 0 });

    const before = await request(app)
      .get("/api/v1/sales/stats")
      .set("Cookie", cookieFor(admin));

    await request(app)
      .put(`/api/v1/users/${member.id}`)
      .set("Cookie", cookieFor(admin))
      .send({ userCredits: 40 })
      .expect(200);

    const after = await request(app)
      .get("/api/v1/sales/stats")
      .set("Cookie", cookieFor(admin));

    // A balance edit is not a credit addition and must not inflate this total.
    expect(after.body.credits.totalCreditsAdded).toBe(before.body.credits.totalCreditsAdded);
    expect(after.body.credits.totalCreditAdditions).toBe(before.body.credits.totalCreditAdditions);
  });
});
