import express from "express";
import { authenticateRequest, requireAdminOrSeller } from "../middleware/auth.ts";
import { Drink, ScanCode, User } from "../models/index.ts";
import { normalizeBarcode } from "../utils/barcode.ts";
import { barcodeParamSchema, scanCodeParamSchema } from "../validation/contracts.ts";

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

/**
 * @openapi
 * /scan/drink/{barcode}:
 *   get:
 *     summary: Resolve a product barcode to its drink
 *     description: >
 *       Kiosk product-scan lookup. Returns an active drink matching the barcode,
 *       including out-of-stock drinks (`stock: 0`) so the kiosk can tell the
 *       member it is sold out. Case-sensitive to support Code128 barcodes.
 *     tags: [Scan]
 *     security:
 *       - authToken: []
 *       - apiKeyHeader: []
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema: { type: string, maxLength: 48, pattern: "^[A-Za-z0-9]{1,48}$" }
 *     responses:
 *       200:
 *         description: The active drink matching the barcode
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ScanDrinkLookupResponse" }
 *       400:
 *         description: Malformed barcode
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Caller is not an admin or seller
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Unknown or inactive drink
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
// codeql[js/missing-rate-limiting] — deferred (design spec §14)
router.get("/drink/:barcode", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  try {
    const parsed = barcodeParamSchema.safeParse(req.params.barcode);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid barcode" });
    }

    const barcode = normalizeBarcode(parsed.data);
    if (!barcode) {
      return res.status(400).json({ error: "Invalid barcode" });
    }

    const drink = await Drink.findOne({ where: { barcode } });
    if (!drink || !drink.isActive) {
      return res.status(404).json({ error: "Drink not found" });
    }

    res.json({
      drink: {
        id: drink.id,
        name: drink.name,
        price: drink.price,
        stock: drink.stock,
        isAlcohol: drink.isAlcohol,
        category: drink.category ?? "beverage",
      },
    });
  }
  catch (error) {
    console.error("Scan drink lookup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
