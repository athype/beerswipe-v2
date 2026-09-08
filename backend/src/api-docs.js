import fs from "node:fs";
import path from "node:path";
import express from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import { apiDocsEnabled } from "./env.js";

// --- Component schemas (shared by the @openapi annotations in src/api/*.js) ---

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string", description: "Human readable error message" },
  },
  required: ["error"],
};

const messageSchema = {
  type: "object",
  properties: {
    message: { type: "string", description: "Success message" },
  },
  required: ["message"],
};

const serverErrorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    stack: { type: "string", description: "Stack trace (omitted in production)" },
  },
};

const paginationSchema = {
  type: "object",
  properties: {
    total: { type: "integer", description: "Total number of matching records" },
    page: { type: "integer", minimum: 1 },
    pages: { type: "integer", description: "Total number of pages" },
    limit: { type: "integer" },
  },
  required: ["total", "page", "pages", "limit"],
};

const drinkSchema = {
  type: "object",
  description: "A drink as stored, price in credits",
  properties: {
    id: { type: "integer" },
    name: { type: "string", maxLength: 100 },
    description: { type: "string", nullable: true },
    price: { type: "integer", minimum: 1, description: "Price in credits" },
    stock: { type: "integer", minimum: 0 },
    isActive: { type: "boolean", description: "false = soft-deleted" },
    isAlcohol: { type: "boolean", description: "true = alcohol; buyer must be 18+, enforced at sale time" },
    category: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "name", "price", "stock", "isActive", "isAlcohol", "createdAt", "updatedAt"],
};

const drinkListSchema = {
  type: "object",
  properties: {
    drinks: { type: "array", items: { $ref: "#/components/schemas/Drink" } },
    pagination: { $ref: "#/components/schemas/Pagination" },
  },
  required: ["drinks", "pagination"],
};

const createDrinkRequestSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 100 },
    description: { type: "string" },
    price: { type: "integer", minimum: 1, description: "Price in credits" },
    stock: { type: "integer", minimum: 0, default: 0 },
    category: { type: "string", default: "beverage" },
    isAlcohol: { type: "boolean", default: false, description: "true = alcohol; buyers must be 18+" },
  },
  required: ["name", "price"],
};

const updateDrinkRequestSchema = {
  type: "object",
  description: "Only provided fields are updated",
  properties: {
    name: { type: "string", maxLength: 100 },
    description: { type: "string" },
    price: { type: "integer", minimum: 1, description: "Price in credits" },
    stock: { type: "integer", minimum: 0 },
    category: { type: "string" },
    isActive: { type: "boolean" },
    isAlcohol: { type: "boolean", description: "true = alcohol; buyers must be 18+" },
  },
};

const addStockRequestSchema = {
  type: "object",
  properties: {
    quantity: { type: "integer", minimum: 1 },
  },
  required: ["quantity"],
};

const drinkMessageSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    drink: {
      oneOf: [
        { $ref: "#/components/schemas/Drink" },
        {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            stock: { type: "integer" },
          },
        },
      ],
    },
  },
};

const userSchema = {
  type: "object",
  description: "A user as stored (password hash is never exposed by any route)",
  properties: {
    id: { type: "integer" },
    username: { type: "string", maxLength: 50 },
    credits: { type: "integer", minimum: 0 },
    dateOfBirth: { type: "string", format: "date", nullable: true },
    userType: { type: "string", enum: ["admin", "seller", "member", "non-member"] },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "username", "credits", "userType", "isActive", "createdAt", "updatedAt"],
};

const authUserSchema = {
  type: "object",
  description: "Public user projection returned by auth endpoints",
  properties: {
    id: { type: "integer" },
    username: { type: "string" },
    userType: { type: "string", enum: ["admin", "seller", "member", "non-member"] },
    credits: { type: "integer", minimum: 0 },
  },
  required: ["id", "username", "userType", "credits"],
};

const userListSchema = {
  type: "object",
  properties: {
    users: { type: "array", items: { $ref: "#/components/schemas/User" } },
    pagination: { $ref: "#/components/schemas/Pagination" },
  },
  required: ["users", "pagination"],
};

const loginRequestSchema = {
  type: "object",
  properties: {
    username: { type: "string" },
    password: { type: "string", format: "password" },
  },
  required: ["username", "password"],
};

const sellRequestSchema = {
  type: "object",
  properties: {
    userId: { type: "integer", description: "Buying user" },
    drinkId: { type: "integer" },
    quantity: { type: "integer", minimum: 1, default: 1 },
  },
  required: ["userId", "drinkId"],
};

const transactionSchema = {
  type: "object",
  description: "An audit-trail row for a sale or credit addition",
  properties: {
    id: { type: "integer" },
    userId: { type: "integer" },
    drinkId: { type: "integer", nullable: true },
    adminId: { type: "integer", nullable: true, description: "Crediting admin, when present" },
    type: { type: "string", enum: ["sale", "credit_addition"] },
    amount: { type: "integer", description: "Credits involved (negative for sales)" },
    quantity: { type: "integer", nullable: true, description: "Number of drinks, for sales" },
    description: { type: "string", nullable: true },
    transactionDate: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "userId", "type", "amount", "transactionDate", "createdAt", "updatedAt"],
};

