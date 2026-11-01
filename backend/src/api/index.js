import express from "express";

import docs from "../api-docs.js";
import admin from "./admin.ts";
import apiKeys from "./apiKeys.ts";
import auth from "./auth.ts";
import drinks from "./drinks.ts";
import leaderboard from "./leaderboard.ts";
import passkeys from "./passkeys.ts";
import sales from "./sales.js";
import scan from "./scan.ts";
import users from "./users.ts";

const router = express.Router();

/**
 * @openapi
 * /:
 *   get:
 *     summary: API info
 *     description: Greeting endpoint; the interactive docs live at /docs.
 *     responses:
 *       200:
 *         description: Info message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 */
router.get("/", (req, res) => {
  res.json({
    message: "Beer Machine API",
  });
});

router.use("/auth", auth);
router.use("/docs", docs);
router.use("/admin", admin);
router.use("/users", users);
router.use("/api-keys", apiKeys);
router.use("/drinks", drinks);
router.use("/sales", sales);
router.use("/leaderboard", leaderboard);
router.use("/passkeys", passkeys);
router.use("/scan", scan);

export default router;
