import express from "express";
import { authenticateRequest, requireAdmin } from "../middleware/auth.js";
import { ApiKey, User } from "../models/index.js";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../utils/apiKeyCrypto.js";
import { apiKeyIdParamSchema, createApiKeySchema } from "../validation/contracts.js";

const router = express.Router();

// Public shape helpers — the plaintext key and its hash never leave the
// server through these (POST / includes the key once, on creation only).
function serializeApiKey(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scope: row.scope,
    createdBy: row.createdBy,
    isRevoked: row.isRevoked,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeApiKeyListItem(row) {
  return {
    ...serializeApiKey(row),
    creator: { id: row.creator.id, username: row.creator.username },
  };
}

function parseKeyId(req, res) {
  const parsed = apiKeyIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid key id" });
    return null;
  }
  return parsed.data;
}

/**
 * @openapi
 * /api-keys:
 *   get:
 *     summary: List API keys
 *     description: >
 *       All API keys with their creator usernames. Hashes and plaintext keys
 *       are never returned.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: Key list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKeys:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/ApiKeyListItem" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — rate limiting deliberately deferred: 128-bit keys, revocation is the control (design spec §14)
router.get("/", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const rows = await ApiKey.findAll({
      include: [
        { model: User, as: "creator", attributes: ["id", "username"], required: true },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json({ apiKeys: rows.map(serializeApiKeyListItem) });
  }
  catch (error) {
    console.error("List API keys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys:
 *   post:
 *     summary: Create an API key
 *     description: >
 *       Creates a key for a programmatic client. The plaintext key is
 *       returned in `key` exactly once — it is only stored as a SHA-256 hash.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/CreateApiKeyRequest" }
 *     responses:
 *       201:
 *         description: Key created (plaintext shown once)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey: { $ref: "#/components/schemas/ApiKey" }
 *                 key:
 *                   type: string
 *                   description: One-time plaintext key, e.g. "bsk_ab12…"
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — rate limiting deliberately deferred: 128-bit keys, revocation is the control (design spec §14)
router.post("/", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const parsedBody = createApiKeySchema.safeParse(req.body);
    if (!parsedBody.success) {
      const { issues } = parsedBody.error;
      return res.status(400).json({
        error: issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("; "),
      });
    }

    const { name, scope, expiresAt } = parsedBody.data;
    const key = generateApiKey();

    const row = await ApiKey.create({
      name,
      scope,
      keyHash: hashApiKey(key),
      prefix: apiKeyPrefix(key),
      createdBy: req.user.id,
      expiresAt: expiresAt || null,
    });

    res.status(201).json({ apiKey: serializeApiKey(row), key });
  }
  catch (error) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     description: Soft-deletes a key (isRevoked). Revoking twice is a no-op success.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Key revoked
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       400:
 *         description: Invalid key id
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Key not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — rate limiting deliberately deferred: 128-bit keys, revocation is the control (design spec §14)
router.post("/:id/revoke", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const id = parseKeyId(req, res);
    if (id === null) {
      return;
    }

    const [updated] = await ApiKey.update({ isRevoked: true }, { where: { id } });
    if (updated === 0) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key revoked" });
  }
  catch (error) {
    console.error("Revoke API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: >
 *       Hard-deletes a key row (tidy-up for revoked keys). Deleting an active
 *       key is equivalent to revoke + delete.
 *     tags: [Api Keys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Key deleted
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       400:
 *         description: Invalid key id
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Key not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — rate limiting deliberately deferred: 128-bit keys, revocation is the control (design spec §14)
router.delete("/:id", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const id = parseKeyId(req, res);
    if (id === null) {
      return;
    }

    const deleted = await ApiKey.destroy({ where: { id } });
    if (deleted === 0) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key deleted" });
  }
  catch (error) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
