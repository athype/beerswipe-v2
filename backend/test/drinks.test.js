import { Op } from "sequelize";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.ts";
import { generateToken } from "../src/middleware/auth.ts";
import { Drink, Transaction, User } from "../src/models/index.ts";

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

describe("Drink barcodes (CRUD and CSV)", () => {
  function uniqueBarcode(prefix = "8710") {
    return `${prefix}${Date.now()}${suffix += 1}`;
  }

  it("creates a drink with a trimmed, case-preserved barcode and rejects duplicates and invalid values", async () => {
    const { token } = await makeAdmin();
    const barcode = uniqueBarcode("AbC");

    const created = await request(app)
      .post("/api/v1/drinks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `barcode-drink-${uniqueSuffix()}`,
        price: 5,
        stock: 10,
        barcode: `  ${barcode}  `,
      });

    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.drink.barcode).toBe(barcode);
    createdDrinkIds.push(created.body.drink.id);

    const duplicate = await request(app)
      .post("/api/v1/drinks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `barcode-dup-${uniqueSuffix()}`,
        price: 5,
        barcode,
      });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: "Barcode already in use" });

    for (const bad of ["bad-code!", "a".repeat(49), "has space", 12345]) {
      const invalid = await request(app)
        .post("/api/v1/drinks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `barcode-bad-${uniqueSuffix()}`,
          price: 5,
          barcode: bad,
        });

      expect(invalid.status, `barcode=${String(bad)}`).toBe(400);
    }
  });

  it("sets, preserves, clears, and checks uniqueness of barcode on update", async () => {
    const { token } = await makeAdmin();
    const drink = await makeDrink();
    const other = await makeDrink();
    const firstCode = uniqueBarcode("CODE");
    const otherCode = uniqueBarcode("OTHR");

    const setRes = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: ` ${firstCode} ` });

    expect(setRes.status, JSON.stringify(setRes.body)).toBe(200);
    expect(setRes.body.drink.barcode).toBe(firstCode);

    // Omitting barcode leaves it unchanged.
    const untouched = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 6 });

    expect(untouched.status).toBe(200);
    expect(untouched.body.drink.barcode).toBe(firstCode);

    // Updating the same drink with its own barcode succeeds.
    const sameSelf = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: firstCode });

    expect(sameSelf.status).toBe(200);
    expect(sameSelf.body.drink.barcode).toBe(firstCode);

    // Assigning another drink's barcode fails with 400.
    await other.update({ barcode: otherCode });
    const collision = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: otherCode });

    expect(collision.status).toBe(400);
    expect(collision.body).toEqual({ error: "Barcode already in use" });

    // Empty string clears barcode to null.
    const clearedEmpty = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: "" });

    expect(clearedEmpty.status).toBe(200);
    expect(clearedEmpty.body.drink.barcode).toBeNull();

    // Set again then clear with null.
    await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: firstCode })
      .expect(200);

    const clearedNull = await request(app)
      .put(`/api/v1/drinks/${drink.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ barcode: null });

    expect(clearedNull.status).toBe(200);
    expect(clearedNull.body.drink.barcode).toBeNull();
  });

  it("exports barcode as the 8th CSV column", async () => {
    const { token } = await makeAdmin();
    const category = `cat-${uniqueSuffix()}`;
    const code = uniqueBarcode("8712");

    const withBarcode = await Drink.create({
      name: `csv-with-bc-${uniqueSuffix()}`,
      description: "With code",
      price: 4,
      stock: 5,
      category,
      isActive: true,
      isAlcohol: false,
      barcode: code,
    });
    const withoutBarcode = await Drink.create({
      name: `csv-no-bc-${uniqueSuffix()}`,
      description: "Without code",
      price: 3,
      stock: 2,
      category,
      isActive: true,
      isAlcohol: true,
      barcode: null,
    });
    createdDrinkIds.push(withBarcode.id, withoutBarcode.id);

    const res = await request(app)
      .get(`/api/v1/drinks/export-csv?category=${encodeURIComponent(category)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const lines = res.text.split("\n");
    expect(lines[0]).toBe("name,description,price,stock,category,isActive,isAlcohol,barcode");

    const withRow = lines.find(line => line.includes(withBarcode.name));
    const withoutRow = lines.find(line => line.includes(withoutBarcode.name));
    expect(withRow).toBe(`"${withBarcode.name}","With code",4,5,"${category}",true,false,"${code}"`);
    expect(withoutRow).toBe(`"${withoutBarcode.name}","Without code",3,2,"${category}",true,true,""`);
  });

  it("imports 8-column and 7-column CSVs and reports duplicate/invalid barcodes per line", async () => {
    const { token } = await makeAdmin();
    const existingCode = uniqueBarcode("EXST");
    const newCode = uniqueBarcode("NEW1");
    const updatedCode = uniqueBarcode("UPD1");
    const validAfterErrCode = uniqueBarcode("OK99");

    const existingKeep = await Drink.create({
      name: `csv-keep-${uniqueSuffix()}`,
      price: 4,
      stock: 1,
      category: "beer",
      isActive: true,
      barcode: existingCode,
    });
    const existingUpdate = await Drink.create({
      name: `csv-upd-${uniqueSuffix()}`,
      price: 4,
      stock: 1,
      category: "beer",
      isActive: true,
      barcode: null,
    });
    createdDrinkIds.push(existingKeep.id, existingUpdate.id);

    const newWithBarcodeName = `csv-new-8col-${uniqueSuffix()}`;
    const new7ColName = `csv-new-7col-${uniqueSuffix()}`;
    const dupLineName = `csv-dup-bc-${uniqueSuffix()}`;
    const badLineName = `csv-bad-bc-${uniqueSuffix()}`;
    const afterErrName = `csv-after-err-${uniqueSuffix()}`;

    const csv8 = [
      `"${newWithBarcodeName}","desc",5,10,"beer",true,true,"${newCode}"`,
      `"${existingUpdate.name}","desc",5,12,"beer",true,false,"${updatedCode}"`,
      `"${existingKeep.name}","desc",4,8,"beer",true,false,""`,
      `"${dupLineName}","desc",5,10,"beer",true,false,"${existingCode}"`,
      `"${badLineName}","desc",5,10,"beer",true,false,"bad-barcode!"`,
      `"${afterErrName}","desc",6,3,"soda",true,false,"${validAfterErrCode}"`,
    ].join("\n");

    const res8 = await request(app)
      .post("/api/v1/drinks/import-csv")
      .set("Authorization", `Bearer ${token}`)
      .attach("csvFile", Buffer.from(csv8, "utf8"), "drinks8.csv");

    expect(res8.status, JSON.stringify(res8.body)).toBe(200);
    expect(res8.body.imported).toBe(4);
    expect(res8.body.errors).toBe(2);
    expect(res8.body.errorDetails).toHaveLength(2);
    expect(res8.body.errorDetails[0]).toMatch(/Line 4:.*Barcode already in use/i);
    expect(res8.body.errorDetails[1]).toMatch(/Line 5:/i);

    const createdNew = await Drink.findOne({ where: { name: newWithBarcodeName } });
    const createdAfterErr = await Drink.findOne({ where: { name: afterErrName } });
    expect(createdNew).not.toBeNull();
    expect(createdAfterErr).not.toBeNull();
    createdDrinkIds.push(createdNew.id, createdAfterErr.id);

    expect(createdNew.barcode).toBe(newCode);
    expect(createdAfterErr.barcode).toBe(validAfterErrCode);
    expect(await Drink.findOne({ where: { name: dupLineName } })).toBeNull();
    expect(await Drink.findOne({ where: { name: badLineName } })).toBeNull();

    await existingUpdate.reload();
    await existingKeep.reload();
    expect(existingUpdate.barcode).toBe(updatedCode);
    expect(existingKeep.barcode).toBe(existingCode);

    // Existing 7-column CSV keeps working unchanged.
    const csv7 = [
      `"${new7ColName}","7col",5,4,"soda",true,false`,
      `"${existingKeep.name}","7col",4,9,"beer",true,false`,
    ].join("\n");

    const res7 = await request(app)
      .post("/api/v1/drinks/import-csv")
      .set("Authorization", `Bearer ${token}`)
      .attach("csvFile", Buffer.from(csv7, "utf8"), "drinks7.csv");

    expect(res7.status, JSON.stringify(res7.body)).toBe(200);
    expect(res7.body.imported).toBe(2);
    expect(res7.body.errors).toBe(0);

    const created7 = await Drink.findOne({ where: { name: new7ColName } });
    expect(created7).not.toBeNull();
    createdDrinkIds.push(created7.id);
    expect(created7.barcode).toBeNull();

    await existingKeep.reload();
    expect(existingKeep.barcode).toBe(existingCode);
    expect(existingKeep.stock).toBe(9);
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
