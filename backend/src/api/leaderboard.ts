import type { UserType } from "@beerswipe/types";
import express from "express";
import { Op } from "sequelize";
import { sequelize } from "../config/database.ts";
import { authenticateRequest } from "../middleware/auth.ts";
import { Transaction, User } from "../models/index.ts";

type LeaderboardQuery = {
  year?: string;
  month?: string;
};

// Aggregate columns come back from Postgres as strings; the joined user and
// the per-instance dataValues are not surfaced by the data-only define().
type LeaderboardRow = {
  userId: number;
  user: {
    id: number;
    username: string;
    userType: UserType;
  };
  dataValues: {
    transactionCount: string;
    totalDrinks: string;
    totalSpent: string;
  };
};

type RankRow = {
  userId: number;
  totalDrinks: string;
};

const router = express.Router();

// Helper function to get the date range for a specific month
function getMonthDateRange(year: number, month: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1); // First day of month at 00:00:00
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month at 23:59:59.999
  return { startDate, endDate };
}

// Get monthly leaderboard
/**
 * @openapi
 * /leaderboard/monthly:
 *   get:
 *     summary: Monthly consumption leaderboard
 *     description: Ranks non-admin users by drinks bought in the given month.
 *     tags: [Leaderboard]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200:
 *         description: Ranked leaderboard for the month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank: { type: integer }
 *                       userId: { type: integer }
 *                       username: { type: string }
 *                       userType: { type: string }
 *                       transactionCount: { type: integer }
 *                       totalDrinks: { type: integer }
 *                       totalSpent: { type: integer }
 *                 period:
 *                   type: object
 *                   properties:
 *                     year: { type: integer }
 *                     month: { type: integer }
 *                     monthName: { type: string }
 *                     startDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *       400:
 *         description: Year and month are required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/monthly", authenticateRequest, async (req, res) => {
  try {
    const { year, month } = req.query as LeaderboardQuery;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const { startDate, endDate } = getMonthDateRange(Number(year), Number(month));

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
        // One multi-drink order is several rows sharing a saleGroupId, so
        // count distinct orders rather than rows.
        [sequelize.literal(`COUNT(DISTINCT COALESCE("Transaction"."saleGroupId"::text, "Transaction"."id"::text))`), "transactionCount"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalDrinks"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalSpent"],
      ],
      group: ["userId", "user.id", "user.username", "user.userType"],
      order: [[sequelize.fn("SUM", sequelize.col("quantity")), "DESC"]],
      raw: false,
    }) as unknown as LeaderboardRow[];

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
        monthName: new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "long" }),
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
/**
 * @openapi
 * /leaderboard/rank/{userId}:
 *   get:
 *     summary: One user's rank for a month
 *     description: Rank is null when the user had no sales that month.
 *     tags: [Leaderboard]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200:
 *         description: The user's rank
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rank: { type: integer, nullable: true }
 *                 totalDrinks: { type: integer }
 *                 totalUsers: { type: integer }
 *       400:
 *         description: Year and month are required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/rank/:userId", authenticateRequest, async (req, res) => {
  try {
    const { userId } = req.params as { userId: string };
    const { year, month } = req.query as LeaderboardQuery;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const { startDate, endDate } = getMonthDateRange(Number(year), Number(month));

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
    }) as unknown as RankRow[];

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
