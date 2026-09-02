import { Readable } from "node:stream";
import csv from "csv-parser";
import express from "express";
import multer from "multer";
import { Op } from "sequelize";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { Drink } from "../models/index.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Export stock to CSV (admin only) - MUST come before /:id route
/**
 * @openapi
 * /drinks/export-csv:
 *   get:
 *     summary: Export the drink catalog to CSV
 *     description: >
 *       Downloads all drinks (optionally filtered) as
 *       `name,description,price,stock,category,isActive` with quoted fields.
 *     tags: [Drinks]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Restrict to one category
 *       - in: query
 *         name: inStock
 *         schema: { type: string, enum: ["true"] }
 *         description: Only active drinks with stock above zero
 *     responses:
 *       200:
 *         description: CSV file download
 *         headers:
 *           Content-Disposition:
 *             schema: { type: string }
 *             description: attachment; filename=stock-export-<date>.csv
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *             example: "\"Grolsch\",\"0.0% pilsener\",60,120,beer,true"
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
router.get("/export-csv", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category, inStock } = req.query;

    const whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (inStock === "true") {
      whereClause.stock = { [Op.gt]: 0 };
      whereClause.isActive = true;
    }

    const drinks = await Drink.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
      attributes: ["name", "description", "price", "stock", "category", "isActive", "isAlcohol"],
    });

    const csvRows = drinks.map((drink) => {
      const escapedName = (drink.name || "").replace(/"/g, "\"\"");
      const escapedDescription = (drink.description || "").replace(/"/g, "\"\"");
      return `"${escapedName}","${escapedDescription}",${drink.price},${drink.stock},"${drink.category}",${drink.isActive},${drink.isAlcohol}`;
    });

    const header = "name,description,price,stock,category,isActive,isAlcohol";
    const csvContent = [header, ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=stock-export-${new Date().toISOString().split("T")[0]}.csv`);

    res.send(csvContent);
  }
  catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ error: "Failed to export stock" });
  }
});

// Get all drinks
/**
 * @openapi
 * /drinks:
 *   get:
 *     summary: List drinks
 *     description: Public catalog listing, paginated and filterable.
 *     tags: [Drinks]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive name substring search
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: inStock
 *         schema: { type: string, enum: ["true"] }
 *         description: Only active drinks with stock above zero
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated drink list
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/DrinkList" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/", async (req, res) => {
  try {
    const { search, category, inStock, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause.name = { [Op.iLike]: `%${search}%` };
    }
    if (category) {
      whereClause.category = category;
    }
    if (inStock === "true") {
      whereClause.stock = { [Op.gt]: 0 };
      whereClause.isActive = true;
    }

    const { count, rows } = await Drink.findAndCountAll({
      where: whereClause,
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["name", "ASC"]],
    });

    res.json({
      drinks: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        pages: Math.ceil(count / limit),
        limit: Number.parseInt(limit),
      },
    });
  }
  catch (error) {
    console.error("Get drinks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get drink by ID
/**
 * @openapi
 * /drinks/{id}:
 *   get:
 *     summary: Get one drink
 *     description: Includes soft-deleted drinks (isActive false).
 *     tags: [Drinks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The drink
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Drink" }
 *       404:
 *         description: Drink not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/:id", async (req, res) => {
  try {
    const drink = await Drink.findByPk(req.params.id);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    res.json(drink);
  }
  catch (error) {
    console.error("Get drink error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new drink (admin only)
/**
 * @openapi
 * /drinks:
 *   post:
 *     summary: Create a drink
 *     description: Drink names must be unique.
 *     tags: [Drinks]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateDrinkRequest"
 *     responses:
 *       201:
 *         description: Drink created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 drink: { $ref: "#/components/schemas/Drink" }
 *       400:
 *         description: Name/price missing, price <= 0, or name already in use
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
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock = 0, category = "beverage", isAlcohol = false } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required" });
    }

    if (price <= 0) {
      return res.status(400).json({ error: "Price must be greater than 0" });
    }

    const existingDrink = await Drink.findOne({ where: { name } });
    if (existingDrink) {
      return res.status(400).json({ error: "Drink with this name already exists" });
    }

    const drink = await Drink.create({
      name,
      description,
      price: Number.parseInt(price),
      stock: Number.parseInt(stock),
      category,
      isAlcohol: isAlcohol === true || isAlcohol === "true",
    });

    res.status(201).json({
      message: "Drink created successfully",
      drink,
    });
  }
  catch (error) {
    console.error("Create drink error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update drink (admin only)
/**
 * @openapi
 * /drinks/{id}:
 *   put:
 *     summary: Update a drink
 *     description: Only provided fields are updated.
 *     tags: [Drinks]
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
 *             $ref: "#/components/schemas/UpdateDrinkRequest"
 *     responses:
 *       200:
 *         description: Drink updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 drink: { $ref: "#/components/schemas/Drink" }
 *       400:
 *         description: Invalid price
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
 *         description: Drink not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category, isActive, isAlcohol } = req.body;

    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    const updatedDrink = await drink.update({
      name: name || drink.name,
      description: description !== undefined ? description : drink.description,
      price: price !== undefined ? Number.parseInt(price) : drink.price,
      stock: stock !== undefined ? Number.parseInt(stock) : drink.stock,
      category: category || drink.category,
      isActive: isActive !== undefined ? isActive : drink.isActive,
      isAlcohol: isAlcohol !== undefined ? isAlcohol === true || isAlcohol === "true" : drink.isAlcohol,
    });

    res.json({
      message: "Drink updated successfully",
      drink: updatedDrink,
    });
  }
  catch (error) {
    console.error("Update drink error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add stock (admin only)
/**
 * @openapi
 * /drinks/{id}/add-stock:
 *   post:
 *     summary: Add stock to a drink
 *     tags: [Drinks]
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
 *             $ref: "#/components/schemas/AddStockRequest"
 *     responses:
 *       200:
 *         description: Stock added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 drink:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     name: { type: string }
 *                     stock: { type: integer }
 *       400:
 *         description: Quantity must be a positive number
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
 *         description: Drink not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/:id/add-stock", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive number" });
    }

    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    await drink.addStock(Number.parseInt(quantity));

    res.json({
      message: "Stock added successfully",
      drink: {
        id: drink.id,
        name: drink.name,
        stock: drink.stock,
      },
    });
  }
  catch (error) {
    console.error("Add stock error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Import stock from CSV (admin only)
/**
 * @openapi
 * /drinks/import-csv:
 *   post:
 *     summary: Import drinks from a CSV file
 *     description: >
 *       Columns: `name,description,price,stock,category,isActive` (no header
 *       row). Existing drink names are updated (stock, price, ...), new names
 *       are created.
 *     tags: [Drinks]
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
 *                 imported: { type: integer, description: Created + updated drinks }
 *                 errors: { type: integer, description: Failed lines }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       action: { type: string, enum: [created, updated] }
 *                       stock: { type: integer }
 *                 errorDetails:
 *                   type: array
 *                   items: { type: string }
 *                   description: Per-line failure messages
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
router.post("/import-csv", authenticateToken, requireAdmin, upload.single("csvFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const results = [];
    const errors = [];
    let lineNumber = 0;

    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv({ headers: false }))
      .on("data", async (data) => {
        lineNumber++;
        try {
          const [name, description, price, stock, category, isActive, isAlcohol] = Object.values(data);

          if (!name) {
            errors.push(`Line ${lineNumber}: Name is required`);
            return;
          }

          // Check if drink exists
          let drink = await Drink.findOne({ where: { name: name.trim() } });

          if (drink) {
            // Update existing drink's stock
            const parsedStock = Number.parseInt(stock) || 0;
            const parsedPrice = Number.parseInt(price) || drink.price;
            const parsedIsActive = isActive === "true";
            const hasIsAlcohol = isAlcohol !== undefined && isAlcohol !== "";

            await drink.update({
              description: description?.trim() || drink.description,
              price: parsedPrice,
              stock: parsedStock,
              category: category?.trim() || drink.category,
              isActive: parsedIsActive,
              isAlcohol: hasIsAlcohol ? isAlcohol === "true" : drink.isAlcohol,
            });

            results.push({
              name: drink.name,
              action: "updated",
              stock: drink.stock,
            });
          }
          else {
            // Create new drink
            if (!price || Number.parseInt(price) <= 0) {
              errors.push(`Line ${lineNumber}: Valid price is required for new drink "${name}"`);
              return;
            }

            drink = await Drink.create({
              name: name.trim(),
              description: description?.trim() || null,
              price: Number.parseInt(price),
              stock: Number.parseInt(stock) || 0,
              category: category?.trim() || "beverage",
              isActive: isActive === "true",
              isAlcohol: isAlcohol === "true",
            });

            results.push({
              name: drink.name,
              action: "created",
              stock: drink.stock,
            });
          }
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
          results,
          errorDetails: errors,
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

// Delete drink (admin only)
/**
 * @openapi
 * /drinks/{id}:
 *   delete:
 *     summary: Soft-delete a drink
 *     description: Sets isActive to false; the row and its sale history are kept.
 *     tags: [Drinks]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Drink deleted
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
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
 *         description: Drink not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    // Soft delete by setting isActive to false
    await drink.update({ isActive: false });

    res.json({ message: "Drink deleted successfully" });
  }
  catch (error) {
    console.error("Delete drink error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
