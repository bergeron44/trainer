/**
 * Pexels Video Seed
 * Searches Pexels for portrait workout videos for each exercise in MongoDB.
 * Run: node server/seeds/seedPexelsVideos.js
 *
 * Options:
 *   --force   Re-fetch even if video_url already exists
 *   --dry     Print what would be updated without saving
 */

const path = require('path');
// server/.env → MONGO_URI, PEXELS_API_KEY
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// root .env → PEXELS_API_KEY (fallback)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const FORCE = process.argv.includes('--force');
const DRY   = process.argv.includes('--dry');

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Pexels helpers ─────────────────────────────────────────────────────────────

/**
 * Search Pexels for a portrait workout video.
 * Returns the best portrait HD MP4 link, or null if none found.
 */
async function searchPexelsVideo(exerciseName) {
  const query = encodeURIComponent(`${exerciseName} gym workout exercise`);
  const url = `https://api.pexels.com/videos/search?query=${query}&orientation=portrait&size=medium&per_page=3`;

  const res = await fetch(url, {
    headers: { Authorization: PEXELS_KEY },
  });

  if (res.status === 429) throw new Error('Pexels rate limit (429)');
  if (!res.ok) throw new Error(`Pexels ${res.status}`);

  const data = await res.json();

  for (const video of data.videos ?? []) {
    const files = video.video_files ?? [];

    // Must be portrait (height > width) and MP4
    const portraitFiles = files.filter(
      f => f.file_type === 'video/mp4' && f.height > f.width,
    );

    // Sort: prefer HD (720p+) then highest height
    portraitFiles.sort((a, b) => {
      const aHd = a.height >= 720 ? 1 : 0;
      const bHd = b.height >= 720 ? 1 : 0;
      if (aHd !== bHd) return bHd - aHd;
      return b.height - a.height;
    });

    if (portraitFiles[0]) return portraitFiles[0].link;
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function seed() {
  if (!PEXELS_KEY) {
    console.error('❌ PEXELS_API_KEY not found in .env');
    process.exit(1);
  }

  console.log(`Pexels key: ${PEXELS_KEY.slice(0, 8)}...`);
  if (DRY)   console.log('DRY RUN — no changes will be saved\n');
  if (FORCE) console.log('FORCE mode — re-fetching all videos\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const exercises = await Exercise.find({}).sort({ name: 1 });
  console.log(`Found ${exercises.length} exercises\n`);

  let found = 0, skipped = 0, missing = 0;

  for (const ex of exercises) {
    // Skip exercises that already have a video (unless --force)
    if (ex.video_url && !FORCE) {
      console.log(`  ⏭️  ${ex.name}`);
      skipped++;
      continue;
    }

    // Pexels free plan: 200 req/hour → ~18 sec/req needed for safety.
    // 300ms is fine for bursts; add more if you hit 429s.
    await delay(300);

    try {
      const videoUrl = await searchPexelsVideo(ex.name);

      if (videoUrl) {
        if (!DRY) {
          await Exercise.findByIdAndUpdate(ex._id, { video_url: videoUrl });
        }
        console.log(`  ✅ ${ex.name}`);
        found++;
      } else {
        console.log(`  ⚠️  ${ex.name} — no portrait video found`);
        missing++;
      }
    } catch (e) {
      console.log(`  ❌ ${ex.name} — ${e.message}`);
      missing++;

      // Back off on rate limit
      if (e.message.includes('429')) {
        console.log('     ⏸  Rate limited — waiting 60 s...');
        await delay(60_000);
      }
    }
  }

  console.log('\n═════════════════════════════════════');
  console.log(`✅ Videos found:  ${found + skipped} (${skipped} already existed)`);
  console.log(`⚠️  No video:     ${missing}`);
  console.log('═════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
