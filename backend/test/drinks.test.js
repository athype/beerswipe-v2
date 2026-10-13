import { Op } from "sequelize";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { Drink, Transaction, User } from "../src/models/index.js";

// Permanent deletion of a drink: the row goes for good, but only when it has
// no sale history — transactions.drinkId references it, so the audit trail
// outlives the product.

const createdUserIds = [];
const createdDrinkIds = [];

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

async function makeAdmin() {
  const admin = await User.create({
    username: `drinks-admin-${uniqueSuffix()}`,
    userType: "admin",
    isActive: true,
  });
  createdUserIds.push(admin.id);
  return { admin, token: generateToken(admin) };
}

async function makeSeller() {
  const seller = await User.create({
    username: `drinks-seller-${uniqueSuffix()}`,
    userType: "seller",
    isActive: true,
  });
  createdUserIds.push(seller.id);
  return { seller, token: generateToken(seller) };
}

async function makeDrink({ stock = 10 } = {}) {
  const drink = await Drink.create({
    name: `drinks-drink-${uniqueSuffix()}`,
    price: 4,
    stock,
    isActive: true,
  });
  createdDrinkIds.push(drink.id);
  return drink;
}

function deletePermanently(token, drinkId) {
  return request(app)
    .delete(`/api/v1/drinks/${drinkId}/permanent`)
    .set("Authorization", `Bearer ${token}`);
}

describe("DELETE /api/v1/drinks/:id/permanent", () => {
  it("removes a history-free drink for good", async () => {
    const { token } = await makeAdmin();
    const drink = await makeDrink();

    const res = await deletePermanently(token, drink.id);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.message).toBe("Drink permanently deleted");

    expect(await Drink.findByPk(drink.id)).toBeNull();
    await request(app).get(`/api/v1/drinks/${drink.id}`).expect(404);
  });

  it("refuses a drink with sales history and keeps the row", async () => {
    const { token } = await makeAdmin();
    const buyer = await User.create({
      username: `drinks-buyer-${uniqueSuffix()}`,
      userType: "member",
      credits: 20,
      isActive: true,
    });
    createdUserIds.push(buyer.id);
    const drink = await makeDrink();

    const sale = await request(app)
      .post("/api/v1/sales/sell")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: buyer.id, drinkId: drink.id, quantity: 1 });
    expect(sale.status, JSON.stringify(sale.body)).toBe(200);

    const res = await deletePermanently(token, drink.id);

    expect(res.status, JSON.stringify(res.body)).toBe(409);
    expect(res.body.error).toMatch(/sales history/i);

    await drink.reload();
    expect(drink.isActive).toBe(true);
  });

  it("404s an unknown drink", async () => {
    const { token } = await makeAdmin();

    const res = await deletePermanently(token, 2_000_000_000);

    expect(res.status).toBe(404);
  });

  it("is admin only", async () => {
    const { token } = await makeSeller();
    const drink = await makeDrink();

    const res = await deletePermanently(token, drink.id);

    expect(res.status).toBe(403);
    expect(await Drink.findByPk(drink.id)).not.toBeNull();
  });

  it("leaves the soft-delete route alone", async () => {
    const { token } = await makeAdmin();
    const drink = await makeDrink();

    const res = await request(app)
      .delete(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    await drink.reload();
    expect(drink.isActive).toBe(false);
  });
});

afterAll(async () => {
  // Best-effort cleanup: sale rows first (both FKs), then the fixtures.
  try {
    if (createdDrinkIds.length > 0) {
      await Transaction.destroy({ where: { drinkId: { [Op.in]: createdDrinkIds } } });
    }
    if (createdUserIds.length > 0) {
      await Transaction.destroy({ where: { userId: { [Op.in]: createdUserIds } } });
      await User.destroy({ where: { id: { [Op.in]: createdUserIds } } });
    }
    if (createdDrinkIds.length > 0) {
      await Drink.destroy({ where: { id: { [Op.in]: createdDrinkIds } } });
    }
  }
  catch (error) {
    console.warn("drinks cleanup failed:", error);
  }
});