const passkeySchema = {
  type: "object",
  description: "Public passkey projection (credential material is never returned)",
  properties: {
    id: { type: "integer" },
    deviceName: { type: "string", nullable: true },
    transports: { type: "array", items: { type: "string" } },
    createdAt: { type: "string", format: "date-time" },
    lastUsedAt: { type: "string", format: "date-time", nullable: true },
  },
  required: ["id", "createdAt"],
};

const apiKeySchema = {
  type: "object",
  description: "API key metadata (plaintext is shown once at creation and never stored)",
  properties: {
    id: { type: "integer" },
    name: { type: "string", maxLength: 50 },
    prefix: { type: "string", description: "First 12 chars, e.g. \"bsk_ab12cd34\"" },
    scope: { type: "string", enum: ["admin", "seller"] },
    createdBy: { type: "integer", description: "User id of the creating admin" },
    isRevoked: { type: "boolean" },
    expiresAt: { type: "string", format: "date-time", nullable: true },
    lastUsedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "name", "prefix", "scope", "createdBy", "isRevoked", "expiresAt", "lastUsedAt", "createdAt"],
};

const apiKeyListItemSchema = {
  type: "object",
  description: "API key list row with the creating admin joined",
  properties: {
    ...apiKeySchema.properties,
    creator: {
      type: "object",
      properties: {
        id: { type: "integer" },
        username: { type: "string" },
      },
      required: ["id", "username"],
    },
  },
  required: [...apiKeySchema.required, "creator"],
};

const createApiKeyRequestSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 50 },
    scope: { type: "string", enum: ["admin", "seller"], default: "admin" },
    expiresAt: { type: "string", format: "date-time", description: "Optional; must be in the future" },
  },
  required: ["name"],
};

const schemas = {
  Error: errorSchema,
  ServerError: serverErrorSchema,
  Message: messageSchema,
  Pagination: paginationSchema,
  Drink: drinkSchema,
  DrinkList: drinkListSchema,
  CreateDrinkRequest: createDrinkRequestSchema,
  UpdateDrinkRequest: updateDrinkRequestSchema,
  AddStockRequest: addStockRequestSchema,
  DrinkMessage: drinkMessageSchema,
  User: userSchema,
  AuthUser: authUserSchema,
  UserList: userListSchema,
  LoginRequest: loginRequestSchema,
  SellRequest: sellRequestSchema,
  Transaction: transactionSchema,
  Passkey: passkeySchema,
  ApiKey: apiKeySchema,
  ApiKeyListItem: apiKeyListItemSchema,
  CreateApiKeyRequest: createApiKeyRequestSchema,
};

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const apiDir = new URL("./api", import.meta.url).pathname.replaceAll("\\", "/");

const spec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Beer Machine API",
      version: packageJson.version,
      description:
        "Backend API for the Beer Machine. Base URL: `/api/v1`.\n\n"
        + "Authentication is a `authToken` httpOnly cookie set by `POST /auth/login` "
        + "(or the passkey flow). Since the cookie is httpOnly, call the login endpoint "
        + "from this UI first — same-origin requests then carry the cookie automatically "
        + "and protected endpoints can be executed with \"Try it out\"."
        + "\n\nAlternatively, programmatic clients authenticate with an "
        + "`X-API-Key` header instead of the cookie — see `POST /api-keys` "
        + "to mint one. Any endpoint accepting the `authToken` cookie also "
        + "accepts `X-API-Key`, except the unauthenticated auth endpoints.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
      { name: "Auth", description: "Login, session and bootstrap admin endpoints" },
      { name: "Users", description: "User management and credits" },
      { name: "Drinks", description: "Drink catalog and stock" },
      { name: "Sales", description: "Sell flow and history" },
      { name: "Leaderboard", description: "Monthly consumption rankings" },
      { name: "Passkeys", description: "WebAuthn passkey registration and login" },
      { name: "Admin", description: "Admin account management" },
      { name: "Api Keys", description: "Long-lived API keys for programmatic clients" },
    ],
    components: {
      securitySchemes: {
        authToken: {
          type: "apiKey",
          in: "cookie",
          name: "authToken",
          description: "httpOnly session cookie set by POST /auth/login (24h expiry)",
        },
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Long-lived API key created on the admin /api-keys page. Every endpoint that accepts the authToken cookie also accepts X-API-Key; the key acts as the admin who created it, restricted to the key's scope.",
        },
      },
      schemas,
      responses: {
        InternalError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ServerError" },
            },
          },
        },
      },
    },
  },
  apis: [`${apiDir}/*.js`],
});

const router = express.Router();

// Gate + helmet CSP relaxation for the docs subtree: Swagger UI ships an
// inline <style> block that helmet's default CSP would block. Its assets are
// self-contained and same-origin, so dropping CSP here is safe.
router.use((req, res, next) => {
  if (!apiDocsEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }
  res.removeHeader("Content-Security-Policy");
  next();
});

// Machine-readable spec, useful for curl and for tooling.
router.get("/spec.json", (req, res) => {
  res.json(spec);
});

// Static assets and the UI page.
router.use(swaggerUi.serve);
router.get("/", swaggerUi.setup(spec, { customSiteTitle: "Beer Machine API — Docs" }));

export default router;
