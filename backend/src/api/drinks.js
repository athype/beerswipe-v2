import express from 'express';
import { Drink } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { Op } from 'sequelize';

const router = express.Router();

// Get all drinks
router.get('/', async (req, res) => {
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
    if (inStock === 'true') {
      whereClause.stock = { [Op.gt]: 0 };
      whereClause.isActive = true;
    }

    const { count, rows } = await Drink.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']]
    });

    res.json({
      drinks: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get drinks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get drink by ID
router.get('/:id', async (req, res) => {
  try {
    const drink = await Drink.findByPk(req.params.id);

    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    res.json(drink);
  } catch (error) {
    console.error('Get drink error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock = 0, category = 'beverage' } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (price <= 0) {
      return res.status(400).json({ error: 'Price must be greater than 0' });
    }

    // Check if drink already exists
    const existingDrink = await Drink.findOne({ where: { name } });
    if (existingDrink) {
      return res.status(400).json({ error: 'Drink with this name already exists' });
    }

    const drink = await Drink.create({
      name,
      description,
      price: parseInt(price),
      stock: parseInt(stock),
      category
    });

    res.status(201).json({
      message: 'Drink created successfully',
      drink
    });
  } catch (error) {
    console.error('Create drink error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update drink (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category, isActive } = req.body;
    
    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    const updatedDrink = await drink.update({
      name: name || drink.name,
      description: description !== undefined ? description : drink.description,
      price: price !== undefined ? parseInt(price) : drink.price,
      stock: stock !== undefined ? parseInt(stock) : drink.stock,
      category: category || drink.category,
      isActive: isActive !== undefined ? isActive : drink.isActive
    });

    res.json({
      message: 'Drink updated successfully',
      drink: updatedDrink
    });
  } catch (error) {
    console.error('Update drink error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add stock (admin only)
router.post('/:id/add-stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    await drink.addStock(parseInt(quantity));

    res.json({
      message: 'Stock added successfully',
      drink: {
        id: drink.id,
        name: drink.name,
        stock: drink.stock
      }
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete drink (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const drink = await Drink.findByPk(req.params.id);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    // Soft delete by setting isActive to false
    await drink.update({ isActive: false });

    res.json({ message: 'Drink deleted successfully' });
  } catch (error) {
    console.error('Delete drink error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
