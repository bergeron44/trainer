/**
 * Migration: populate Exercise collection with
 *   - video_url       (Cloudinary, men)
 *   - video_url_women (Cloudinary, women)
 *   - alternatives[]  (exercise substitutions)
 *   - movement_type   (push | pull | legs | core | cardio | full_body)
 *
 * Run: node server/seeds/updateExercisesWithVideos.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');

// ── Cloudinary base ──────────────────────────────────────────────────────────
const CDN = 'https://res.cloudinary.com/dgmgsqam5/video/upload';

// ── Full Cloudinary ID → slug mapping (copied from exerciseVideos.js) ────────
const CLOUDINARY_MAP = {
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_1_cum1bd':  'bench-press',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_2_a41ksr':  'dips',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_3_k7gjeo':  'barbell-row',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_4_c9jpvk':  'lat-pulldown',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_4_kbckec':  'seated-cable-row',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_5_d64qe9':  'face-pull',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_5_tuwmgb':  'squat',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_6_wkg5kk':  'leg-press',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_6_zrx6ob':  'deadlift',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_7_wlbe9y':  'overhead-press',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_8_efiayz':  'front-raises',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_8_rwjxyt':  'reverse-fly',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_9_gsyqlv':  'leg-extension',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_10_ker2ug': 'leg-extension',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_11_ji9xqz': 'hammer-curl',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_12_emmgwo': 'overhead-press-sit',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_13_ujwhqy': 'bench-press',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_14_rricr9': 'front-leaning-rest',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_17_vqzs1a': 'burpees',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_18_kim2us': 'cable-crunches',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_1_wlljue':  'cable-chest-fly',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_2_oy16k1':  'pull-ups',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_3_wtv4ye':  'lat-pulldown',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_4_vsbxqz':  'deadlift',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_5_qu5jwg':  'squat',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_6_cnhmrj':  'deadlift-alt',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_7_gykbnt':  'leg-curl',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_8_b1c0nc':  'calf-raises',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_9_fyymfm':  'lateral-raises',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_10_jwtgv2': 'front-raises',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_11_fenp0x': 'barbell-bicep-curl',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_12_q8rowm': 'biceps-curl-machine',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_13_d5rmyb': 'dips',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_14_w1tu8z': 'crunches',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_15_dyd62r': 'russian-twists',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_16_wjhmde': 'russian-twists',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_18_oy0v8j': 'jumping-jacks',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_ozxwr9':    'incline-dumbbell-press',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_2_ji6fxk':  'treadmill-running-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_3_mdqyod':  'jumping-jacks-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_7_vce6ed':  'burpees-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_9_gkzwqb':  'russian-twists-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_10_hrji07': 'hanging-leg-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_11_aoimdd': 'crunches-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_12_srffnd': 'tricep-dips-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_13_s388ks': 'barbell-bicep-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_14_tlxu6s': 'bench-press-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_15_mmg3lt': 'tricep-pushdown-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_16_o5b13o': 'hammer-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_18_hfriws': 'overhead-press-sit-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_19_wdlklx': 'lateral-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_21_mdtcbo': 'front-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_22_lwxpnd': 'overhead-press-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_23_oukhyd': 'pull-ups-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_pcgn1w':    'incline-dumbbell-press-women',
  'cable_tricep_pushdown_women_bw83wi':         'tricep-pushdown-women',
  'deep_barbell_back_squat_h9zvva':             'squat',
  'dumbbell_hammer_curls_women_ocrujz':         'hammer-curl-women',
  'leg_press_machine_women_btbekq':             'leg-press-women',
  'lying-leg-curls-women_z46heo':              'leg-curl-women',
  'preacher_curls_women_xl6qgr':               'biceps-curl-machine-women',
  'romanian_deadlift_women_tag3go':             'deadlift-alt-women',
  'seated_leg_extensions_women_flqftj':         'leg-extension-women',
  'standing_calf_raises_women_odgktx':          'calf-raises-women',
  'walking_lunges_with_dumbbells_women_ka7aaw': 'lunges-women',
};

// Build slug → URL (first-match wins)
const VIDEOS = {};
for (const [id, slug] of Object.entries(CLOUDINARY_MAP)) {
  if (!VIDEOS[slug]) VIDEOS[slug] = `${CDN}/${id}.mp4`;
}

// ── Exercise name → slug (for video URL lookup) ───────────────────────────
const NAME_TO_SLUG = {
  'Bench Press': 'bench-press',          'Incline Bench Press': 'bench-press',
  'Incline Dumbbell Press': 'incline-dumbbell-press', 'Dumbbell Press': 'incline-dumbbell-press',
  'Floor Press': 'bench-press',          'Machine Chest Press': 'bench-press',
  'Dumbbell Fly': 'incline-dumbbell-press', 'Cable Chest Fly': 'cable-chest-fly',
  'Low Cable Fly': 'cable-chest-fly',    'Pec Deck': 'cable-chest-fly',
  'Push-Up': 'push-ups',                'Incline Push-Up': 'push-ups',
  'Pike Push-Up': 'push-ups',           'Dips': 'dips',
  'Close Grip Bench Press': 'bench-press',
  'Pull-Up': 'pull-ups',                'Chin-Up': 'pull-ups',
  'Assisted Pull-Up': 'pull-ups',       'Barbell Row': 'barbell-row',
  'Pendlay Row': 'barbell-row',         'T-Bar Row': 'barbell-row',
  'Dumbbell Row': 'barbell-row',        'Lat Pulldown': 'lat-pulldown',
  'Seated Cable Row': 'seated-cable-row', 'Deadlift': 'deadlift',
  'Face Pull': 'face-pull',             'Rear Delt Fly': 'reverse-fly',
  'Reverse Pec Deck': 'reverse-fly',    'Band Pull Apart': 'face-pull',
  'Squat': 'squat',                     'Goblet Squat': 'squat',
  'Air Squat': 'squat',                 'Hack Squat': 'leg-press',
  'Leg Press': 'leg-press',             'Romanian Deadlift': 'deadlift-alt',
  'Walking Lunge': 'lunges-women',      'Reverse Lunge': 'squat',
  'Bulgarian Split Squat': 'squat',     'Split Squat': 'squat',
  'Step Up': 'leg-press',               'Leg Curl': 'leg-curl',
  'Leg Extension': 'leg-extension',     'Calf Raise': 'calf-raises',
  'Overhead Press': 'overhead-press',   'Dumbbell Shoulder Press': 'overhead-press-sit',
  'Arnold Press': 'overhead-press-sit', 'Landmine Press': 'overhead-press',
  'Lateral Raise': 'lateral-raises',   'Cable Lateral Raise': 'lateral-raises',
  'Front Raise': 'front-raises',        'Upright Row': 'barbell-row',
  'Reverse Fly': 'reverse-fly',
  'Barbell Curl': 'barbell-bicep-curl', 'Dumbbell Curl': 'hammer-curl',
  'Hammer Curl': 'hammer-curl',         'Preacher Curl': 'biceps-curl-machine',
  'Cable Curl': 'biceps-curl-machine',
  'Tricep Pushdown': 'tricep-pushdown', 'Skull Crusher': 'skull-crushers',
  'Overhead Tricep Extension': 'tricep-pushdown', 'Tricep Dips': 'dips',
  'Plank': 'plank',                     'Crunch': 'crunches',
  'Hanging Leg Raise': 'hanging-leg-raises', 'Russian Twist': 'russian-twists',
  'Cable Crunch': 'cable-crunches',     'Dead Bug': 'front-leaning-rest',
  'Bird Dog': 'front-leaning-rest',     'Hollow Hold': 'front-leaning-rest',
  'Mountain Climber': 'mountain-climbers',
  'Power Clean': 'deadlift',            'Hang Clean': 'deadlift',
  'High Pull': 'deadlift',              'Kettlebell Swing': 'deadlift-alt',
  'Medicine Ball Slam': 'burpees',
  'Burpee': 'burpees',                  'Box Jump': 'burpees',
  'Jump Squat': 'jumping-jacks',        'Tuck Jump': 'jumping-jacks',
  'Broad Jump': 'jumping-jacks',        'Depth Jump': 'burpees',
  'Jumping Jack': 'jumping-jacks',      'High Knees': 'mountain-climbers',
  'Battle Ropes': 'burpees',            'Jump Rope': 'jumping-jacks',
};

// ── movement_type per exercise name ──────────────────────────────────────────
const MOVEMENT_TYPE = {
  // push
  'Bench Press': 'push', 'Incline Bench Press': 'push', 'Incline Dumbbell Press': 'push',
  'Dumbbell Press': 'push', 'Floor Press': 'push', 'Machine Chest Press': 'push',
  'Dumbbell Fly': 'push', 'Cable Chest Fly': 'push', 'Low Cable Fly': 'push',
  'Pec Deck': 'push', 'Push-Up': 'push', 'Incline Push-Up': 'push', 'Pike Push-Up': 'push',
  'Dips': 'push', 'Close Grip Bench Press': 'push',
  'Overhead Press': 'push', 'Dumbbell Shoulder Press': 'push', 'Arnold Press': 'push',
  'Landmine Press': 'push', 'Lateral Raise': 'push', 'Cable Lateral Raise': 'push',
  'Front Raise': 'push', 'Upright Row': 'push',
  'Tricep Pushdown': 'push', 'Skull Crusher': 'push',
  'Overhead Tricep Extension': 'push', 'Tricep Dips': 'push',
  // pull
  'Pull-Up': 'pull', 'Chin-Up': 'pull', 'Assisted Pull-Up': 'pull',
  'Barbell Row': 'pull', 'Pendlay Row': 'pull', 'T-Bar Row': 'pull',
  'Dumbbell Row': 'pull', 'Lat Pulldown': 'pull', 'Seated Cable Row': 'pull',
  'Deadlift': 'pull', 'Face Pull': 'pull', 'Rear Delt Fly': 'pull',
  'Reverse Pec Deck': 'pull', 'Band Pull Apart': 'pull', 'Reverse Fly': 'pull',
  'Barbell Curl': 'pull', 'Dumbbell Curl': 'pull', 'Hammer Curl': 'pull',
  'Preacher Curl': 'pull', 'Cable Curl': 'pull',
  // legs
  'Squat': 'legs', 'Goblet Squat': 'legs', 'Air Squat': 'legs', 'Hack Squat': 'legs',
  'Leg Press': 'legs', 'Romanian Deadlift': 'legs', 'Walking Lunge': 'legs',
  'Reverse Lunge': 'legs', 'Bulgarian Split Squat': 'legs', 'Split Squat': 'legs',
  'Step Up': 'legs', 'Leg Curl': 'legs', 'Leg Extension': 'legs', 'Calf Raise': 'legs',
  // core
  'Plank': 'core', 'Crunch': 'core', 'Hanging Leg Raise': 'core',
  'Russian Twist': 'core', 'Cable Crunch': 'core', 'Dead Bug': 'core',
  'Bird Dog': 'core', 'Hollow Hold': 'core', 'Mountain Climber': 'core',
  // cardio
  'Burpee': 'cardio', 'Box Jump': 'cardio', 'Jump Squat': 'cardio', 'Tuck Jump': 'cardio',
  'Broad Jump': 'cardio', 'Depth Jump': 'cardio', 'Jumping Jack': 'cardio',
  'High Knees': 'cardio', 'Battle Ropes': 'cardio', 'Jump Rope': 'cardio',
  // full_body
  'Power Clean': 'full_body', 'Hang Clean': 'full_body', 'High Pull': 'full_body',
  'Kettlebell Swing': 'full_body', 'Medicine Ball Slam': 'full_body',
};

// ── Alternative exercises ─────────────────────────────────────────────────────
const ALTERNATIVES = {
  'Bench Press': ['Dumbbell Press', 'Floor Press', 'Push-Up', 'Machine Chest Press'],
  'Incline Bench Press': ['Incline Dumbbell Press', 'Low Cable Fly', 'Incline Push-Up'],
  'Incline Dumbbell Press': ['Incline Bench Press', 'Low Cable Fly', 'Incline Push-Up'],
  'Dumbbell Press': ['Bench Press', 'Floor Press', 'Machine Chest Press'],
  'Cable Chest Fly': ['Dumbbell Fly', 'Pec Deck', 'Dumbbell Press'],
  'Dumbbell Fly': ['Cable Chest Fly', 'Pec Deck', 'Incline Dumbbell Press'],
  'Push-Up': ['Incline Push-Up', 'Pike Push-Up', 'Dips'],
  'Dips': ['Skull Crusher', 'Tricep Pushdown', 'Close Grip Bench Press'],
  'Tricep Dips': ['Skull Crusher', 'Tricep Pushdown', 'Close Grip Bench Press'],
  'Pull-Up': ['Lat Pulldown', 'Assisted Pull-Up', 'Chin-Up'],
  'Chin-Up': ['Pull-Up', 'Lat Pulldown', 'Assisted Pull-Up'],
  'Barbell Row': ['Seated Cable Row', 'Pendlay Row', 'T-Bar Row'],
  'Dumbbell Row': ['Seated Cable Row', 'Barbell Row', 'T-Bar Row'],
  'Lat Pulldown': ['Pull-Up', 'Assisted Pull-Up', 'Chin-Up'],
  'Seated Cable Row': ['Barbell Row', 'Dumbbell Row', 'T-Bar Row'],
  'Face Pull': ['Rear Delt Fly', 'Band Pull Apart', 'Reverse Pec Deck'],
  'Deadlift': ['Romanian Deadlift', 'Barbell Row', 'Kettlebell Swing'],
  'Romanian Deadlift': ['Leg Curl', 'Deadlift', 'Bulgarian Split Squat'],
  'Squat': ['Goblet Squat', 'Leg Press', 'Hack Squat'],
  'Goblet Squat': ['Air Squat', 'Leg Press', 'Split Squat'],
  'Walking Lunge': ['Reverse Lunge', 'Bulgarian Split Squat', 'Step Up'],
  'Leg Press': ['Squat', 'Hack Squat', 'Goblet Squat'],
  'Leg Curl': ['Romanian Deadlift', 'Bulgarian Split Squat', 'Step Up'],
  'Leg Extension': ['Squat', 'Leg Press', 'Hack Squat'],
  'Calf Raise': ['Step Up', 'Walking Lunge', 'Jump Rope'],
  'Overhead Press': ['Arnold Press', 'Landmine Press', 'Dumbbell Shoulder Press'],
  'Dumbbell Shoulder Press': ['Overhead Press', 'Arnold Press', 'Landmine Press'],
  'Arnold Press': ['Overhead Press', 'Dumbbell Shoulder Press', 'Landmine Press'],
  'Lateral Raise': ['Cable Lateral Raise', 'Upright Row', 'Reverse Fly'],
  'Cable Lateral Raise': ['Lateral Raise', 'Upright Row', 'Front Raise'],
  'Front Raise': ['Lateral Raise', 'Overhead Press', 'Upright Row'],
  'Reverse Fly': ['Face Pull', 'Band Pull Apart', 'Rear Delt Fly'],
  'Barbell Curl': ['Dumbbell Curl', 'Cable Curl', 'Preacher Curl'],
  'Dumbbell Curl': ['Barbell Curl', 'Hammer Curl', 'Cable Curl'],
  'Hammer Curl': ['Barbell Curl', 'Dumbbell Curl', 'Cable Curl'],
  'Preacher Curl': ['Barbell Curl', 'Dumbbell Curl', 'Cable Curl'],
  'Cable Curl': ['Barbell Curl', 'Dumbbell Curl', 'Preacher Curl'],
  'Tricep Pushdown': ['Skull Crusher', 'Overhead Tricep Extension', 'Tricep Dips'],
  'Skull Crusher': ['Tricep Pushdown', 'Overhead Tricep Extension', 'Close Grip Bench Press'],
  'Overhead Tricep Extension': ['Skull Crusher', 'Tricep Pushdown', 'Tricep Dips'],
  'Plank': ['Dead Bug', 'Bird Dog', 'Hollow Hold'],
  'Crunch': ['Cable Crunch', 'Hanging Leg Raise', 'Russian Twist'],
  'Hanging Leg Raise': ['Crunch', 'Cable Crunch', 'Russian Twist'],
  'Russian Twist': ['Crunch', 'Cable Crunch', 'Hanging Leg Raise'],
  'Cable Crunch': ['Crunch', 'Hanging Leg Raise', 'Russian Twist'],
  'Power Clean': ['Hang Clean', 'High Pull', 'Kettlebell Swing'],
  'Hang Clean': ['Power Clean', 'High Pull', 'Kettlebell Swing'],
  'Box Jump': ['Jump Squat', 'Depth Jump', 'Tuck Jump'],
  'Medicine Ball Slam': ['Battle Ropes', 'Kettlebell Swing', 'Burpee'],
  'Broad Jump': ['Box Jump', 'Tuck Jump', 'Jump Squat'],
  'Battle Ropes': ['Jumping Jack', 'Mountain Climber', 'High Knees'],
  'Burpee': ['Box Jump', 'Jump Squat', 'Mountain Climber'],
  'Jumping Jack': ['High Knees', 'Jump Rope', 'Mountain Climber'],
};

// ── Main migration ────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const exercises = await Exercise.find({});
  console.log(`Found ${exercises.length} exercises to update\n`);

  let updated = 0, noVideo = 0;

  for (const ex of exercises) {
    const slug     = NAME_TO_SLUG[ex.name];
    const videoUrl      = slug ? (VIDEOS[slug] || null) : null;
    const videoUrlWomen = slug ? (VIDEOS[slug + '-women'] || null) : null;
    const movementType  = MOVEMENT_TYPE[ex.name] || null;
    const alternatives  = ALTERNATIVES[ex.name] || [];

    const update = {};
    if (videoUrl)       update.video_url       = videoUrl;
    if (videoUrlWomen)  update.video_url_women  = videoUrlWomen;
    if (movementType)   update.movement_type    = movementType;
    if (alternatives.length) update.alternatives = alternatives;

    if (Object.keys(update).length > 0) {
      await Exercise.findByIdAndUpdate(ex._id, { $set: update });
      updated++;
      const status = videoUrl ? '✅' : '⚠️ (no video)';
      console.log(`${status} ${ex.name} → slug:${slug || 'none'} | women:${videoUrlWomen ? 'yes' : 'no'} | alts:${alternatives.length}`);
    } else {
      noVideo++;
      console.log(`⬜  ${ex.name} → no mapping found`);
    }
  }

  console.log(`\n════════════════════════════════`);
  console.log(`Updated:   ${updated}`);
  console.log(`No update: ${noVideo}`);

  // Summary of video coverage
  const withVideo = await Exercise.countDocuments({ video_url: { $ne: null } });
  const withWomen = await Exercise.countDocuments({ video_url_women: { $ne: null } });
  const total     = await Exercise.countDocuments();
  console.log(`\nVideo coverage: men ${withVideo}/${total} | women ${withWomen}/${total}`);

  await mongoose.disconnect();
  console.log('\nDone ✓');
}

run().catch(err => { console.error(err); process.exit(1); });
