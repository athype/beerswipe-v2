import express from 'express';
import { User, Transaction } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

const router = express.Router();

// Get monthly leaderboard
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const leaderboard = await Transaction.findAll({
      where: {
        type: 'sale',
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'userType'],
        where: {
          userType: { [Op.ne]: 'admin' }
        }
      }],
      attributes: [
        'userId',
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'transactionCount'],
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalDrinks'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalSpent']
      ],
      group: ['userId', 'user.id', 'user.username', 'user.userType'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      raw: false
    });

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.user.username,
      userType: entry.user.userType,
      transactionCount: parseInt(entry.dataValues.transactionCount) || 0,
      totalDrinks: parseInt(entry.dataValues.totalDrinks) || 0,
      totalSpent: parseInt(entry.dataValues.totalSpent) || 0
    }));

    res.json({
      leaderboard: formattedLeaderboard,
      period: {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }),
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's rank for a specific month
router.get('/rank/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all users' totals
    const leaderboard = await Transaction.findAll({
      where: {
        type: 'sale',
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id'],
        where: {
          userType: { [Op.ne]: 'admin' }
        }
      }],
      attributes: [
        'userId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalDrinks']
      ],
      group: ['userId', 'user.id'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      raw: true
    });

    const userRank = leaderboard.findIndex(entry => entry.userId === parseInt(userId)) + 1;
    const userEntry = leaderboard.find(entry => entry.userId === parseInt(userId));

    res.json({
      rank: userRank || null,
      totalDrinks: userEntry ? parseInt(userEntry.totalDrinks) : 0,
      totalUsers: leaderboard.length
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
