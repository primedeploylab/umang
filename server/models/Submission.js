const mongoose = require('mongoose');

// Schema for individual songs within a submission
const songSchema = new mongoose.Schema({
  songName: { type: String, default: '' },
  youtubeLink: { type: String },
  fingerprint: { type: String },
  metadata: {
    title: String,
    description: String,
    tags: [String],
    extractedSongs: [String],
    normalizedTitle: String
  }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  dmartCode: { type: String, required: true },
  department: { type: String, required: true },
  shift: { type: String, required: true },
  gender: { type: String, required: true },
  members: [{ type: String }],
  // Multiple songs in one submission
  songs: [songSchema],
  // Legacy single song fields (for backward compatibility)
  songName: { type: String, default: '' },
  youtubeLink: { type: String },
  audioFileUrl: { type: String },
  fingerprint: { type: String },
  metadata: {
    title: String,
    description: String,
    tags: [String],
    extractedSongs: [String],
    normalizedTitle: String
  },
  deviceId: { type: String },
  linkId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
