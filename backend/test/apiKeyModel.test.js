import { afterAll, describe, expect, it } from "vitest";

import app from "../src/app.js"; // boots Postgres sync + migrations + seeds
import { ApiKey, User } from "../src/models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../src/utils/apiKeyCrypto.js";

let suffix = 0;
function uniqueSuffix() {
  suffix += 1;
  return `${Date.now()}-${suffix}`;
}

const created = { keys: [], users: [], drinks: [] };

afterAll(async () => {
  await ApiKey.destroy({ where: { id: created.keys } });
  await User.destroy({ where: { id: created.users } });
});

describe("ApiKey model", () => {
  it("stores hash + prefix and links to the creating admin", async () => {
    const admin = await User.create({
      username: `key-admin-${uniqueSuffix()}`,
      userType: "admin",
      isActive: true,
    });
    created.users.push(admin.id);

    const plaintext = generateApiKey();
    const row = await ApiKey.create({
      name: "Model test key",
      scope: "seller",
      keyHash: hashApiKey(plaintext),
      prefix: apiKeyPrefix(plaintext),
      createdBy: admin.id,
    });
    created.keys.push(row.id);

    const found = await ApiKey.findByPk(row.id, {
      include: [{ model: User, as: "creator", attributes: ["id", "username"] }],
    });

    expect(found.name).toBe("Model test key");
    expect(found.scope).toBe("seller");
    expect(found.isRevoked).toBe(false);
    expect(found.keyHash).toBe(hashApiKey(plaintext));
    expect(found.prefix).toBe(apiKeyPrefix(plaintext));
    expect(found.createdBy).toBe(admin.id);
    expect(found.creator.username).toBe(admin.username);
    expect(found.keyHash).not.toBe(plaintext);
  });
});
