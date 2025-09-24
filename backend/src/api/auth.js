import express from 'express';
import { User } from '../models/index.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await User.findOne({ where: { username } });

    if (!user || !user.canLogin()) {
      return res.status(401).json({ error: 'Invalid credentials or unauthorized user' });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (should be protected in production)
router.post('/create-admin', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Admin creation not allowed in production' });
    }
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const admin = await User.create({
      username,
      password,
      userType: 'admin'
    });

    res.status(201).json({
      message: 'Admin created successfully',
      user: {
        id: admin.id,
        username: admin.username,
        userType: admin.userType
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
