import { Readable } from "node:stream";
import csv from "csv-parser";
import express from "express";
import multer from "multer";
import { Op } from "sequelize";
import { authenticateRequest, requireAdmin, requireAdminOrSeller } from "../middleware/auth.js";
import { User } from "../models/index.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all users (admin only)
/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users
 *     description: Paginated user list. Sellers and admins; password hashes are never returned.
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [admin, member, non-member] }
 *         description: Filter by user type
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive username substring search
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/User" }
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
router.get("/", authenticateRequest, requireAdminOrSeller, async (req, res) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (type && ["admin", "member", "non-member"].includes(type)) {
      whereClause.userType = type;
    }
    if (search) {
      whereClause.username = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["username", "ASC"]],
      attributes: { exclude: ["password"] },
    });

    res.json({
      users: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        pages: Math.ceil(count / limit),
        limit: Number.parseInt(limit),
      },
    });
  }
  catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export users to CSV (MUST come before /:id route)
/**
 * @openapi
 * /users/export-csv:
 *   get:
 *     summary: Export non-admin users to CSV
 *     description: >
 *       Downloads members and non-members (admins/sellers are never exported)
 *       as `username,credits,dateOfBirth,isMember`. dateOfBirth is formatted
 *       DD-MM-YYYY and left empty when no birth date is recorded.
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [member, non-member] }
 *         description: Restrict export to one user type
 *     responses:
 *       200:
 *         description: CSV file download
 *         headers:
 *           Content-Disposition:
 *             schema: { type: string }
 *             description: attachment; filename=users-export-<date>.csv
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *             example: "username,credits,dateOfBirth,isMember\nada,120,01-01-2000,true"
 *       401:
 *         description: Missing or invalid authToken cookie
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
router.get("/export-csv", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const { type } = req.query;

    const whereClause = {};
    // Only export non-admin users (members and non-members)
    if (type && ["member", "non-member"].includes(type)) {
      whereClause.userType = type;
    }
    else {
      whereClause.userType = { [Op.in]: ["member", "non-member"] };
    }

    const users = await User.findAll({
      where: whereClause,
      order: [["username", "ASC"]],
      attributes: ["username", "credits", "dateOfBirth", "userType"],
    });

    // Generate CSV content
    const csvRows = users.map((user) => {
      const dateOfBirth = user.dateOfBirth
        ? new Date(user.dateOfBirth).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).replace(/\//g, "-")
        : "";

      const isMember = user.userType === "member" ? "true" : "false";

      return `${user.username},${user.credits},${dateOfBirth},${isMember}`;
    });

    const header = "username,credits,dateOfBirth,isMember";
    const csvContent = [header, ...csvRows].join("\n");

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=users-export-${new Date().toISOString().split("T")[0]}.csv`);

    res.send(csvContent);
  }
  catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ error: "Failed to export users" });
  }
});

// Get user by ID
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get one user
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The user (password hash excluded)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/User" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/:id", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  }
  catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new user (member/non-member)
/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a member or non-member user
 *     description: Created users cannot log in (no password is set for them).
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, maxLength: 50 }
 *               credits: { type: integer, minimum: 0, default: 0 }
 *               dateOfBirth: { type: string, format: date, nullable: true }
 *               userType: { type: string, enum: [member, non-member], default: member }
 *             required: [username]
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     credits: { type: integer }
 *                     dateOfBirth: { type: string, format: date, nullable: true }
 *                     userType: { type: string }
 *       400:
 *         description: Username required, invalid user type, or username taken
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
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
router.post("/", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const { username, credits = 0, dateOfBirth, userType = "member" } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    if (!["member", "non-member"].includes(userType)) {
      return res.status(400).json({ error: "Invalid user type" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const user = await User.create({
      username,
      credits,
      dateOfBirth,
      userType,
      password: null, // Members and non-members cannot log in
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        username: user.username,
        credits: user.credits,
        dateOfBirth: user.dateOfBirth,
        userType: user.userType,
      },
    });
  }
  catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add credits to user
/**
 * @openapi
 * /users/{id}/add-credits:
 *   post:
 *     summary: Add credits to a user's balance
 *     description: >
 *       Credits are added in blocks of 10, per domain invariant. Also records
 *       a `credit_addition` transaction with the acting admin.
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Credit amount; must be a multiple of 10
 *                 multipleOf: 10
 *             required: [amount]
 *     responses:
 *       200:
 *         description: Credits added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     credits: { type: integer }
 *       400:
 *         description: Amount must be a positive block of 10
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/:id/add-credits", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount % 10 !== 0) {
      return res.status(400).json({ error: "Credits must be added in blocks of 10" });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.addCredits(amount);

    // Create transaction record
    const { Transaction } = await import("../models/index.js");
    await Transaction.create({
      userId: user.id,
      adminId: req.user.id,
      type: "credit_addition",
      amount,
      description: `Credits added: ${amount}`,
    });

    res.json({
      message: "Credits added successfully",
      user: {
        id: user.id,
        username: user.username,
        credits: user.credits,
      },
    });
  }
  catch (error) {
    console.error("Add credits error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

function parseFlexibleDate(dateStr) {
  if (!dateStr || dateStr.trim() === "")
    return null;

  const cleanDate = dateStr.trim();

  // Check for YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2020) {
      return date;
    }
  }

  // Check for DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleanDate)) {
    const [day, month, year] = cleanDate.split("-");
    const date = new Date(year, month - 1, day); // month is 0-indexed in JS
    if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2020) {
      return date;
    }
  }

  // Try to parse ambiguous formats intelligently
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleanDate) || /^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const parts = cleanDate.split("-");

    // If first part is 4 digits, assume YYYY-MM-DD
    if (parts[0].length === 4) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2020) {
        return date;
      }
    }
    else {
      // Assume DD-MM-YYYY
      const date = new Date(parts[2], parts[1] - 1, parts[0]);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2020) {
        return date;
      }
    }
  }

  // If all else fails, try generic Date parsing
  const fallbackDate = new Date(cleanDate);
  if (!isNaN(fallbackDate.getTime()) && fallbackDate.getFullYear() >= 1900 && fallbackDate.getFullYear() <= 2020) {
    return fallbackDate;
  }

  return null;
}

// Import users from CSV
/**
 * @openapi
 * /users/import-csv:
 *   post:
 *     summary: Import users from a CSV file
 *     description: >
 *       Columns: `username,credits,dateOfBirth,isMember` (no header row).
 *       dateOfBirth is optional and parsed flexibly (YYYY-MM-DD or DD-MM-YYYY).
 *       Existing usernames are skipped and reported as per-line errors.
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: Uploaded .csv file (see column spec above)
 *             required: [csvFile]
 *     responses:
 *       200:
 *         description: Import finished — per-line results and errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 imported: { type: integer, description: Users created }
 *                 errors:
 *                   type: array
 *                   items: { type: string }
 *                   description: Per-line failures incl. unparsable dates
 *                 warnings: { type: integer }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username: { type: string }
 *                       credits: { type: integer }
 *                       userType: { type: string }
 *                       dateOfBirth: { type: string, format: date, nullable: true }
 *       400:
 *         description: CSV file is required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
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
router.post("/import-csv", authenticateRequest, requireAdmin, upload.single("csvFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const results = [];
    const errors = [];
    const dateWarnings = [];
    let lineNumber = 0;

    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv({ headers: false }))
      .on("data", async (data) => {
        lineNumber++;
        try {
          const [username, credits, dateOfBirth, isMember] = Object.values(data);

          if (!username) {
            errors.push(`Line ${lineNumber}: Username is required`);
            return;
          }

          // Check if user already exists
          const existingUser = await User.findOne({ where: { username } });
          if (existingUser) {
            errors.push(`Line ${lineNumber}: Username ${username} already exists`);
            return;
          }

          const userType = isMember === "true" ? "member" : "non-member";
          const parsedCredits = Number.parseInt(credits) || 0;

          // Parse date with flexible format handling
          let parsedDate = null;
          if (dateOfBirth) {
            parsedDate = parseFlexibleDate(dateOfBirth);
            if (!parsedDate && dateOfBirth.trim() !== "") {
              dateWarnings.push(`Line ${lineNumber}: Could not parse date "${dateOfBirth}" for user ${username}, using null`);
            }
          }

          const user = await User.create({
            username,
            credits: parsedCredits,
            dateOfBirth: parsedDate,
            userType,
            password: null,
          });

          results.push({
            username: user.username,
            credits: user.credits,
            userType: user.userType,
            dateOfBirth: parsedDate ? parsedDate.toISOString().split("T")[0] : null,
          });
        }
        catch (error) {
          errors.push(`Line ${lineNumber}: ${error.message}`);
        }
      })
      .on("end", () => {
        res.json({
          message: "CSV import completed",
          imported: results.length,
          errors: errors.length,
          warnings: dateWarnings.length,
          results,
          errors: [...errors, ...dateWarnings],
        });
      })
      .on("error", (error) => {
        console.error("CSV import error:", error);
        res.status(500).json({ error: "Failed to process CSV file" });
      });
  }
  catch (error) {
    console.error("CSV import error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user
/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Update a member or non-member user
 *     description: >
 *       Only provided fields are updated. Admin and seller users cannot be
 *       modified through this endpoint.
 *     tags: [Users]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, maxLength: 50 }
 *               dateOfBirth: { type: string, format: date, nullable: true }
 *               userType: { type: string, enum: [member, non-member] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     credits: { type: integer }
 *                     dateOfBirth: { type: string, format: date, nullable: true }
 *                     userType: { type: string }
 *                     isActive: { type: boolean }
 *       400:
 *         description: Cannot modify admin or seller users through this endpoint
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.put("/:id", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const { username, dateOfBirth, userType, isActive } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent changing admin or seller users
    if (user.userType === "admin" || user.userType === "seller") {
      return res.status(400).json({ error: "Cannot modify admin or seller users through this endpoint" });
    }

    const updatedUser = await user.update({
      username: username || user.username,
      dateOfBirth: dateOfBirth || user.dateOfBirth,
      userType: userType || user.userType,
      isActive: isActive !== undefined ? isActive : user.isActive,
    });

    res.json({
      message: "User updated successfully",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        credits: updatedUser.credits,
        dateOfBirth: updatedUser.dateOfBirth,
        userType: updatedUser.userType,
        isActive: updatedUser.isActive,
      },
    });
  }
  catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
