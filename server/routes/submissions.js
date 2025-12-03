const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Submission = require('../models/Submission');
const Link = require('../models/Link');
const authMiddleware = require('../middleware/auth');
const { 
  generateFingerprint, 
  compareFingerprints, 
  extractSongMetadata, 
  compareMetadata,
  checkIfMusicVideo 
} = require('../utils/fingerprint');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|ogg|flac|aac/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (ext) cb(null, true);
    else cb(new Error('Only audio files allowed'));
  }
});

// Get stats for admin's store
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const dmartCode = req.admin.dmartCode;
    const submissions = await Submission.find({ dmartCode });
    
    // Count total submissions
    const totalSubmissions = submissions.length;
    
    // Count total songs (including songs array)
    let totalSongs = 0;
    for (const sub of submissions) {
      if (sub.songs && sub.songs.length > 0) {
        totalSongs += sub.songs.length;
      } else if (sub.youtubeLink) {
        totalSongs += 1;
      }
    }
    
    const duplicates = await Submission.countDocuments({ dmartCode, isDuplicate: true });
    const byDepartment = await Submission.aggregate([
      { $match: { dmartCode } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    const byShift = await Submission.aggregate([
      { $match: { dmartCode } },
      { $group: { _id: '$shift', count: { $sum: 1 } } }
    ]);
    res.json({ total: totalSubmissions, totalSongs, duplicates, byDepartment, byShift });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all submissions for admin's store
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { department, shift, search, sort = '-createdAt' } = req.query;
    const filter = { dmartCode: req.admin.dmartCode };
    if (department) filter.department = department;
    if (shift) filter.shift = shift;
    if (search) {
      filter.$or = [
        { 'members.name': new RegExp(search, 'i') },
        { songName: new RegExp(search, 'i') },
        { 'members.empCode': new RegExp(search, 'i') }
      ];
    }
    const submissions = await Submission.find(filter).sort(sort);
    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete submission
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const submission = await Submission.findOneAndDelete({ 
      _id: req.params.id, 
      dmartCode: req.admin.dmartCode 
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (submission.audioFileUrl) {
      const filePath = path.join(__dirname, '../..', submission.audioFileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ message: 'Submission deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: Extract YouTube video ID
const getVideoId = (url) => {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s?#]+)/,
    /youtu\.be\/([^&\s?#]+)/,
    /youtube\.com\/shorts\/([^&\s?#]+)/,
    /youtube\.com\/embed\/([^&\s?#]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

// Compare two songs (for user to see similarity)
router.post('/compare-songs/:linkId', upload.none(), async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId, isActive: true });
    if (!link) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    const { link1, link2 } = req.body;
    
    if (!link1 || !link2) {
      return res.status(400).json({ error: 'Please provide both song links' });
    }

    if (link1 === link2) {
      return res.json({ 
        isSame: true, 
        similarity: 100,
        reason: 'exact_url',
        message: '⚠️ These are the exact same link!'
      });
    }

    // Check YouTube Video ID match
    const videoId1 = getVideoId(link1);
    const videoId2 = getVideoId(link2);
    
    if (videoId1 && videoId2 && videoId1 === videoId2) {
      return res.json({ 
        isSame: true, 
        similarity: 100,
        reason: 'same_video',
        message: '⚠️ These links point to the same YouTube video!'
      });
    }

    // Extract metadata for both
    let metadata1 = null, metadata2 = null;
    
    try {
      if (link1) metadata1 = await extractSongMetadata(link1);
      if (link2) metadata2 = await extractSongMetadata(link2);
    } catch (e) {
      console.log('Metadata extraction error:', e.message);
    }

    // Compare metadata
    if (metadata1 && metadata2) {
      const metadataMatch = compareMetadata(metadata1, metadata2);
      if (metadataMatch) {
        return res.json({ 
          isSame: true, 
          similarity: 90,
          reason: 'metadata_match',
          message: '⚠️ These appear to be the same song based on video description/hashtags!',
          song1: metadata1.extractedSongs?.[0] || 'Unknown',
          song2: metadata2.extractedSongs?.[0] || 'Unknown'
        });
      }
    }

    // Try audio fingerprint comparison (slower)
    let fingerprint1 = null, fingerprint2 = null;
    
    try {
      fingerprint1 = await generateFingerprint(null, link1);
      fingerprint2 = await generateFingerprint(null, link2);
      
      if (fingerprint1 && fingerprint2) {
        const fpMatch = compareFingerprints(fingerprint1, fingerprint2);
        if (fpMatch) {
          return res.json({ 
            isSame: true, 
            similarity: 85,
            reason: 'audio_match',
            message: '⚠️ These songs have matching audio fingerprints - they sound the same!'
          });
        }
      }
    } catch (e) {
      console.log('Fingerprint comparison skipped:', e.message);
    }

    // Songs are different
    res.json({ 
      isSame: false, 
      similarity: 0,
      message: '✅ These appear to be different songs!',
      song1: metadata1?.extractedSongs?.[0] || (videoId1 ? `YouTube: ${videoId1}` : 'Song 1'),
      song2: metadata2?.extractedSongs?.[0] || (videoId2 ? `YouTube: ${videoId2}` : 'Song 2')
    });
  } catch (error) {
    console.error('Compare songs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if song is duplicate - also compare with user's pending songs
router.post('/check-song/:linkId', upload.single('audioFile'), async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId, isActive: true });
    if (!link) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    const { youtubeLink, pendingLinks } = req.body;
    const dmartCode = link.dmartCode;

    if (!req.file && !youtubeLink) {
      return res.status(400).json({ error: 'Please provide a song link or upload a file' });
    }

    // ========== CHECK 0: Validate if it's a music video ==========
    if (youtubeLink) {
      const musicCheck = await checkIfMusicVideo(youtubeLink);
      if (!musicCheck.isMusic) {
        return res.status(400).json({ 
          error: `❌ This doesn't appear to be a song. ${musicCheck.reason}. Please add a music/song video link.`
        });
      }
    }

    // Parse pending links (user's already added songs)
    let userPendingLinks = [];
    try {
      userPendingLinks = pendingLinks ? JSON.parse(pendingLinks) : [];
    } catch (e) {
      userPendingLinks = [];
    }

    const allSubmissions = await Submission.find({ dmartCode });
    const newVideoId = getVideoId(youtubeLink);

    // ========== CHECK 1: Exact URL match with database ==========
    if (youtubeLink) {
      for (const existing of allSubmissions) {
        if (existing.youtubeLink && existing.youtubeLink === youtubeLink) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: '❌ This exact link is already used. Please choose a different song.' });
        }
      }
    }

    // ========== CHECK 2: YouTube Video ID match with database ==========
    if (newVideoId) {
      for (const existing of allSubmissions) {
        const existingVideoId = getVideoId(existing.youtubeLink);
        if (existingVideoId && newVideoId === existingVideoId) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: '❌ This YouTube video is already selected. Please choose a different song.' });
        }
      }
    }

    // ========== CHECK 3: Fingerprint match with database ==========
    if (newVideoId) {
      const quickFp = `yt:${newVideoId}`;
      for (const existing of allSubmissions) {
        if (existing.fingerprint && existing.fingerprint === quickFp) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: '❌ This video is already selected. Please choose a different song.' });
        }
      }
    }

    // ========== CHECK 4: Metadata comparison with DATABASE (same song, different video) ==========
    if (youtubeLink) {
      try {
        console.log('Extracting metadata for:', youtubeLink);
        const newMetadata = await extractSongMetadata(youtubeLink);
        console.log('New metadata:', JSON.stringify(newMetadata, null, 2));
        
        if (newMetadata && newMetadata.normalizedTitle) {
          // Check against existing submissions
          for (const existing of allSubmissions) {
            // Check legacy metadata field
            if (existing.metadata && compareMetadata(newMetadata, existing.metadata)) {
              if (req.file) fs.unlinkSync(req.file.path);
              return res.status(400).json({ 
                error: `❌ Same song detected! "${newMetadata.normalizedTitle}" is already submitted.`
              });
            }
            
            // Check songs array metadata
            if (existing.songs && existing.songs.length > 0) {
              for (const song of existing.songs) {
                if (song.metadata && compareMetadata(newMetadata, song.metadata)) {
                  if (req.file) fs.unlinkSync(req.file.path);
                  return res.status(400).json({ 
                    error: `❌ Same song detected! "${newMetadata.normalizedTitle}" is already submitted.`
                  });
                }
              }
            }
          }
          
          // Also compare by title directly (in case metadata wasn't saved)
          const newTitle = newMetadata.normalizedTitle.toLowerCase();
          for (const existing of allSubmissions) {
            // Check if any existing song has similar title
            if (existing.songName && existing.songName.toLowerCase().includes(newTitle.substring(0, 10))) {
              console.log('Potential match by songName:', existing.songName);
            }
          }
        }
      } catch (e) {
        console.log('Database metadata check error:', e.message);
      }
    }

    // ========== CHECK 5: Compare with user's pending songs (video ID) ==========
    if (newVideoId && userPendingLinks.length > 0) {
      for (const pendingLink of userPendingLinks) {
        const pendingVideoId = getVideoId(pendingLink);
        if (pendingVideoId && newVideoId === pendingVideoId) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: '⚠️ This is the same YouTube video as one you already added!' });
        }
      }
    }

    // ========== CHECK 5: Metadata comparison with pending songs (catches same song, different video) ==========
    if (youtubeLink && userPendingLinks.length > 0) {
      try {
        const newMetadata = await extractSongMetadata(youtubeLink);
        if (newMetadata && newMetadata.extractedSongs?.length > 0) {
          for (const pendingLink of userPendingLinks) {
            const pendingMetadata = await extractSongMetadata(pendingLink);
            if (pendingMetadata && compareMetadata(newMetadata, pendingMetadata)) {
              if (req.file) fs.unlinkSync(req.file.path);
              return res.status(400).json({ 
                error: `⚠️ Same song detected! "${newMetadata.extractedSongs[0]}" is already in your list.`
              });
            }
          }
        }
      } catch (e) {
        // Skip metadata check if it fails - don't block the user
        console.log('Metadata check skipped:', e.message);
      }
    }

    // Generate simple fingerprint for storage
    let fingerprint = null;
    if (newVideoId) fingerprint = `yt:${newVideoId}`;

    // Clean up temp file
    if (req.file) fs.unlinkSync(req.file.path);

    res.json({ 
      available: true, 
      message: 'Song is available!',
      fingerprint
    });
  } catch (error) {
    console.error('Check song error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get submission by ID (for device check)
router.get('/by-id/:id', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUBLIC: Get all submissions for a link (anyone can view)
router.get('/public/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId });
    if (!link) {
      return res.status(404).json({ error: 'Invalid link' });
    }
    
    const submissions = await Submission.find({ dmartCode: link.dmartCode })
      .select('songName department shift gender members youtubeLink songs createdAt')
      .sort('-createdAt');
    
    res.json(submissions);
  } catch (error) {
    console.error('Public submissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update existing submission by ID (edit)
router.put('/edit/:id', upload.single('audioFile'), async (req, res) => {
  try {
    const existing = await Submission.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const { department, shift, gender } = req.body;
    
    let members = [];
    try {
      members = JSON.parse(req.body.members || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid members data' });
    }

    // Parse songs array
    let songs = [];
    try {
      songs = req.body.songs ? JSON.parse(req.body.songs) : [];
    } catch (e) {
      songs = [];
    }

    // Update fields
    existing.department = department || existing.department;
    existing.shift = shift || existing.shift;
    existing.gender = gender || existing.gender;
    existing.members = members.length ? members : existing.members;
    
    // Update songs if provided
    if (songs.length > 0) {
      existing.songs = songs.map(s => ({
        songName: s.songName || '',
        youtubeLink: s.youtubeLink || '',
        fingerprint: s.fingerprint || ''
      }));
      // Also update legacy fields with first song
      existing.songName = songs[0]?.songName || '';
      existing.youtubeLink = songs[0]?.youtubeLink || '';
    }

    await existing.save();
    res.json({ submission: existing, message: 'Submission updated successfully!' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



// Submit songs (public with valid link) - Multiple songs in ONE submission
router.post('/:linkId', upload.single('audioFile'), async (req, res) => {
  try {
    const { linkId } = req.params;
    const link = await Link.findOne({ linkId, isActive: true });
    if (!link) {
      return res.status(404).json({ error: 'Invalid or expired submission link' });
    }

    const { department, shift, gender, deviceId } = req.body;
    const dmartCode = link.dmartCode;
    
    let members = [];
    try {
      members = JSON.parse(req.body.members || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid members data' });
    }

    // Parse songs array (new format with multiple songs)
    let songsData = [];
    try {
      songsData = req.body.songs ? JSON.parse(req.body.songs) : [];
    } catch (e) {
      songsData = [];
    }
    
    if (!department || !shift || !gender) {
      return res.status(400).json({ error: 'Department, shift and gender are required' });
    }

    if (!members.length || !members.every(m => m.trim())) {
      return res.status(400).json({ error: 'At least one member name is required' });
    }

    if (songsData.length === 0) {
      return res.status(400).json({ error: 'Please add at least one song' });
    }

    const allSubmissions = await Submission.find({ dmartCode });

    // Get all existing YouTube links and fingerprints (including from songs array)
    const existingLinks = new Set();
    const existingVideoIds = new Set();
    const existingFingerprints = new Set();

    for (const sub of allSubmissions) {
      // Check legacy single song field
      if (sub.youtubeLink) {
        existingLinks.add(sub.youtubeLink);
        const vid = getVideoId(sub.youtubeLink);
        if (vid) existingVideoIds.add(vid);
      }
      if (sub.fingerprint) existingFingerprints.add(sub.fingerprint);
      
      // Check songs array
      if (sub.songs && sub.songs.length > 0) {
        for (const song of sub.songs) {
          if (song.youtubeLink) {
            existingLinks.add(song.youtubeLink);
            const vid = getVideoId(song.youtubeLink);
            if (vid) existingVideoIds.add(vid);
          }
          if (song.fingerprint) existingFingerprints.add(song.fingerprint);
        }
      }
    }

    // Validate all songs before saving
    const processedSongs = [];
    for (const song of songsData) {
      const youtubeLink = song.youtubeLink;
      
      // Check exact URL
      if (existingLinks.has(youtubeLink)) {
        return res.status(400).json({ error: `❌ Song link already used: ${youtubeLink}` });
      }

      // Check video ID
      const videoId = getVideoId(youtubeLink);
      if (videoId && existingVideoIds.has(videoId)) {
        return res.status(400).json({ error: `❌ This YouTube video is already submitted` });
      }

      // Check fingerprint
      const fingerprint = videoId ? `yt:${videoId}` : null;
      if (fingerprint && existingFingerprints.has(fingerprint)) {
        return res.status(400).json({ error: `❌ This video is already submitted` });
      }

      // Extract metadata
      let metadata = null;
      try {
        metadata = await extractSongMetadata(youtubeLink);
      } catch (e) {
        console.log('Metadata extraction skipped:', e.message);
      }

      processedSongs.push({
        songName: song.songName || '',
        youtubeLink: youtubeLink,
        fingerprint: fingerprint,
        metadata: metadata
      });
    }

    // Create ONE submission with all songs
    const submission = await Submission.create({
      dmartCode,
      department,
      shift,
      gender,
      members,
      deviceId,
      songs: processedSongs,
      // Also set first song in legacy fields for backward compatibility
      songName: processedSongs[0]?.songName || '',
      youtubeLink: processedSongs[0]?.youtubeLink || null,
      fingerprint: processedSongs[0]?.fingerprint || null,
      metadata: processedSongs[0]?.metadata || null,
      linkId
    });

    res.status(201).json({ submission, message: `${processedSongs.length} song(s) submitted successfully!` });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
