const express = require('express');
const Category = require('../models/Category');
const Link = require('../models/Link');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all categories for admin's store
router.get('/', authMiddleware, async (req, res) => {
  try {
    const categories = await Category.find({ dmartCode: req.admin.dmartCode }).sort({ type: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories by link (public - for submission form)
router.get('/by-link/:linkId', async (req, res) => {
  try {
    const link = await Link.findOne({ linkId: req.params.linkId, isActive: true });
    if (!link) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    const categories = await Category.find({ dmartCode: link.dmartCode }).sort({ type: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add category
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, type } = req.body;
    const existing = await Category.findOne({ name, type, dmartCode: req.admin.dmartCode });
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    const category = await Category.create({ name, type, dmartCode: req.admin.dmartCode });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, dmartCode: req.admin.dmartCode },
      { name },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete category
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, dmartCode: req.admin.dmartCode });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
