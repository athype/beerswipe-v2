import type { Model } from "sequelize";
import { Op } from "sequelize";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { generateToken } from "../src/middleware/auth.js";
import { Drink, Transaction, User } from "../src/models/index.js";

// lastRestockedAt backs the "Last restocked" line on the drink cards. It is
// stamped by every write path that raises stock — add-stock, edit, create and
// CSV import — and left alone by deducts, including the stock raise that a
// sale undo performs.

const createdUserIds: number[] = [];
const createdDrinkIds: number[] = [];

const OLD_STAMP = new Date("2024-03-05T10:15:00.000Z");

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

type TestUser = { id: number; username: string; userType: string };

async function makeUser(userType: string, credits = 0): Promise<TestUser> {
  const user = await User.create({
    username: `restock-${userType}-${uniqueSuffix()}`,
    userType,
    isActive: true,
    credits,
  });
  const id = user.get("id") as number;
  createdUserIds.push(id);
  return { id, username: user.get("username") as string, userType };
}

async function authHeaders(userType = "admin", credits = 0) {
  const user = await makeUser(userType, credits);
  return { Authorization: `Bearer ${generateToken(user)}` };
}

async function makeDrink({ stock = 0, lastRestockedAt = null }: { stock?: number; lastRestockedAt?: Date | null } = {}) {
  const drink = await Drink.create({
    name: `restock-drink-${uniqueSuffix()}`,
    price: 4,
    stock,
    isActive: true,
    isAlcohol: false,
    lastRestockedAt,
  });
  createdDrinkIds.push(drink.get("id") as number);
  return drink;
}

function stampOf(drink: Model): Date | null {
  return drink.get("lastRestockedAt") as Date | null;
}

function addStock(headers: Record<string, string>, drinkId: number, quantity: number) {
  return request(app)
    .post(`/api/v1/drinks/${drinkId}/add-stock`)
    .set(headers)
    .send({ quantity });
}

function updateDrink(headers: Record<string, string>, drinkId: number, body: Record<string, unknown>) {
  return request(app)
    .put(`/api/v1/drinks/${drinkId}`)
    .set(headers)
    .send(body);
}

function importCsv(headers: Record<string, string>, rows: string[]) {
  return request(app)
    .post("/api/v1/drinks/import-csv")
    .set(headers)
    .attach("csvFile", Buffer.from(rows.join("\n")), "restock.csv");
}

// name,description,price,stock,category,isActive,isAlcohol — no header row.
function csvRow(name: string, stock: number) {
  return `${name},,4,${stock},beverage,true,false`;
}

describe("lastRestockedAt on the explicit restock action", () => {
  it("stamps it and returns it from add-stock", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 5 });

    const res = await addStock(headers, drink.get("id") as number, 10);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.drink.stock).toBe(15);
    expect(res.body.drink.lastRestockedAt).toEqual(expect.any(String));

    await drink.reload();
    expect(stampOf(drink)?.toISOString()).toBe(res.body.drink.lastRestockedAt);
  });

  it("moves a previous stamp forward", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 5, lastRestockedAt: OLD_STAMP });

    await addStock(headers, drink.get("id") as number, 1).expect(200);

    await drink.reload();
    expect(stampOf(drink)!.getTime()).toBeGreaterThan(OLD_STAMP.getTime());
  });
});

describe("lastRestockedAt on edits", () => {
  it("stamps when the edit raises stock", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 5, lastRestockedAt: OLD_STAMP });

    const res = await updateDrink(headers, drink.get("id") as number, { stock: 8 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    await drink.reload();
    expect(stampOf(drink)!.getTime()).toBeGreaterThan(OLD_STAMP.getTime());
  });

  it("keeps the previous stamp when stock is lowered, repeated or untouched", async () => {
    const headers = await authHeaders();
    const lowered = await makeDrink({ stock: 9, lastRestockedAt: OLD_STAMP });
    const repeated = await makeDrink({ stock: 9, lastRestockedAt: OLD_STAMP });
    const untouched = await makeDrink({ stock: 9, lastRestockedAt: OLD_STAMP });

    await updateDrink(headers, lowered.get("id") as number, { stock: 4 }).expect(200);
    await updateDrink(headers, repeated.get("id") as number, { stock: 9 }).expect(200);
    await updateDrink(headers, untouched.get("id") as number, { isActive: false }).expect(200);

    await lowered.reload();
    await repeated.reload();
    await untouched.reload();
    expect(stampOf(lowered)).toEqual(OLD_STAMP);
    expect(stampOf(repeated)).toEqual(OLD_STAMP);
    expect(stampOf(untouched)).toEqual(OLD_STAMP);
  });
});

