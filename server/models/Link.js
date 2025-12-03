const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  linkId: { type: String, required: true, unique: true },
  dmartCode: { type: String, required: true }, // Belongs to specific store
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Link', linkSchema);
