/**
 * Upload exercise videos to Cloudinary
 * Run: node server/seeds/uploadToCloudinary.js [folder_path]
 *
 * Default folder: ~/Downloads (looks for .mp4 files matching grok-video-*)
 * Override: node server/seeds/uploadToCloudinary.js /path/to/videos
 *
 * After upload, prints the mapping to paste into exerciseVideos.js
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { v2: cloudinary } = require('cloudinary');

// ── Config ─────────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgmgsqam5',
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in server/.env');
  process.exit(1);
}

// ── Find videos ────────────────────────────────────────────────────────────
const videoDir = process.argv[2] || os.homedir() + '/Downloads';

const videoFiles = fs.readdirSync(videoDir)
  .filter(f => f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm'))
  .map(f => path.join(videoDir, f));

if (videoFiles.length === 0) {
  console.error(`❌ No video files found in: ${videoDir}`);
  process.exit(1);
}

console.log(`\nFound ${videoFiles.length} video(s) in: ${videoDir}`);
console.log('─────────────────────────────────────────\n');

// ── Upload ─────────────────────────────────────────────────────────────────
async function uploadAll() {
  const results = [];

  for (const filePath of videoFiles) {
    const fileName = path.basename(filePath);
    // Create a clean public_id from filename (no spaces, no parens)
    const publicId = 'exercise-videos/' + fileName
      .replace(/\.[^.]+$/, '')           // remove extension
      .replace(/[()]/g, '')              // remove parens
      .replace(/\s+/g, '-')             // spaces → dashes
      .replace(/-+/g, '-')              // collapse multiple dashes
      .trim();

    console.log(`⬆️  Uploading: ${fileName}`);
    console.log(`   public_id: ${publicId}`);

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        public_id:     publicId,
        overwrite:     false,           // skip if already exists
        folder:        '',              // public_id already includes the folder
      });

      const url = result.secure_url;
      console.log(`   ✅ Done: ${url}\n`);
      results.push({ file: fileName, url, public_id: publicId });
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`   ⏭️  Already exists — skipping\n`);
      } else {
        console.error(`   ❌ Error: ${err.message}\n`);
      }
    }
  }

  // ── Print results ──────────────────────────────────────────────────────
  if (results.length > 0) {
    console.log('\n════════════════════════════════════════');
    console.log('Uploaded URLs (add to exerciseVideos.js):');
    console.log('════════════════════════════════════════\n');
    results.forEach(r => {
      console.log(`// ${r.file}`);
      console.log(`'exercise-slug': '${r.url}',`);
      console.log();
    });

    // Also save to a JSON file for easy reference
    const outPath = path.resolve(__dirname, 'cloudinary-uploads.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outPath}`);
  }

  console.log('\nDone!');
}

uploadAll().catch(err => {
  console.error(err);
  process.exit(1);
});
