const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  dmartCode: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
