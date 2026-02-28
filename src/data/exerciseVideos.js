// ─────────────────────────────────────────────────────────────────
//  Exercise name → Cloudinary video URL mapping
//  Cloud: dgmgsqam5
// ─────────────────────────────────────────────────────────────────

const CDN = 'https://res.cloudinary.com/dgmgsqam5/video/upload';

// ── Actual Cloudinary-hosted exercise videos ──
const VIDEOS = {
  'bench-press': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_13_ujwhqy.mp4`,
  'incline-bench': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_xwm6gu.mp4`,
  'incline-dumbbell-press': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_sbepec.mp4`,
  'push-ups': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_1_azokuo.mp4`,
  'dips': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_2_a41ksr.mp4`,
  'barbell-row': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_3_k7gjeo.mp4`,
  'seated-cable-row': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_4_kbckec.mp4`,
  'face-pull': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_5_d64qe9.mp4`,
  'deadlift': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_6_udu2dm.mp4`,
  'leg-press': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_6_wkg5kk.mp4`,
  'leg-extension': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_10_ker2ug.mp4`,
  'leg-curl': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_7_gykbnt.mp4`,
  'calf-raises': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_8_b1c0nc.mp4`,
  'overhead-press': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_7_wlbe9y.mp4`,
  'overhead-press-sit': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_12_emmgwo.mp4`,
  'lateral-raises': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_9_fyymfm.mp4`,
  'front-raises': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_8_rwjxyt.mp4`,
  'biceps-curl-machine': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_12_q8rowm.mp4`,
  'dumbbells': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_11_ji9xqz.mp4`,
  'plank': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_15_aghshv.mp4`,
  'front-leaning-rest': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_14_rricr9.mp4`,
  'crunches': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_14_w1tu8z.mp4`,
  'russian-twists': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_16_wjhmde.mp4`,
  'cable-crunches': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_18_kim2us.mp4`,
  'burpees': `${CDN}/grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_17_vqzs1a.mp4`,
  'jumping-jacks': `${CDN}/grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_18_oy0v8j.mp4`,
};

