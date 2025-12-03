/**
 * Script to update existing submissions with metadata
 * Run: node server/updateMetadata.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Submission = require('./models/Submission');
const { extractSongMetadata, checkDependencies } = require('./utils/fingerprint');

async function updateAllSubmissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if yt-dlp is available
    const deps = checkDependencies();
    console.log('Dependencies:', deps);
    if (!deps.ytdlp) {
      console.log('ERROR: yt-dlp not found! Make sure it is in PATH.');
      process.exit(1);
    }

    // Find ALL submissions (not just those with youtubeLink)
    const allSubs = await Submission.find({});
    console.log(`Total submissions in DB: ${allSubs.length}`);
    
    const submissions = await Submission.find({ youtubeLink: { $exists: true, $ne: null, $ne: '' } });
    console.log(`Found ${submissions.length} submissions with YouTube links`);

    let updated = 0;
    let failed = 0;

    for (const sub of submissions) {
      if (sub.metadata && sub.metadata.title) {
        console.log(`Skipping ${sub.songName} - already has metadata`);
        continue;
      }

      console.log(`\nProcessing: ${sub.songName}`);
      console.log(`  URL: ${sub.youtubeLink}`);

      try {
        const metadata = await extractSongMetadata(sub.youtubeLink);
        
        if (metadata) {
          sub.metadata = metadata;
          await sub.save();
          console.log(`  ✅ Updated with metadata:`);
          console.log(`     Title: ${metadata.title}`);
          console.log(`     Extracted songs: ${metadata.extractedSongs?.join(', ') || 'none'}`);
          updated++;
        } else {
          console.log(`  ⚠️ No metadata extracted`);
          failed++;
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n========== DONE ==========`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${submissions.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAllSubmissions();
