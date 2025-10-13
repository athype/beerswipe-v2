import express from "express";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { Transaction, User } from "../models/index.js";

const router = express.Router();

/**
 * Helper function to get the date range for a specific month
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {{ startDate: Date, endDate: Date }} Object containing start and end dates
 */
function getMonthDateRange(year, month) {
  const startDate = new Date(year, month - 1, 1); // First day of month at 00:00:00
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month at 23:59:59.999
  return { startDate, endDate };
}

// Get monthly leaderboard
router.get("/monthly", authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const { startDate, endDate } = getMonthDateRange(year, month);

    const leaderboard = await Transaction.findAll({
      where: {
        type: "sale",
        transactionDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [{
        model: User,
        as: "user",
        attributes: ["id", "username", "userType"],
        where: {
          userType: { [Op.ne]: "admin" },
        },
      }],
      attributes: [
        "userId",
        [sequelize.fn("COUNT", sequelize.col("Transaction.id")), "transactionCount"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalDrinks"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalSpent"],
      ],
      group: ["userId", "user.id", "user.username", "user.userType"],
      order: [[sequelize.fn("SUM", sequelize.col("quantity")), "DESC"]],
      raw: false,
    });

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.user.username,
      userType: entry.user.userType,
      transactionCount: Number.parseInt(entry.dataValues.transactionCount) || 0,
      totalDrinks: Number.parseInt(entry.dataValues.totalDrinks) || 0,
      totalSpent: Number.parseInt(entry.dataValues.totalSpent) || 0,
    }));

    res.json({
      leaderboard: formattedLeaderboard,
      period: {
        year: Number.parseInt(year),
        month: Number.parseInt(month),
        monthName: new Date(year, month - 1).toLocaleString("en-US", { month: "long" }),
        startDate,
        endDate,
      },
    });
  }
  catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's rank for a specific month
router.get("/rank/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const { startDate, endDate } = getMonthDateRange(year, month);

    // Get all users' totals
    const leaderboard = await Transaction.findAll({
      where: {
        type: "sale",
        transactionDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [{
        model: User,
        as: "user",
        attributes: ["id"],
        where: {
          userType: { [Op.ne]: "admin" },
        },
      }],
      attributes: [
        "userId",
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalDrinks"],
      ],
      group: ["userId", "user.id"],
      order: [[sequelize.fn("SUM", sequelize.col("quantity")), "DESC"]],
      raw: true,
    });

    const userRank = leaderboard.findIndex(entry => entry.userId === Number.parseInt(userId)) + 1;
    const userEntry = leaderboard.find(entry => entry.userId === Number.parseInt(userId));

    res.json({
      rank: userRank || null,
      totalDrinks: userEntry ? Number.parseInt(userEntry.totalDrinks) : 0,
      totalUsers: leaderboard.length,
    });
  }
  catch (error) {
    console.error("Get user rank error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
