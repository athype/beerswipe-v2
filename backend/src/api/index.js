import express from "express";

import admin from "./admin.js";
import auth from "./auth.js";
import drinks from "./drinks.js";
import leaderboard from "./leaderboard.js";
import sales from "./sales.js";
import users from "./users.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Beer Machine API",
  });
});

router.use("/auth", auth);
router.use("/admin", admin);
router.use("/users", users);
router.use("/drinks", drinks);
router.use("/sales", sales);
router.use("/leaderboard", leaderboard);

export default router;
