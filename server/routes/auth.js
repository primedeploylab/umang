const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/auth');
const { seedCategories } = require('../seed');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password, dmartCode } = req.body;
    
    if (!dmartCode) {
      return res.status(400).json({ error: 'DMart Code is required' });
    }

    const admin = await Admin.findOne({ dmartCode });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid DMart code' });
    }

    if (admin.username !== username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, dmartCode: admin.dmartCode },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({ token, username: admin.username, dmartCode: admin.dmartCode });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register new store
router.post('/register', async (req, res) => {
  try {
    const { username, password, dmartCode } = req.body;
    
    if (!username || !password || !dmartCode) {
      return res.status(400).json({ error: 'DMart code, email and password are required' });
    }

    const existingAdmin = await Admin.findOne({ dmartCode });
    if (existingAdmin) {
      return res.status(400).json({ error: 'This DMart code is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, passwordHash, dmartCode });
    
    // Seed default categories for this store
    await seedCategories(dmartCode);

    const token = jwt.sign(
      { id: admin._id, username: admin.username, dmartCode: admin.dmartCode },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, username: admin.username, dmartCode: admin.dmartCode });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify token
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.admin.username, dmartCode: req.admin.dmartCode });
});

module.exports = router;
