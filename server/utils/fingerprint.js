const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Temp directory for audio processing
const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Extract YouTube video ID from various URL formats
 */
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s?#]+)/,
    /youtu\.be\/([^&\s?#]+)/,
    /youtube\.com\/embed\/([^&\s?#]+)/,
    /youtube\.com\/v\/([^&\s?#]+)/,
    /youtube\.com\/shorts\/([^&\s?#]+)/,
    /music\.youtube\.com\/watch\?v=([^&\s?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

/**
 * Download audio from YouTube using yt-dlp (FREE, UNLIMITED)
 * Returns path to downloaded audio file
 */
const downloadAudio = (url) => {
  return new Promise((resolve) => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      resolve(null);
      return;
    }

    const outputPath = path.join(TEMP_DIR, `${videoId}.mp3`);
    
    // If already downloaded, return existing file
    if (fs.existsSync(outputPath)) {
      resolve(outputPath);
      return;
    }

    try {
      // Use yt-dlp to download audio only (first 30 seconds is enough for fingerprint)
      const cmd = `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${outputPath}" --no-playlist --download-sections "*0:00-0:30" "${url}"`;
      console.log('Downloading audio:', cmd);
      
      execSync(cmd, { 
        timeout: 60000, 
        stdio: 'pipe',
        windowsHide: true 
      });
      
      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        // Try without section download (some videos don't support it)
        const cmd2 = `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${outputPath}" --no-playlist "${url}"`;
        execSync(cmd2, { timeout: 120000, stdio: 'pipe', windowsHide: true });
        resolve(fs.existsSync(outputPath) ? outputPath : null);
      }
    } catch (error) {
      console.log('yt-dlp error:', error.message);
      resolve(null);
    }
  });
};

/**
 * Generate audio fingerprint using fpcalc (Chromaprint) - FREE, UNLIMITED, LOCAL
 * This creates a unique fingerprint based on the actual audio content
 */
const generateAudioFingerprint = (audioPath) => {
  return new Promise((resolve) => {
    if (!audioPath || !fs.existsSync(audioPath)) {
      resolve(null);
      return;
    }

    try {
      // Use fpcalc (Chromaprint) to generate fingerprint
      const result = execSync(`fpcalc -raw -length 30 "${audioPath}"`, {
        timeout: 30000,
        encoding: 'utf8',
        windowsHide: true
      });

      // Parse fpcalc output
      const lines = result.split('\n');
      let fingerprint = null;
      
      for (const line of lines) {
        if (line.startsWith('FINGERPRINT=')) {
          fingerprint = line.substring(12).trim();
          break;
        }
      }

      if (fingerprint) {
        // Create a shorter hash for storage (full fingerprint is too long)
        const hash = crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
        resolve(hash);
      } else {
        resolve(null);
      }
    } catch (error) {
      console.log('fpcalc error:', error.message);
      resolve(null);
    }
  });
};

/**
 * Compare two audio fingerprints for similarity
 * Returns true if they match (same song)
 */
const compareAudioFingerprints = (fp1, fp2) => {
  if (!fp1 || !fp2) return false;
  return fp1 === fp2;
};

/**
 * Fetch YouTube video details (title, description, hashtags) using yt-dlp
 * This works for Shorts too and gets the full description
 */
const getYouTubeVideoDetails = (url) => {
  return new Promise((resolve) => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      resolve(null);
      return;
    }

    try {
      // Use yt-dlp to get video metadata (JSON format)
      const result = execSync(`yt-dlp --dump-json --no-download "${url}"`, {
        timeout: 30000,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      });

      const data = JSON.parse(result);
      resolve({
        title: data.title || '',
        description: data.description || '',
        tags: data.tags || [],
        uploader: data.uploader || '',
        channel: data.channel || ''
      });
    } catch (error) {
      console.log('yt-dlp metadata error:', error.message);
      resolve(null);
    }
  });
};

/**
 * Extract song names from YouTube description and hashtags
 * Common patterns in Shorts: #songname, Song: xyz, 🎵 xyz, etc.
 */
const extractSongFromMetadata = (details) => {
  if (!details) return [];
  
  const songs = new Set();
  const text = `${details.title} ${details.description}`.toLowerCase();
  
  // Common Hindi/Bollywood song patterns
  const patterns = [
    // Hashtag patterns
    /#([a-zA-Z0-9\u0900-\u097F]+song)/gi,
    /#([a-zA-Z0-9\u0900-\u097F]+)/gi,
    // "Song: xyz" or "Song - xyz"
    /song[:\-\s]+([^\n\r,]+)/gi,
    // "🎵 xyz" or "🎶 xyz"
    /[🎵🎶]\s*([^\n\r,]+)/gi,
    // "Track: xyz"
    /track[:\-\s]+([^\n\r,]+)/gi,
    // "Music: xyz"
    /music[:\-\s]+([^\n\r,]+)/gi,
    // "Original: xyz"
    /original[:\-\s]+([^\n\r,]+)/gi,
  ];

  // Extract from patterns
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 2 && match[1].length < 50) {
        songs.add(match[1].trim().toLowerCase());
      }
    }
  }

  // Add tags as potential song names
  if (details.tags) {
    for (const tag of details.tags) {
      if (tag && tag.length > 2 && tag.length < 50) {
        songs.add(tag.toLowerCase());
      }
    }
  }

  return Array.from(songs);
};

/**
 * Normalize song name for comparison
 */
const normalizeSongName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(official.*?\)/gi, '')
    .replace(/\(lyric.*?\)/gi, '')
    .replace(/\(audio.*?\)/gi, '')
    .replace(/\(video.*?\)/gi, '')
    .replace(/\(full.*?\)/gi, '')
    .replace(/official/gi, '')
    .replace(/lyric/gi, '')
    .replace(/video/gi, '')
    .replace(/audio/gi, '')
    .replace(/[|•\-–—:]/g, ' ')
    .replace(/[^\w\s\u0900-\u097F]/g, '') // Keep Hindi characters
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if two song names are similar
 */
const areSongNamesSimilar = (name1, name2) => {
  const n1 = normalizeSongName(name1);
  const n2 = normalizeSongName(name2);
  
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  
  // One contains the other
  if (n1.length > 3 && n2.length > 3) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  
  // Word-based similarity
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = commonWords.length / Math.min(words1.length, words2.length);
  
  return similarity >= 0.5; // 50% word match
};

/**
 * Check if yt-dlp and fpcalc are installed
 */
const checkDependencies = () => {
  const deps = { ytdlp: false, fpcalc: false };
  
  try {
    execSync('yt-dlp --version', { stdio: 'pipe', windowsHide: true });
    deps.ytdlp = true;
  } catch (e) {}
  
  try {
    execSync('fpcalc -version', { stdio: 'pipe', windowsHide: true });
    deps.fpcalc = true;
  } catch (e) {}
  
  return deps;
};

/**
 * Generate fingerprint for a song - MAIN FUNCTION
 * Returns { fingerprint, metadata } for better duplicate detection
 */
const generateFingerprint = async (filePath, songUrl = null) => {
  const deps = checkDependencies();
  console.log('Dependencies:', deps);

  if (songUrl) {
    console.log('Processing URL:', songUrl);
    const videoId = getYouTubeVideoId(songUrl);
    console.log('Video ID:', videoId);

    // STEP 1: Try audio fingerprinting if tools are available
    if (deps.ytdlp && deps.fpcalc) {
      console.log('Using audio fingerprinting (yt-dlp + fpcalc)...');
      const audioPath = await downloadAudio(songUrl);
      
      if (audioPath) {
        const audioFp = await generateAudioFingerprint(audioPath);
        if (audioFp) {
          console.log('Audio fingerprint generated:', audioFp);
          try { fs.unlinkSync(audioPath); } catch (e) {}
          return `audio:${audioFp}`;
        }
      }
    }

    // STEP 2: Fallback to video ID
    if (videoId) {
      console.log('Fallback: Using video ID');
      return `yt:${videoId}`;
    }

    // STEP 3: URL hash fallback
    return `url:${crypto.createHash('md5').update(songUrl).digest('hex')}`;
  }

  // For uploaded audio files
  if (filePath && fs.existsSync(filePath)) {
    if (deps.fpcalc) {
      const audioFp = await generateAudioFingerprint(filePath);
      if (audioFp) {
        return `audio:${audioFp}`;
      }
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    return `file:${hash}`;
  }

  return null;
};

/**
 * FAST: Get YouTube video title using oEmbed API (no yt-dlp needed)
 * This is instant and doesn't require any external tools
 */
const getYouTubeTitleFast = (url) => {
  return new Promise((resolve) => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      resolve(null);
      return;
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    https.get(oembedUrl, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.title || null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
    
    // Timeout after 5 seconds
    setTimeout(() => resolve(null), 5000);
  });
};

/**
 * Extract song metadata from YouTube URL (title, description, hashtags)
 * FAST VERSION: Uses oEmbed API first (instant), falls back to yt-dlp only if needed
 */
const extractSongMetadata = async (songUrl) => {
  try {
    // FAST: Try oEmbed API first (instant, no external tools)
    const fastTitle = await getYouTubeTitleFast(songUrl);
    
    if (fastTitle) {
      const extractedSongs = [];
      const normalizedTitle = normalizeSongName(fastTitle);
      
      // Extract song names from title
      const titleLower = fastTitle.toLowerCase();
      
      // Common patterns in titles
      const patterns = [
        /^(.+?)\s*[-|•]\s*/i,  // "Song Name - Artist" or "Song Name | xyz"
        /^(.+?)\s*\(/i,        // "Song Name (Official Video)"
        /[🎵🎶]\s*(.+)/i,      // "🎵 Song Name"
      ];
      
      for (const pattern of patterns) {
        const match = fastTitle.match(pattern);
        if (match && match[1] && match[1].length > 2) {
          extractedSongs.push(normalizeSongName(match[1]));
        }
      }
      
      // Add normalized title as a song name
      if (normalizedTitle && normalizedTitle.length > 2) {
        extractedSongs.push(normalizedTitle);
      }
      
      return {
        title: fastTitle,
        description: '',
        tags: [],
        extractedSongs: [...new Set(extractedSongs)],
        normalizedTitle: normalizedTitle
      };
    }

    // SLOW FALLBACK: Use yt-dlp if oEmbed fails
    const deps = checkDependencies();
    if (!deps.ytdlp) return null;

    const details = await getYouTubeVideoDetails(songUrl);
    if (!details) return null;

    const extractedSongs = extractSongFromMetadata(details);
    
    return {
      title: details.title,
      description: details.description?.substring(0, 500),
      tags: details.tags?.slice(0, 20),
      extractedSongs: extractedSongs,
      normalizedTitle: normalizeSongName(details.title)
    };
  } catch (e) {
    console.log('Metadata extraction error:', e.message);
    return null;
  }
};

/**
 * Compare two fingerprints
 */
const compareFingerprints = (fp1, fp2) => {
  if (!fp1 || !fp2) return false;
  if (fp1 === fp2) return true;

  const parse = (fp) => {
    const idx = fp.indexOf(':');
    if (idx === -1) return { type: 'unknown', value: fp };
    return { type: fp.substring(0, idx), value: fp.substring(idx + 1) };
  };

  const f1 = parse(fp1);
  const f2 = parse(fp2);

  // Same type and value = match
  if (f1.type === f2.type && f1.value === f2.value) return true;

  // Audio fingerprints - exact match required
  if (f1.type === 'audio' && f2.type === 'audio') {
    return f1.value === f2.value;
  }

  // Same YouTube video ID
  if (f1.type === 'yt' && f2.type === 'yt') {
    return f1.value === f2.value;
  }

  return false;
};

/**
 * Identify song from URL (basic info)
 */
const identifySongFromUrl = async (url) => {
  const videoId = getYouTubeVideoId(url);
  return {
    identified: !!videoId,
    videoId: videoId,
    source: 'youtube'
  };
};

/**
 * Clean up old temp files
 */
const cleanupTempFiles = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stat = fs.statSync(filePath);
      // Delete files older than 1 hour
      if (now - stat.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (e) {}
};

// Clean up temp files periodically
setInterval(cleanupTempFiles, 3600000);

/**
 * Compare song metadata to detect duplicates
 * Checks title, description, tags for matching song names
 */
const compareMetadata = (newMeta, existingMeta) => {
  if (!newMeta || !existingMeta) return false;

  // Compare normalized titles
  if (newMeta.normalizedTitle && existingMeta.normalizedTitle) {
    if (areSongNamesSimilar(newMeta.normalizedTitle, existingMeta.normalizedTitle)) {
      return true;
    }
  }

  // Compare extracted songs from new with existing
  if (newMeta.extractedSongs && existingMeta.extractedSongs) {
    for (const newSong of newMeta.extractedSongs) {
      for (const existingSong of existingMeta.extractedSongs) {
        if (areSongNamesSimilar(newSong, existingSong)) {
          return true;
        }
      }
    }
  }

  // Compare new extracted songs with existing title
  if (newMeta.extractedSongs && existingMeta.normalizedTitle) {
    for (const newSong of newMeta.extractedSongs) {
      if (areSongNamesSimilar(newSong, existingMeta.normalizedTitle)) {
        return true;
      }
    }
  }

  // Compare existing extracted songs with new title
  if (existingMeta.extractedSongs && newMeta.normalizedTitle) {
    for (const existingSong of existingMeta.extractedSongs) {
      if (areSongNamesSimilar(existingSong, newMeta.normalizedTitle)) {
        return true;
      }
    }
  }

  // Compare tags
  if (newMeta.tags && existingMeta.tags) {
    const newTags = new Set(newMeta.tags.map(t => t.toLowerCase()));
    const existingTags = new Set(existingMeta.tags.map(t => t.toLowerCase()));
    const commonTags = [...newTags].filter(t => existingTags.has(t) && t.length > 3);
    if (commonTags.length >= 3) {
      return true; // 3+ common tags likely same song
    }
  }

  return false;
};

module.exports = {
  generateFingerprint,
  compareFingerprints,
  identifySongFromUrl,
  getYouTubeVideoId,
  checkDependencies,
  downloadAudio,
  generateAudioFingerprint,
  extractSongMetadata,
  compareMetadata,
  getYouTubeVideoDetails,
  extractSongFromMetadata,
  normalizeSongName,
  areSongNamesSimilar
};
