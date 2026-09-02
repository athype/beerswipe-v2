import { Op } from "sequelize";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { Drink, Transaction, User } from "../src/models/index.js";

// Regression test for a lost-update race in POST /api/v1/sales/sell.
//
// The sufficiency checks (user.credits, drink.stock) used to run against
// unlocked reads, so two concurrent sales could both pass the checks and then
// both commit. The route must lock the User/Drink rows and re-validate right
// before mutating so the checks are serialized against each other.
//
// Each round fires CONCURRENCY simultaneous sales against a user with 50
// credits and a 10-credit drink: at most 5 can legally succeed. A lost-update
// race lets more than 5 succeed (and leaves the balance inconsistent with the
// number of committed sales), which fails the assertions below.

const CONCURRENCY = 6;
const ROUNDS = 20;
const CREDITS = 50;
const PRICE = 10;
const STOCK = 50;
const CAPACITY = CREDITS / PRICE; // 5

const createdUserIds = [];
const createdDrinkIds = [];

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

describe("POST /api/v1/sales/sell under concurrency", () => {
  it("never over-commits credits or stock when sales race", { timeout: 60_000 }, async () => {
    // Fresh seller used only for auth on every request in this test.
    const seller = await User.create({
      username: `race-seller-${uniqueSuffix()}`,
      userType: "seller",
      isActive: true,
    });
    createdUserIds.push(seller.id);
    const token = generateToken(seller);

    for (let round = 0; round < ROUNDS; round++) {
      const tag = uniqueSuffix();

      const user = await User.create({
        username: `race-user-${tag}`,
        userType: "member",
        credits: CREDITS,
        dateOfBirth: null,
      });
      createdUserIds.push(user.id);

      const drink = await Drink.create({
        name: `race-drink-${tag}`,
        price: PRICE,
        stock: STOCK,
        isActive: true,
      });
      createdDrinkIds.push(drink.id);

      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          request(app)
            .post("/api/v1/sales/sell")
            .set("Authorization", `Bearer ${token}`)
            .send({ userId: user.id, drinkId: drink.id, quantity: 1 })),
      );

      const successes = responses.filter(r => r.status === 200).length;
      const rejected = responses.filter(r => r.status === 400).length;

      // Every request must be either a completed sale or a clean rejection —
      // never a 500 and never a request that succeeded past the capacity.
      expect(rejected + successes, `round ${round}: unexpected response codes ${responses.map(r => r.status).join(",")}`)
        .toBe(CONCURRENCY);
      expect(successes, `round ${round}: more sales committed than credits allow`)
        .toBe(CAPACITY);

      await user.reload();
      await drink.reload();
      expect(user.credits, `round ${round}: balance lost an update`).toBe(CREDITS - PRICE * successes);
      expect(drink.stock, `round ${round}: stock lost an update`).toBe(STOCK - successes);
    }
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
    console.warn("sales-concurrency cleanup failed:", error);
  }
});
