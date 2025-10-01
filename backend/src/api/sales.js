import express from 'express';
import { User, Drink, Transaction } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

const router = express.Router();

// Make a sale (admin only)
router.post('/sell', authenticateToken, requireAdmin, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, drinkId, quantity = 1 } = req.body;

    if (!userId || !drinkId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'User ID and Drink ID are required' });
    }

    const user = await User.findByPk(userId, { transaction });
    const drink = await Drink.findByPk(drinkId, { transaction });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    if (!drink) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Drink not found' });
    }

    if (!drink.isInStock() || drink.stock < quantity) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Insufficient stock or drink not available' });
    }

    const totalCost = drink.price * quantity;

    if (user.credits < totalCost) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Insufficient credits',
        required: totalCost,
        available: user.credits
      });
    }

    await user.deductCredits(totalCost);
    await drink.deductStock(quantity);

    const saleTransaction = await Transaction.create({
      userId: user.id,
      drinkId: drink.id,
      adminId: req.user.id,
      type: 'sale',
      amount: totalCost,
      quantity: quantity,
      description: `Sale: ${quantity}x ${drink.name}`
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Sale completed successfully',
      transaction: {
        id: saleTransaction.id,
        user: {
          id: user.id,
          username: user.username,
          remainingCredits: user.credits
        },
        drink: {
          id: drink.id,
          name: drink.name,
          remainingStock: drink.stock
        },
        quantity,
        totalCost,
        admin: {
          id: req.user.id,
          username: req.user.username
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Sale error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get transaction history
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      userId, 
      type, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (userId) {
      whereClause.userId = userId;
    }
    if (type && ['sale', 'credit_addition'].includes(type)) {
      whereClause.type = type;
    }
    if (startDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.gte]: new Date(startDate)
      };
    }
    if (endDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.lte]: new Date(endDate)
      };
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'userType']
        },
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username']
        },
        {
          model: Drink,
          as: 'drink',
          attributes: ['id', 'name', 'category'],
          required: false
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['transactionDate', 'DESC']]
    });

    res.json({
      transactions: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause = {};

    if (startDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.gte]: new Date(startDate)
      };
    }
    if (endDate) {
      whereClause.transactionDate = {
        ...whereClause.transactionDate,
        [Op.lte]: new Date(endDate)
      };
    }

    const salesStats = await Transaction.findAll({
      where: { ...whereClause, type: 'sale' },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalItemsSold']
      ]
    });

    const creditStats = await Transaction.findAll({
      where: { ...whereClause, type: 'credit_addition' },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCreditAdditions'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalCreditsAdded']
      ]
    });

    // Top selling drinks
    const topDrinks = await Transaction.findAll({
      where: { ...whereClause, type: 'sale' },
      include: [{
        model: Drink,
        as: 'drink',
        attributes: ['id', 'name']
      }],
      attributes: [
        'drinkId',
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'salesCount'],
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue']
      ],
      group: ['drinkId', 'drink.id', 'drink.name'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      limit: 10
    });

    res.json({
      sales: salesStats[0] || { totalSales: 0, totalRevenue: 0, totalItemsSold: 0 },
      credits: creditStats[0] || { totalCreditAdditions: 0, totalCreditsAdded: 0 },
      topDrinks
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/undo/:transactionId', authenticateToken, requireAdmin, async (req, res) => {
  const dbTransaction = await sequelize.transaction();
  
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      await dbTransaction.rollback();
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transactionToUndo = await Transaction.findByPk(transactionId, {
      include: [
        { model: User, as: 'user' },
        { model: Drink, as: 'drink' },
        { model: User, as: 'admin' }
      ],
      transaction: dbTransaction
    });

    if (!transactionToUndo) {
      await dbTransaction.rollback();
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const user = transactionToUndo.user;
    const drink = transactionToUndo.drink;

    if (transactionToUndo.type === 'sale') {
      // Use unchecked method to restore credits (bypass 10-credit rule for undo operations)
      await user.addCreditsUnchecked(transactionToUndo.amount);
      
      if (drink) {
        await drink.addStock(transactionToUndo.quantity || 1);
      }
    } else if (transactionToUndo.type === 'credit_addition') {
      if (user.credits < transactionToUndo.amount) {
        await dbTransaction.rollback();
        return res.status(400).json({ 
          error: 'Cannot undo credit addition: user has insufficient credits',
          userCredits: user.credits,
          requiredCredits: transactionToUndo.amount
        });
      }
      
      // Use unchecked method to deduct credits (bypass 10-credit rule for undo operations)
      await user.deductCreditsUnchecked(transactionToUndo.amount);
    } else {
      await dbTransaction.rollback();
      return res.status(400).json({ error: 'Cannot undo this transaction type' });
    }

    await transactionToUndo.destroy({ transaction: dbTransaction });

    await dbTransaction.commit();

    res.json({
      message: 'Transaction undone successfully',
      undoTransaction: {
        id: transactionToUndo.id,
        type: transactionToUndo.type,
        amount: transactionToUndo.amount,
        quantity: transactionToUndo.quantity,
        user: {
          id: user.id,
          username: user.username,
          newCredits: user.credits
        },
        drink: drink ? {
          id: drink.id,
          name: drink.name,
          newStock: drink.stock
        } : null,
        undoneBy: {
          id: req.user.id,
          username: req.user.username
        }
      }
    });
  } catch (error) {
    await dbTransaction.rollback();
    console.error('Undo transaction error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