describe("lastRestockedAt on create", () => {
  it("stamps a drink created with stock and leaves an empty one unstamped", async () => {
    const headers = await authHeaders();

    const stocked = await request(app)
      .post("/api/v1/drinks")
      .set(headers)
      .send({ name: `restock-created-${uniqueSuffix()}`, price: 3, stock: 12 });
    const empty = await request(app)
      .post("/api/v1/drinks")
      .set(headers)
      .send({ name: `restock-created-${uniqueSuffix()}`, price: 3 });

    expect(stocked.status, JSON.stringify(stocked.body)).toBe(201);
    expect(empty.status, JSON.stringify(empty.body)).toBe(201);
    expect(stocked.body.drink.lastRestockedAt).toEqual(expect.any(String));
    expect(empty.body.drink.lastRestockedAt).toBeNull();

    createdDrinkIds.push(stocked.body.drink.id, empty.body.drink.id);
  });
});

describe("lastRestockedAt on CSV import", () => {
  it("stamps an existing drink when the file raises its stock", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 5, lastRestockedAt: OLD_STAMP });
    const name = drink.get("name") as string;

    const res = await importCsv(headers, [csvRow(name, 9)]);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.results).toEqual([{ name, action: "updated", stock: 9 }]);

    await drink.reload();
    expect(stampOf(drink)!.getTime()).toBeGreaterThan(OLD_STAMP.getTime());
  });

  it("keeps the previous stamp when the file lowers the stock", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 9, lastRestockedAt: OLD_STAMP });

    const res = await importCsv(headers, [csvRow(drink.get("name") as string, 2)]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    await drink.reload();
    expect(drink.get("stock")).toBe(2);
    expect(stampOf(drink)).toEqual(OLD_STAMP);
  });

  it("stamps a drink the file creates with stock, and not one created empty", async () => {
    const headers = await authHeaders();
    const stockedName = `restock-imported-${uniqueSuffix()}`;
    const emptyName = `restock-imported-${uniqueSuffix()}`;

    const res = await importCsv(headers, [csvRow(stockedName, 7), csvRow(emptyName, 0)]);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.results).toEqual([
      { name: stockedName, action: "created", stock: 7 },
      { name: emptyName, action: "created", stock: 0 },
    ]);

    const stocked = await Drink.findOne({ where: { name: stockedName } });
    const empty = await Drink.findOne({ where: { name: emptyName } });
    expect(stocked).not.toBeNull();
    expect(empty).not.toBeNull();
    createdDrinkIds.push(stocked!.get("id") as number, empty!.get("id") as number);

    expect(stampOf(stocked!)?.getTime()).toBeGreaterThan(OLD_STAMP.getTime());
    expect(stampOf(empty!)).toBeNull();
  });

  it("reports the lines it wrote and the ones it could not", async () => {
    const headers = await authHeaders();
    const drink = await makeDrink({ stock: 5 });
    const name = drink.get("name") as string;

    const res = await importCsv(headers, [csvRow(name, 9), ",,4,9,beverage,true,false"]);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.errors).toBe(1);
    expect(res.body.results).toEqual([{ name, action: "updated", stock: 9 }]);
    expect(res.body.errorDetails).toEqual(["Line 2: Name is required"]);
  });

  it("updates the row an earlier line created when a name repeats in one file", async () => {
    const headers = await authHeaders();
    const name = `restock-repeated-${uniqueSuffix()}`;

    const res = await importCsv(headers, [csvRow(name, 3), csvRow(name, 8)]);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.results).toEqual([
      { name, action: "created", stock: 3 },
      { name, action: "updated", stock: 8 },
    ]);

    const created = await Drink.findOne({ where: { name } });
    expect(created).not.toBeNull();
    createdDrinkIds.push(created!.get("id") as number);
    expect(created!.get("stock")).toBe(8);
  });
});

describe("lastRestockedAt across a sale and its undo", () => {
  it("survives the deduct and the stock the undo hands back", async () => {
    const headers = await authHeaders("seller");
    const customer = await makeUser("member", 50);
    const drink = await makeDrink({ stock: 10, lastRestockedAt: OLD_STAMP });
    const drinkId = drink.get("id") as number;

    const sale = await request(app)
      .post("/api/v1/sales/sell")
      .set(headers)
      .send({ userId: customer.id, drinkId, quantity: 2 });
    expect(sale.status, JSON.stringify(sale.body)).toBe(200);

    await drink.reload();
    expect(drink.get("stock")).toBe(8);
    expect(stampOf(drink)).toEqual(OLD_STAMP);

    const undo = await request(app)
      .delete(`/api/v1/sales/undo/${sale.body.transaction.id}`)
      .set(headers);
    expect(undo.status, JSON.stringify(undo.body)).toBe(200);

    await drink.reload();
    expect(drink.get("stock")).toBe(10);
    expect(stampOf(drink)).toEqual(OLD_STAMP);
  });
});

afterAll(async () => {
  // Best-effort cleanup: sale rows first, then the fixtures.
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
    console.warn("drinks-restock cleanup failed:", error);
  }
});
