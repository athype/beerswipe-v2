import { Op } from "sequelize";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { Drink, Transaction, User } from "../src/models/index.js";

// Multi-item sales: one purchase is 1..N Transaction rows sharing a
// saleGroupId. Credits and stock are charged atomically, and undo reverses
// the whole order from any of its rows.

const createdUserIds = [];
const createdDrinkIds = [];

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

async function makeSeller() {
  const seller = await User.create({
    username: `multi-seller-${uniqueSuffix()}`,
    userType: "seller",
    isActive: true,
  });
  createdUserIds.push(seller.id);
  return { seller, token: generateToken(seller) };
}

async function makeAdmin() {
  const admin = await User.create({
    username: `multi-admin-${uniqueSuffix()}`,
    userType: "admin",
    isActive: true,
  });
  createdUserIds.push(admin.id);
  return { admin, token: generateToken(admin) };
}

async function makeUser({ credits = 100, dateOfBirth = null } = {}) {
  const user = await User.create({
    username: `multi-user-${uniqueSuffix()}`,
    userType: "member",
    credits,
    dateOfBirth,
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeDrink({ price = 4, stock = 20, isAlcohol = false } = {}) {
  const drink = await Drink.create({
    name: `multi-drink-${uniqueSuffix()}`,
    price,
    stock,
    isActive: true,
    isAlcohol,
  });
  createdDrinkIds.push(drink.id);
  return drink;
}

function sell(token, body) {
  return request(app)
    .post("/api/v1/sales/sell")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function undo(token, transactionId) {
  return request(app)
    .delete(`/api/v1/sales/undo/${transactionId}`)
    .set("Authorization", `Bearer ${token}`);
}

describe("POST /api/v1/sales/sell with items[]", () => {
  it("charges a multi-drink basket atomically and groups the rows", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 50 });
    const cola = await makeDrink({ price: 4, stock: 10 });
    const ipa = await makeDrink({ price: 6, stock: 10 });

    const res = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: cola.id, quantity: 2 },
        { drinkId: ipa.id, quantity: 3 },
      ],
    });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.transaction.totalCost).toBe(26);
    expect(res.body.transaction.totalQuantity).toBe(5);
    expect(res.body.transaction.saleGroupId).toEqual(expect.any(String));
    expect(res.body.transaction.items).toHaveLength(2);
    expect(res.body.transaction.user.remainingCredits).toBe(24);

    // Legacy fields describe the first item.
    expect(res.body.transaction.id).toBe(res.body.transaction.items[0].transactionId);
    expect(res.body.transaction.drink.id).toBe(cola.id);
    expect(res.body.transaction.quantity).toBe(2);

    await user.reload();
    await cola.reload();
    await ipa.reload();
    expect(user.credits).toBe(24);
    expect(cola.stock).toBe(8);
    expect(ipa.stock).toBe(7);

    const rows = await Transaction.findAll({
      where: { saleGroupId: res.body.transaction.saleGroupId },
      order: [["id", "ASC"]],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.amount)).toEqual([8, 18]);
    expect(rows.map(row => row.quantity)).toEqual([2, 3]);
    expect(rows.every(row => row.userId === user.id && row.type === "sale")).toBe(true);
  });

  it("keeps the legacy single-drink shape working, grouped as a sale of one", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 20 });
    const drink = await makeDrink({ price: 5, stock: 5 });

    const res = await sell(token, { userId: user.id, drinkId: drink.id, quantity: 2 });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.transaction).toMatchObject({
      drink: { id: drink.id, name: drink.name },
      quantity: 2,
      totalCost: 10,
      totalQuantity: 2,
    });
    expect(res.body.transaction.saleGroupId).toEqual(expect.any(String));
    expect(res.body.transaction.items).toHaveLength(1);
    expect(res.body.transaction.items[0]).toMatchObject({
      drinkId: drink.id,
      quantity: 2,
      unitPrice: 5,
      totalCost: 10,
    });
  });

  it("merges duplicate drinkIds into one row", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 20 });
    const drink = await makeDrink({ price: 3, stock: 10 });

    const res = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: drink.id, quantity: 1 },
        { drinkId: drink.id, quantity: 2 },
      ],
    });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.transaction.items).toHaveLength(1);
    expect(res.body.transaction.totalQuantity).toBe(3);
    expect(res.body.transaction.totalCost).toBe(9);

    await drink.reload();
    expect(drink.stock).toBe(7);

    const rows = await Transaction.findAll({ where: { saleGroupId: res.body.transaction.saleGroupId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);
  });

  it("rejects the whole basket when one drink is short on stock", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 50 });
    const ok = await makeDrink({ price: 4, stock: 10 });
    const short = await makeDrink({ price: 4, stock: 1 });

    const res = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: ok.id, quantity: 2 },
        { drinkId: short.id, quantity: 2 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(short.name);
    expect(res.body.unavailable).toEqual([
      { drinkId: short.id, name: short.name, requested: 2, available: 1 },
    ]);

    await user.reload();
    await ok.reload();
    await short.reload();
    expect(user.credits).toBe(50);
    expect(ok.stock).toBe(10);
    expect(short.stock).toBe(1);
    expect(await Transaction.count({ where: { userId: user.id, type: "sale" } })).toBe(0);
  });

  it("rejects the whole basket when credits are short", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 10 });
    const a = await makeDrink({ price: 4, stock: 10 });
    const b = await makeDrink({ price: 7, stock: 10 });

    const res = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: a.id, quantity: 2 },
        { drinkId: b.id, quantity: 1 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Insufficient credits", required: 15, available: 10 });

    await user.reload();
    await a.reload();
    await b.reload();
    expect(user.credits).toBe(10);
    expect(a.stock).toBe(10);
    expect(b.stock).toBe(10);
    expect(await Transaction.count({ where: { userId: user.id, type: "sale" } })).toBe(0);
  });

  it("applies the alcohol age gate to the whole basket", async () => {
    const { token } = await makeSeller();
    const minor = await makeUser({ credits: 50, dateOfBirth: null });
    const soda = await makeDrink({ price: 2, stock: 10 });
    const beer = await makeDrink({ price: 5, stock: 10, isAlcohol: true });

    const rejected = await sell(token, {
      userId: minor.id,
      items: [
        { drinkId: soda.id, quantity: 1 },
        { drinkId: beer.id, quantity: 1 },
      ],
    });

    expect(rejected.status).toBe(403);
    expect(rejected.body.error).toContain("no date of birth");

    const adult = await makeUser({ credits: 50, dateOfBirth: "1990-01-01" });
    const accepted = await sell(token, {
      userId: adult.id,
      items: [
        { drinkId: soda.id, quantity: 1 },
        { drinkId: beer.id, quantity: 1 },
      ],
    });

    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  });

  it("reports missing drinks with their id", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 20 });

    const res = await sell(token, {
      userId: user.id,
      items: [{ drinkId: 999_999_991, quantity: 1 }],
    });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Drink not found", drinkId: 999_999_991 });
  });
});

