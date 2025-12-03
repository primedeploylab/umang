// Script to update all existing submissions with metadata
const mongoose = require('mongoose');
require('dotenv').config();

const Submission = require('./models/Submission');
const { extractSongMetadata } = require('./utils/fingerprint');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/dmart-umang';

async function updateAllMetadata() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const submissions = await Submission.find({});
    console.log(`Found ${submissions.length} submissions to update`);

    let updated = 0;
    let failed = 0;

    for (const sub of submissions) {
      try {
        // Update legacy single song (force update)
        if (sub.youtubeLink) {
          console.log(`Updating: ${sub.youtubeLink}`);
          const metadata = await extractSongMetadata(sub.youtubeLink);
          if (metadata) {
            sub.metadata = metadata;
            await sub.save();
            console.log(`  ✓ Metadata: ${metadata.normalizedTitle}`);
            updated++;
          }
        }

        // Update songs array
        if (sub.songs && sub.songs.length > 0) {
          let songUpdated = false;
          for (let i = 0; i < sub.songs.length; i++) {
            const song = sub.songs[i];
            if (song.youtubeLink) {
              console.log(`Updating song ${i + 1}: ${song.youtubeLink}`);
              const metadata = await extractSongMetadata(song.youtubeLink);
              if (metadata) {
                sub.songs[i].metadata = metadata;
                songUpdated = true;
                console.log(`  ✓ Metadata: ${metadata.normalizedTitle}`);
              }
            }
          }
          if (songUpdated) {
            await sub.save();
            updated++;
          }
        }
      } catch (e) {
        console.log(`  ✗ Error: ${e.message}`);
        failed++;
      }
    }

    console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAllMetadata();
