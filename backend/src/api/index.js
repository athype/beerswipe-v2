import express from "express";

import auth from "./auth.js";
import users from "./users.js";
import drinks from "./drinks.js";
import sales from "./sales.js";
import leaderboard from "./leaderboard.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Beer Machine API",
  });
});

router.use("/auth", auth);
router.use("/users", users);
router.use("/drinks", drinks);
router.use("/sales", sales);
router.use("/leaderboard", leaderboard);

export default router;