describe("DELETE /api/v1/sales/undo/:id with sale groups", () => {
  it("undoes the whole order from any row of the group", async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 50 });
    const cola = await makeDrink({ price: 4, stock: 10 });
    const ipa = await makeDrink({ price: 6, stock: 10 });

    const sale = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: cola.id, quantity: 2 },
        { drinkId: ipa.id, quantity: 3 },
      ],
    });
    expect(sale.status, JSON.stringify(sale.body)).toBe(200);

    const lastRowId = sale.body.transaction.items[1].transactionId;
    const res = await undo(token, lastRowId);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.undoTransaction.amount).toBe(26);
    expect(res.body.undoTransaction.quantity).toBe(5);
    expect(res.body.undoTransaction.saleGroupId).toBe(sale.body.transaction.saleGroupId);
    expect(res.body.undoTransaction.items).toHaveLength(2);

    await user.reload();
    await cola.reload();
    await ipa.reload();
    expect(user.credits).toBe(50);
    expect(cola.stock).toBe(10);
    expect(ipa.stock).toBe(10);
    expect(await Transaction.count({ where: { saleGroupId: sale.body.transaction.saleGroupId } })).toBe(0);
  });

  it("undoes a legacy row without a group on its own", async () => {
    const { seller, token } = await makeSeller();
    const user = await makeUser({ credits: 25 });
    const drink = await makeDrink({ price: 5, stock: 4 });

    const row = await Transaction.create({
      userId: user.id,
      drinkId: drink.id,
      adminId: seller.id,
      type: "sale",
      amount: 5,
      quantity: 1,
      saleGroupId: null,
      description: "Sale: 1x legacy",
    });

    const res = await undo(token, row.id);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.undoTransaction.saleGroupId).toBeNull();
    expect(res.body.undoTransaction.items).toHaveLength(1);
    expect(res.body.undoTransaction.amount).toBe(5);

    await user.reload();
    await drink.reload();
    expect(user.credits).toBe(30);
    expect(drink.stock).toBe(5);
  });

  it("applies the seller window to the oldest row of a group", async () => {
    const { token: sellerToken } = await makeSeller();
    const { token: adminToken } = await makeAdmin();
    const user = await makeUser({ credits: 50 });
    const a = await makeDrink({ price: 4, stock: 5 });
    const b = await makeDrink({ price: 4, stock: 5 });

    const sale = await sell(sellerToken, {
      userId: user.id,
      items: [
        { drinkId: a.id, quantity: 1 },
        { drinkId: b.id, quantity: 1 },
      ],
    });
    expect(sale.status, JSON.stringify(sale.body)).toBe(200);

    await Transaction.update(
      { transactionDate: new Date(Date.now() - 16 * 60 * 1000) },
      { where: { saleGroupId: sale.body.transaction.saleGroupId } },
    );

    const sellerUndo = await undo(sellerToken, sale.body.transaction.id);
    expect(sellerUndo.status).toBe(403);

    const adminUndo = await undo(adminToken, sale.body.transaction.id);
    expect(adminUndo.status, JSON.stringify(adminUndo.body)).toBe(200);
    expect(adminUndo.body.undoTransaction.items).toHaveLength(2);
  });

  it("restores a group exactly once when two undos race from different rows", { timeout: 60_000 }, async () => {
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 50 });
    const a = await makeDrink({ price: 4, stock: 10 });
    const b = await makeDrink({ price: 6, stock: 10 });

    const sale = await sell(token, {
      userId: user.id,
      items: [
        { drinkId: a.id, quantity: 2 },
        { drinkId: b.id, quantity: 1 },
      ],
    });
    expect(sale.status, JSON.stringify(sale.body)).toBe(200);

    const [first, second] = sale.body.transaction.items.map(item => item.transactionId);
    const [undo1, undo2] = await Promise.all([undo(token, first), undo(token, second)]);

    // Exactly one undo may win; the other must see the group as gone.
    expect(
      [undo1.status, undo2.status].sort(),
      JSON.stringify([undo1.body, undo2.body]),
    ).toEqual([200, 404]);

    await user.reload();
    await a.reload();
    await b.reload();
    expect(user.credits).toBe(50);
    expect(a.stock).toBe(10);
    expect(b.stock).toBe(10);
  });
});