// ── Map every possible exercise name variant → Cloudinary slug ──
// This lets us match "Bench Press", "Flat Bench Press", "Barbell Bench Press" etc.
const exerciseNameToSlug = {
  // Chest
  'Bench Press': 'bench-press',
  'Flat Bench Press': 'bench-press',
  'Barbell Bench Press': 'bench-press',
  'Incline Bench Press': 'incline-bench',
  'Incline Barbell Press': 'incline-bench',
  'Incline Dumbbell Press': 'incline-dumbbell-press',
  'Dumbbell Press': 'incline-dumbbell-press',
  'Floor Press': 'bench-press',
  'Push-ups': 'push-ups',
  'Push Ups': 'push-ups',
  'Push Up': 'push-ups',
  'Diamond Push-ups': 'push-ups',
  'Cable Flyes': 'dips',        // closest match
  'Cable Chest Fly': 'dips',
  'Cable Crossover': 'dips',
  'Dumbbell Flye': 'incline-dumbbell-press',
  'Dumbbell Flyes': 'incline-dumbbell-press',
  'Chest Dips': 'dips',
  'Dips': 'dips',
  'Tricep Dips': 'dips',
  'Machine Chest Press': 'bench-press',
  'Pec Deck': 'dips',

  // Back
  'Pull-ups': 'barbell-row',  // no pull-up video yet, using row
  'Pull Ups': 'barbell-row',
  'Chin-ups': 'barbell-row',
  'Chin Ups': 'barbell-row',
  'Lat Pulldown': 'seated-cable-row',
  'Lat Pulldowns': 'seated-cable-row',
  'Barbell Row': 'barbell-row',
  'Barbell Rows': 'barbell-row',
  'Bent Over Row': 'barbell-row',
  'Bent-Over Rows': 'barbell-row',
  'Dumbbell Rows': 'barbell-row',
  'Dumbbell Row': 'barbell-row',
  'Cable Rows': 'seated-cable-row',
  'Seated Cable Row': 'seated-cable-row',
  'Seated Cable Rows': 'seated-cable-row',
  'T-Bar Row': 'barbell-row',
  'T-Bar Rows': 'barbell-row',
  'Pendlay Rows': 'barbell-row',
  'Meadows Rows': 'barbell-row',
  'Face Pull': 'face-pull',
  'Face Pulls': 'face-pull',
  'Rear Delt Flyes': 'face-pull',
  'Band Pull-aparts': 'face-pull',
  'Reverse Pec Deck': 'face-pull',
  'Deadlift': 'deadlift',
  'Romanian Deadlift': 'deadlift',
  'Sumo Deadlift': 'deadlift',

  // Legs
  'Squat': 'leg-press',    // no squat video, using leg press
  'Barbell Squat': 'leg-press',
  'Goblet Squats': 'leg-press',
  'Goblet Squat': 'leg-press',
  'Leg Press': 'leg-press',
  'Hack Squat': 'leg-press',
  'Leg Extension': 'leg-extension',
  'Leg Extensions': 'leg-extension',
  'Leg Curl': 'leg-curl',
  'Leg Curls': 'leg-curl',
  'Hamstring Curl': 'leg-curl',
  'Calf Raise': 'calf-raises',
  'Calf Raises': 'calf-raises',
  'Standing Calf Raise': 'calf-raises',
  'Lunges': 'leg-press',
  'Walking Lunges': 'leg-press',
  'Reverse Lunges': 'leg-press',
  'Bulgarian Split Squat': 'leg-press',
  'Bulgarian Split Squats': 'leg-press',
  'Split Squats': 'leg-press',
  'Step-ups': 'leg-press',
  'Hip Thrust': 'deadlift',
  'Glute Bridge': 'deadlift',

  // Shoulders
  'Overhead Press': 'overhead-press',
  'Military Press': 'overhead-press',
  'Shoulder Press': 'overhead-press',
  'Dumbbell Shoulder Press': 'overhead-press-sit',
  'Seated Shoulder Press': 'overhead-press-sit',
  'Arnold Press': 'overhead-press-sit',
  'Lateral Raise': 'lateral-raises',
  'Lateral Raises': 'lateral-raises',
  'Cable Lateral Raises': 'lateral-raises',
  'Leaning Lateral Raises': 'lateral-raises',
  'Machine Laterals': 'lateral-raises',
  'Front Raise': 'front-raises',
  'Front Raises': 'front-raises',
  'Reverse Fly': 'face-pull',
  'Landmine Press': 'overhead-press',

  // Arms
  'Barbell Curl': 'biceps-curl-machine',
  'Bicep Curl': 'biceps-curl-machine',
  'Bicep Curls': 'biceps-curl-machine',
  'Dumbbell Curl': 'dumbbells',
  'Dumbbell Curls': 'dumbbells',
  'Hammer Curl': 'dumbbells',
  'Hammer Curls': 'dumbbells',
  'Preacher Curl': 'biceps-curl-machine',
  'Preacher Curls': 'biceps-curl-machine',
  'Concentration Curl': 'biceps-curl-machine',
  'Tricep Pushdown': 'dips',
  'Tricep Pushdowns': 'dips',
  'Tricep Extensions': 'dips',
  'Skull Crusher': 'bench-press',
  'Skull Crushers': 'bench-press',
  'Close Grip Bench': 'bench-press',
  'Close Grip Bench Press': 'bench-press',

  // Core
  'Plank': 'plank',
  'Front Plank': 'plank',
  'Side Plank': 'plank',
  'Dead Bug': 'front-leaning-rest',
  'Bird Dog': 'front-leaning-rest',
  'Hollow Hold': 'front-leaning-rest',
  'Crunches': 'crunches',
  'Ab Crunches': 'crunches',
  'Russian Twist': 'russian-twists',
  'Russian Twists': 'russian-twists',
  'Leg Raise': 'crunches',
  'Leg Raises': 'crunches',
  'Hanging Leg Raise': 'crunches',
  'Hanging Leg Raises': 'crunches',
  'Ab Wheel': 'plank',
  'Cable Crunch': 'cable-crunches',
  'Cable Crunches': 'cable-crunches',

  // Cardio
  'Burpees': 'burpees',
  'Jumping Jacks': 'jumping-jacks',
  'Mountain Climbers': 'burpees',
  'Jump Rope': 'jumping-jacks',
  'Treadmill': 'burpees',
  'High Knees': 'jumping-jacks',
  'Battle Ropes': 'burpees',
  'Box Jumps': 'jumping-jacks',
  'Jump Squats': 'jumping-jacks',
  'Broad Jumps': 'jumping-jacks',
  'Kettlebell Swings': 'deadlift',
  'Power Cleans': 'deadlift',
  'Hang Cleans': 'deadlift',
  'High Pulls': 'deadlift',
  'Medicine Ball Slams': 'burpees',
};

// ── Fallback video (generic dumbbell exercise) ──
export const fallbackVideoUrl = VIDEOS['dumbbells'];

/**
 * Get the Cloudinary video URL for an exercise name.
 * Tries exact match first, then case-insensitive lookup.
 * Falls back to the generic dumbbell video.
 *
 * @param {string} name - The exercise name, e.g. "Bench Press"
 * @returns {string} Cloudinary video URL
 */
export function getExerciseVideoUrl(name) {
  if (!name) return fallbackVideoUrl;

  // 1. Exact match in our name→slug map
  const slug = exerciseNameToSlug[name];
  if (slug && VIDEOS[slug]) return VIDEOS[slug];

  // 2. Case-insensitive match
  const lower = name.toLowerCase();
  for (const [key, s] of Object.entries(exerciseNameToSlug)) {
    if (key.toLowerCase() === lower) {
      return VIDEOS[s] || fallbackVideoUrl;
    }
  }

  // 3. Partial match (exercise name contains one of our keys)
  for (const [key, s] of Object.entries(exerciseNameToSlug)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return VIDEOS[s] || fallbackVideoUrl;
    }
  }

  return fallbackVideoUrl;
}

// Legacy export for backward compatibility
export const exerciseVideoMap = Object.fromEntries(
  Object.entries(exerciseNameToSlug).map(([name, slug]) => [name, VIDEOS[slug] || fallbackVideoUrl])
);
