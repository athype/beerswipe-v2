import express from "express";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { authenticateRequest, requireAdmin, requireAdminOrSeller } from "../middleware/auth.js";
import { Drink, Transaction, User } from "../models/index.js";
import { sellRequestSchema } from "../validation/contracts.js";

const router = express.Router();

// Sellers may only undo their own recent sales; admins keep full undo rights.
const SELLER_UNDO_WINDOW_MS = 15 * 60 * 1000;

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  let birthYear;
  let birthMonth;
  let birthDay;

  if (typeof dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    const [y, m, d] = dateOfBirth.split("-").map(Number);
    birthYear = y;
    birthMonth = m;
    birthDay = d;
  } else {
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return null;
    birthYear = birthDate.getUTCFullYear();
    birthMonth = birthDate.getUTCMonth() + 1;
    birthDay = birthDate.getUTCDate();
  }

  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }

  return age;
}

// Make a sale (admin or seller)
/**
 * @openapi
 * /sales/sell:
 *   post:
 *     summary: Sell drinks to a user
 *     description: >
 *       Atomically deducts credits from the user, stock from the drink, and
 *       records a `sale` transaction row. Sellers and admins.
 *     tags: [Sales]
 *     security:
 *       - authToken: []
 *       - apiKeyHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: "#/components/schemas/SellRequest" }
 *     responses:
 *       200:
 *         description: Sale completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         username: { type: string }
 *                         remainingCredits: { type: integer }
 *                     drink:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         name: { type: string }
 *                         remainingStock: { type: integer }
 *                     quantity: { type: integer }
 *                     totalCost: { type: integer }
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         username: { type: string }
 *       400:
 *         description: Validation failed, drink not available/out of stock, or insufficient credits
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/Error"
 *                 - type: object
 *                   properties:
 *                     error: { type: string }
 *                     required: { type: integer, description: Credits required }
 *                     available: { type: integer, description: Credits the user has }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: >
 *           Admin or seller access required, or — for alcohol drinks — the
 *           buyer has no date of birth on file or is under 18 (legal age gate)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: User or drink not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/sell", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  let transaction;

  try {
    const parsedBody = sellRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const { issues } = parsedBody.error;
      const hasUserIdError = issues.some(issue => issue.path[0] === "userId");
      const hasDrinkIdError = issues.some(issue => issue.path[0] === "drinkId");
      const hasQuantityError = issues.some(issue => issue.path[0] === "quantity");

      const isMissingField = field => req.body?.[field] === undefined || req.body?.[field] === null || req.body?.[field] === "";
      const mappedErrors = [];

      if (hasUserIdError) {
        mappedErrors.push(isMissingField("userId") ? "User ID is required" : "User ID must be a positive integer");
      }
      if (hasDrinkIdError) {
        mappedErrors.push(isMissingField("drinkId") ? "Drink ID is required" : "Drink ID must be a positive integer");
      }
      if (hasQuantityError) {
        mappedErrors.push("Quantity must be a positive integer");
      }

      return res.status(400).json({
        error: mappedErrors.length > 0
          ? mappedErrors.join("; ")
          : issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("; "),
      });
    }

    const { userId, drinkId, quantity } = parsedBody.data;

    transaction = await sequelize.transaction();

    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const drink = await Drink.findByPk(drinkId, { transaction, lock: transaction.LOCK.UPDATE });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    if (!drink) {
      await transaction.rollback();
      return res.status(404).json({ error: "Drink not found" });
    }

    // Legal gate: alcohol may only be sold to customers aged 18+ (Dutch law).
    // Never trust the client — enforce on the server.
    if (drink.isAlcohol) {
      const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
      if (age === null || age < 18) {
        await transaction.rollback();
        return res.status(403).json({
          error: age === null
            ? "Cannot sell alcohol: customer has no date of birth on file"
            : "Cannot sell alcohol: customer is under 18",
        });
      }
    }

    if (!drink.isInStock() || drink.stock < quantity) {
      await transaction.rollback();
      return res.status(400).json({ error: "Insufficient stock or drink not available" });
    }

    const totalCost = drink.price * quantity;

    if (user.credits < totalCost) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Insufficient credits",
        required: totalCost,
        available: user.credits,
      });
    }

    await user.deductCredits(totalCost, { transaction });
    await drink.deductStock(quantity, { transaction });

    const saleTransaction = await Transaction.create({
      userId: user.id,
      drinkId: drink.id,
      adminId: req.user.id,
      type: "sale",
      amount: totalCost,
      quantity,
      description: `Sale: ${quantity}x ${drink.name}`,
    }, { transaction });

    await transaction.commit();

    res.json({
      message: "Sale completed successfully",
      transaction: {
        id: saleTransaction.id,
        user: {
          id: user.id,
          username: user.username,
          remainingCredits: user.credits,
        },
        drink: {
          id: drink.id,
          name: drink.name,
          remainingStock: drink.stock,
        },
        quantity,
        totalCost,
        admin: {
          id: req.user.id,
          username: req.user.username,
        },
      },
    });
  }
  catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Sale error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get transaction history (admin or seller)
/**
 * @openapi
 * /sales/history:
 *   get:
 *     summary: List transaction history
 *     description: >
 *       Paginated audit trail of sales and credit additions, newest first,
 *       with the related user, admin and drink (drink is null for credit
 *       additions).
 *     tags: [Sales]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: integer }
 *         description: Restrict to one user
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [sale, credit_addition] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Only transactions on/after this date
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Only transactions on/before this date
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     allOf:
 *                       - $ref: "#/components/schemas/Transaction"
 *                       - type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                             properties:
 *                               id: { type: integer }
 *                               username: { type: string }
 *                               userType: { type: string }
 *                           admin:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: integer }
 *                               username: { type: string }
 *                           drink:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: integer }
 *                               name: { type: string }
 *                               category: { type: string }
 *                 pagination: { $ref: "#/components/schemas/Pagination" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin or seller access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/history", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  try {
    const {
      userId,
      type,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    if (userId) {
      whereClause.userId = userId;
    }
    if (type && ["sale", "credit_addition"].includes(type)) {
      whereClause.type = type;
    }
    if (startDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.gte]: new Date(startDate),
      };
    }
    if (endDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.lte]: new Date(endDate),
      };
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "userType"],
        },
        {
          model: User,
          as: "admin",
          attributes: ["id", "username"],
        },
        {
          model: Drink,
          as: "drink",
          attributes: ["id", "name", "category"],
          required: false,
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["transactionDate", "DESC"]],
    });

    res.json({
      transactions: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        pages: Math.ceil(count / limit),
        limit: Number.parseInt(limit),
      },
    });
  }
  catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get sales statistics (admin or seller)
/**
 * @openapi
 * /sales/stats:
 *   get:
 *     summary: Get sales and credit statistics
 *     description: Aggregates within the optional date window, plus the top 10 drinks by quantity sold.
 *     tags: [Sales]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Only transactions on/after this date
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Only transactions on/before this date
 *     responses:
 *       200:
 *         description: Aggregated statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sales:
 *                   type: object
 *                   properties:
 *                     totalSales: { type: integer, description: Sale transaction count }
 *                     totalRevenue: { type: integer, description: Credits earned }
 *                     totalItemsSold: { type: integer }
 *                 credits:
 *                   type: object
 *                   properties:
 *                     totalCreditAdditions: { type: integer }
 *                     totalCreditsAdded: { type: integer }
 *                 topDrinks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       drinkId: { type: integer }
 *                       drink:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                       salesCount: { type: integer }
 *                       totalQuantity: { type: integer }
 *                       totalRevenue: { type: integer }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin or seller access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/stats", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause = {};

    if (startDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.gte]: new Date(startDate),
      };
    }
    if (endDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.lte]: new Date(endDate),
      };
    }

    const salesStats = await Transaction.findAll({
      where: { ...whereClause, type: "sale" },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalSales"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalItemsSold"],
      ],
    });

    const creditStats = await Transaction.findAll({
      where: { ...whereClause, type: "credit_addition" },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalCreditAdditions"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalCreditsAdded"],
      ],
    });

    // Top selling drinks
    const topDrinks = await Transaction.findAll({
      where: { ...whereClause, type: "sale" },
      include: [{
        model: Drink,
        as: "drink",
        attributes: ["id", "name"],
      }],
      attributes: [
        "drinkId",
        [sequelize.fn("COUNT", sequelize.col("Transaction.id")), "salesCount"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalQuantity"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
      ],
      group: ["drinkId", "drink.id", "drink.name"],
      order: [[sequelize.fn("SUM", sequelize.col("quantity")), "DESC"]],
      limit: 10,
    });

    res.json({
      sales: salesStats[0] || { totalSales: 0, totalRevenue: 0, totalItemsSold: 0 },
      credits: creditStats[0] || { totalCreditAdditions: 0, totalCreditsAdded: 0 },
      topDrinks,
    });
  }
  catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /sales/undo/{transactionId}:
 *   delete:
 *     summary: Undo a transaction
 *     description: >
 *       Reverses a sale (credits and stock restored, bypassing the block-of-10
 *       rule) or a credit addition (credits deducted back), then deletes the
 *       transaction row. Admins may undo any transaction; sellers may only undo
 *       their own sales, within 15 minutes of the sale, and never credit
 *       additions.
 *     tags: [Sales]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Transaction undone
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 undoTransaction:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     type: { type: string, enum: [sale, credit_addition] }
 *                     amount: { type: integer }
 *                     quantity: { type: integer, nullable: true }
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         username: { type: string }
 *                         newCredits: { type: integer }
 *                     drink:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: integer }
 *                         name: { type: string }
 *                         newStock: { type: integer }
 *                     undoneBy:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         username: { type: string }
 *       400:
 *         description: Transaction ID missing, type not undoable, or user lacks credits to undo a credit addition
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: >
 *           Admin/seller role required, or a seller restriction: undoing a
 *           non-sale, someone else's sale, or a sale older than 15 minutes
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Transaction or user not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.delete("/undo/:transactionId", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  const dbTransaction = await sequelize.transaction();

  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      await dbTransaction.rollback();
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    const transactionToUndo = await Transaction.findByPk(transactionId, {
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!transactionToUndo) {
      await dbTransaction.rollback();
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Sellers: only their own sales, only within the correction window.
    if (req.user.userType !== "admin") {
      if (transactionToUndo.type !== "sale") {
        await dbTransaction.rollback();
        return res.status(403).json({ error: "Sellers can only undo sales" });
      }
      if (transactionToUndo.adminId !== req.user.id) {
        await dbTransaction.rollback();
        return res.status(403).json({ error: "You can only undo your own sales" });
      }
      const ageMs = Date.now() - new Date(transactionToUndo.transactionDate).getTime();
      if (ageMs > SELLER_UNDO_WINDOW_MS) {
        await dbTransaction.rollback();
        return res.status(403).json({ error: "Sales older than 15 minutes can only be undone by an admin" });
      }
    }

    const user = await User.findByPk(transactionToUndo.userId, {
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });
    const drink = transactionToUndo.type === "sale"
      ? await Drink.findByPk(transactionToUndo.drinkId, {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE,
        })
      : null;

    if (!user) {
      await dbTransaction.rollback();
      return res.status(404).json({ error: "User not found" });
    }

    if (transactionToUndo.type === "sale") {
      // Use unchecked method to restore credits (bypass 10-credit rule for undo operations)
      await user.addCreditsUnchecked(transactionToUndo.amount, { transaction: dbTransaction });

      if (drink) {
        await drink.addStock(transactionToUndo.quantity || 1, { transaction: dbTransaction });
      }
    }
    else if (transactionToUndo.type === "credit_addition") {
      if (user.credits < transactionToUndo.amount) {
        await dbTransaction.rollback();
        return res.status(400).json({
          error: "Cannot undo credit addition: user has insufficient credits",
          userCredits: user.credits,
          requiredCredits: transactionToUndo.amount,
        });
      }

      // Use unchecked method to deduct credits (bypass 10-credit rule for undo operations)
      await user.deductCreditsUnchecked(transactionToUndo.amount, { transaction: dbTransaction });
    }
    else {
      await dbTransaction.rollback();
      return res.status(400).json({ error: "Cannot undo this transaction type" });
    }

    await transactionToUndo.destroy({ transaction: dbTransaction });

    await dbTransaction.commit();

    res.json({
      message: "Transaction undone successfully",
      undoTransaction: {
        id: transactionToUndo.id,
        type: transactionToUndo.type,
        amount: transactionToUndo.amount,
        quantity: transactionToUndo.quantity,
        user: {
          id: user.id,
          username: user.username,
          newCredits: user.credits,
        },
        drink: drink
          ? {
              id: drink.id,
              name: drink.name,
              newStock: drink.stock,
            }
          : null,
        undoneBy: {
          id: req.user.id,
          username: req.user.username,
        },
      },
    });
  }
  catch (error) {
    await dbTransaction.rollback();
    console.error("Undo transaction error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
