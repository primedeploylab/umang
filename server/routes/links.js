const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Link = require('../models/Link');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Generate new link (admin only)
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const linkId = uuidv4().slice(0, 8);
    const link = await Link.create({ linkId, dmartCode: req.admin.dmartCode });
    res.status(201).json({ linkId: link.linkId, url: `/submit/${link.linkId}` });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all links for admin's store
router.get('/', authMiddleware, async (req, res) => {
  try {
    const links = await Link.find({ dmartCode: req.admin.dmartCode }).sort({ createdAt: -1 });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify link (public)
router.get('/verify/:linkId', async (req, res) => {
  try {
    const link = await Link.findOne({ linkId: req.params.linkId, isActive: true });
    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }
    res.json({ valid: true, dmartCode: link.dmartCode });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Deactivate link
router.put('/:linkId/deactivate', authMiddleware, async (req, res) => {
  try {
    const link = await Link.findOneAndUpdate(
      { linkId: req.params.linkId, dmartCode: req.admin.dmartCode },
      { isActive: false },
      { new: true }
    );
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
