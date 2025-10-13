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
      attributes: ["name", "description", "price", "stock", "category", "isActive"],
    });

    const csvRows = drinks.map((drink) => {
      const escapedName = (drink.name || "").replace(/"/g, "\"\"");
      const escapedDescription = (drink.description || "").replace(/"/g, "\"\"");
      return `"${escapedName}","${escapedDescription}",${drink.price},${drink.stock},"${drink.category}",${drink.isActive}`;
    });

    const header = "name,description,price,stock,category,isActive";
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
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock = 0, category = "beverage" } = req.body;

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
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category, isActive } = req.body;

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
          const [name, description, price, stock, category, isActive] = Object.values(data);

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

            await drink.update({
              description: description?.trim() || drink.description,
              price: parsedPrice,
              stock: parsedStock,
              category: category?.trim() || drink.category,
              isActive: parsedIsActive,
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
