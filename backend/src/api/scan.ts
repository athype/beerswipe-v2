import express from "express";
import { authenticateRequest, requireAdminOrSeller } from "../middleware/auth.js";
import { ScanCode, User } from "../models/index.js";
import { scanCodeParamSchema } from "../validation/contracts.js";

// Sequelize's define() typings do not surface model attributes, so the
// eager-loaded association is read back through this narrow shape.
type ScanCodeUser = {
  id: number;
  username: string;
  credits: number;
  isActive: boolean;
};

const router = express.Router();

/**
 * @openapi
 * /scan/lookup/{code}:
 *   get:
 *     summary: Resolve a scan code to its user
 *     description: >
 *       Kiosk resolution step of the scan-to-buy flow. The code is accepted in
 *       any casing; only the fields the kiosk needs are returned.
 *     tags: [Scan]
 *     security:
 *       - authToken: []
 *       - apiKeyHeader: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string, pattern: "^[0-9a-fA-F]{32}$" }
 *     responses:
 *       200:
 *         description: The user the code belongs to
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ScanLookupResponse" }
 *       400:
 *         description: Malformed scan code
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Caller is not an admin or seller, or the resolved user is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Unknown scan code
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — deferred (design spec §14)
router.get("/lookup/:code", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  try {
    const parsed = scanCodeParamSchema.safeParse(req.params.code);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid scan code" });
    }

    const scanCode = await ScanCode.findOne({
      where: { code: parsed.data },
      include: [{
        model: User,
        as: "user",
        // Only the fields the kiosk needs; the password hash never leaves the DB.
        attributes: ["id", "username", "credits", "isActive"],
      }],
    });

    const user = scanCode?.get("user") as ScanCodeUser | null | undefined;
    if (!user) {
      return res.status(404).json({ error: "Scan code not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "User is inactive" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        credits: user.credits,
      },
    });
  }
  catch (error) {
    console.error("Scan lookup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
