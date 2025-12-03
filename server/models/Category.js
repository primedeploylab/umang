const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['department', 'shift'], required: true },
  dmartCode: { type: String, required: true } // Belongs to specific store
}, { timestamps: true });

// Unique per store
categorySchema.index({ name: 1, type: 1, dmartCode: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