describe("POST /api/v1/sales/sell multi-item under concurrency", () => {
  it("never over-commits credits or stock when baskets race", { timeout: 60_000 }, async () => {
    const CONCURRENCY = 6;
    const { token } = await makeSeller();
    const user = await makeUser({ credits: 50 });
    const a = await makeDrink({ price: 4, stock: 50 });
    const b = await makeDrink({ price: 8, stock: 50 });
    // Each basket costs 12 credits, so only 4 of the 6 requests can succeed.

    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        sell(token, {
          userId: user.id,
          items: [
            { drinkId: a.id, quantity: 1 },
            { drinkId: b.id, quantity: 1 },
          ],
        })),
    );

    const successes = responses.filter(r => r.status === 200).length;
    const rejected = responses.filter(r => r.status === 400).length;

    expect(
      rejected + successes,
      `unexpected response codes ${responses.map(r => r.status).join(",")}`,
    ).toBe(CONCURRENCY);
    expect(successes).toBe(4);

    await user.reload();
    await a.reload();
    await b.reload();
    expect(user.credits).toBe(50 - 12 * successes);
    expect(a.stock).toBe(50 - successes);
    expect(b.stock).toBe(50 - successes);
  });
});

afterAll(async () => {
  // Best-effort cleanup: remove sale rows first, then the fixtures.
  try {
    if (createdUserIds.length > 0) {
      await Transaction.destroy({
        where: {
          [Op.or]: [
            { userId: { [Op.in]: createdUserIds } },
            { drinkId: { [Op.in]: createdDrinkIds } },
          ],
        },
      });
      await User.destroy({ where: { id: { [Op.in]: createdUserIds } } });
    }
    if (createdDrinkIds.length > 0) {
      await Drink.destroy({ where: { id: { [Op.in]: createdDrinkIds } } });
    }
  }
  catch (error) {
    console.warn("sales-multi cleanup failed:", error);
  }
});
