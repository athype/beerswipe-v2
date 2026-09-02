import express from "express";

import docs from "../api-docs.js";
import admin from "./admin.js";
import auth from "./auth.js";
import drinks from "./drinks.js";
import leaderboard from "./leaderboard.js";
import passkeys from "./passkeys.js";
import sales from "./sales.js";
import users from "./users.js";

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
router.use("/drinks", drinks);
router.use("/sales", sales);
router.use("/leaderboard", leaderboard);
router.use("/passkeys", passkeys);

export default router;
