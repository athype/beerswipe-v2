import express from 'express';
import { User } from '../models/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import csv from 'csv-parser';
import multer from 'multer';
import { Readable } from 'stream';
import { Op } from 'sequelize';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (type && ['admin', 'member', 'donator'].includes(type)) {
      whereClause.userType = type;
    }
    if (search) {
      whereClause.username = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['username', 'ASC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      users: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (member/donator)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, credits = 0, dateOfBirth, userType = 'member' } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!['member', 'donator'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = await User.create({
      username,
      credits,
      dateOfBirth,
      userType,
      password: null // Members and donators cannot log in
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        credits: user.credits,
        dateOfBirth: user.dateOfBirth,
        userType: user.userType
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add credits to user
router.post('/:id/add-credits', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount % 10 !== 0) {
      return res.status(400).json({ error: 'Credits must be added in blocks of 10' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.addCredits(amount);

    // Create transaction record
    const { Transaction } = await import('../models/index.js');
    await Transaction.create({
      userId: user.id,
      adminId: req.user.id,
      type: 'credit_addition',
      amount: amount,
      description: `Credits added: ${amount}`
    });

    res.json({
      message: 'Credits added successfully',
      user: {
        id: user.id,
        username: user.username,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Add credits error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export users to CSV
router.get('/export-csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type } = req.query;
    
    const whereClause = {};
    // Only export non-admin users (members and donators)
    if (type && ['member', 'donator'].includes(type)) {
      whereClause.userType = type;
    } else {
      whereClause.userType = { [Op.in]: ['member', 'donator'] };
    }

    const users = await User.findAll({
      where: whereClause,
      order: [['username', 'ASC']],
      attributes: ['username', 'credits', 'dateOfBirth', 'userType']
    });

    // Generate CSV content
    const csvRows = users.map(user => {
      const dateOfBirth = user.dateOfBirth 
        ? new Date(user.dateOfBirth).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-')
        : '';
      
      const isMember = user.userType === 'member' ? 'true' : 'false';
      
      return `${user.username},${user.credits},${dateOfBirth},${isMember}`;
    });

    const csvContent = csvRows.join('\n');
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users-export-${new Date().toISOString().split('T')[0]}.csv`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export users' });
  }
});

// Import users from CSV
router.post('/import-csv', authenticateToken, requireAdmin, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const results = [];
    const errors = [];
    let lineNumber = 0;

    const stream = Readable.from(req.file.buffer);
    
    stream
      .pipe(csv({ headers: false }))
      .on('data', async (data) => {
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

          const userType = isMember === 'true' ? 'member' : 'donator';
          const parsedCredits = parseInt(credits) || 0;
          
          const user = await User.create({
            username,
            credits: parsedCredits,
            dateOfBirth: dateOfBirth || null,
            userType,
            password: null
          });

          results.push({
            username: user.username,
            credits: user.credits,
            userType: user.userType
          });
        } catch (error) {
          errors.push(`Line ${lineNumber}: ${error.message}`);
        }
      })
      .on('end', () => {
        res.json({
          message: 'CSV import completed',
          imported: results.length,
          errors: errors.length,
          results,
          errors
        });
      })
      .on('error', (error) => {
        console.error('CSV import error:', error);
        res.status(500).json({ error: 'Failed to process CSV file' });
      });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, dateOfBirth, userType, isActive } = req.body;
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing admin users
    if (user.userType === 'admin') {
      return res.status(400).json({ error: 'Cannot modify admin users' });
    }

    const updatedUser = await user.update({
      username: username || user.username,
      dateOfBirth: dateOfBirth || user.dateOfBirth,
      userType: userType || user.userType,
      isActive: isActive !== undefined ? isActive : user.isActive
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        credits: updatedUser.credits,
        dateOfBirth: updatedUser.dateOfBirth,
        userType: updatedUser.userType,
        isActive: updatedUser.isActive
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
