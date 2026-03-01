// ─────────────────────────────────────────────────────────────────
//  Exercise name → Cloudinary video URL mapping
//  Cloud: dgmgsqam5  |  Gender-aware (pass gender to getExerciseVideoUrl)
// ─────────────────────────────────────────────────────────────────

const CDN = 'https://res.cloudinary.com/dgmgsqam5/video/upload';

// ── Cloudinary public_id → exercise slug (full classified mapping) ─────────
const CLOUDINARY_MAP = {
  // ── Grok batch 7a60fbd2 (men) ──────────────────────────────────────────
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
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_10_csvosd': 'leg-extension',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_10_ker2ug': 'leg-extension',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_11_ji9xqz': 'hammer-curl',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_12_emmgwo': 'overhead-press-sit',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_12_voiuzb': 'overhead-press-sit',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_13_ujwhqy': 'bench-press',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_14_rricr9': 'front-leaning-rest',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_17_vqzs1a': 'burpees',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_18_kim2us': 'cable-crunches',
  'grok-video-7a60fbd2-7a50-428f-a8dd-7f609272da11_xwm6gu':    'bench-press',

  // ── Grok batch f478699f (men) ──────────────────────────────────────────
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
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_14_wuz27h': 'crunches',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_15_dyd62r': 'russian-twists',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_16_h8g3gk': 'russian-twists',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_16_wjhmde': 'russian-twists',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_18_oy0v8j': 'jumping-jacks',
  'grok-video-f478699f-5a49-4654-b72c-8b4313f2e18c_ozxwr9':    'incline-dumbbell-press',

  // ── Grok batch 27db02be (women) ────────────────────────────────────────
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_2_ji6fxk':  'treadmill-running-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_3_mdqyod':  'jumping-jacks-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_6_x4zrlr':  'jumping-jacks-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_7_vce6ed':  'burpees-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_9_gkzwqb':  'russian-twists-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_10_hrji07': 'hanging-leg-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_11_aoimdd': 'crunches-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_12_srffnd': 'tricep-dips-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_13_s388ks': 'barbell-bicep-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_14_tlxu6s': 'bench-press-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_15_mmg3lt': 'tricep-pushdown-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_16_o5b13o': 'hammer-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_17_smjyta': 'barbell-bicep-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_18_hfriws': 'overhead-press-sit-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_19_wdlklx': 'lateral-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_20_blbkoh': 'hammer-curl-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_21_mdtcbo': 'front-raises-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_22_lwxpnd': 'overhead-press-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_23_oukhyd': 'pull-ups-women',
  'grok-video-27db02be-da1a-47c7-a4b8-f6675aef80b8_pcgn1w':    'incline-dumbbell-press-women',

  // ── Named videos (women) ────────────────────────────────────────────────
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

// ── Build slug → URL (first-match wins for duplicate slugs) ───────────────
const VIDEOS = {};
for (const [id, slug] of Object.entries(CLOUDINARY_MAP)) {
  if (!VIDEOS[slug]) VIDEOS[slug] = `${CDN}/${id}.mp4`;
}

// ── Exercise name → base slug (gender-neutral) ────────────────────────────
const exerciseNameToSlug = {
  // Chest
  'Bench Press':              'bench-press',
  'Flat Bench Press':         'bench-press',
  'Barbell Bench Press':      'bench-press',
  'Chest Press':              'bench-press',
  'Machine Chest Press':      'bench-press',
  'Incline Bench Press':      'incline-bench',
  'Incline Barbell Press':    'incline-bench',
  'Incline Dumbbell Press':   'incline-dumbbell-press',
  'Incline Dumbbell Fly':     'incline-dumbbell-press',
  'Dumbbell Press':           'incline-dumbbell-press',
  'Dumbbell Flye':            'incline-dumbbell-press',
  'Dumbbell Flyes':           'incline-dumbbell-press',
  'Floor Press':              'bench-press',
  'Push-ups':                 'push-ups',
  'Push Ups':                 'push-ups',
  'Push Up':                  'push-ups',
  'Diamond Push-ups':         'push-ups',
  'Cable Flyes':              'cable-chest-fly',
  'Cable Chest Fly':          'cable-chest-fly',
  'Cable Crossover':          'cable-chest-fly',
  'Cable Fly':                'cable-chest-fly',
  'Pec Deck':                 'cable-chest-fly',
  'Chest Dips':               'dips',
  'Dips':                     'dips',
  'Tricep Dips':              'tricep-dips',
  'Bench Dips':               'tricep-dips',
  'Parallel Bar Dips':        'dips',

  // Back
  'Pull-ups':                 'pull-ups',
  'Pull Ups':                 'pull-ups',
  'Chin-ups':                 'pull-ups',
  'Chin Ups':                 'pull-ups',
  'Wide Grip Pull Up':        'pull-ups',
  'Lat Pulldown':             'lat-pulldown',
  'Lat Pulldowns':            'lat-pulldown',
  'Barbell Row':              'barbell-row',
  'Barbell Rows':             'barbell-row',
  'Bent Over Row':            'barbell-row',
  'Bent-Over Rows':           'barbell-row',
  'Dumbbell Rows':            'barbell-row',
  'Dumbbell Row':             'barbell-row',
  'Cable Rows':               'seated-cable-row',
  'Seated Cable Row':         'seated-cable-row',
  'Seated Cable Rows':        'seated-cable-row',
  'T-Bar Row':                'barbell-row',
  'Pendlay Rows':             'barbell-row',
  'Meadows Rows':             'barbell-row',
  'Face Pull':                'face-pull',
  'Face Pulls':               'face-pull',
  'Rear Delt Flyes':          'reverse-fly',
  'Band Pull-aparts':         'face-pull',
  'Reverse Pec Deck':         'reverse-fly',
  'Deadlift':                 'deadlift',
  'Barbell Deadlift':         'deadlift',
  'Romanian Deadlift':        'deadlift-alt',
  'Sumo Deadlift':            'deadlift-alt',
  'Stiff Leg Deadlift':       'deadlift-alt',

  // Legs
  'Squat':                    'squat',
  'Barbell Squat':            'squat',
  'Back Squat':               'squat',
  'Deep Squat':               'squat',
  'Goblet Squat':             'squat',
  'Goblet Squats':            'squat',
  'Leg Press':                'leg-press',
  'Hack Squat':               'leg-press',
  'Leg Extension':            'leg-extension',
  'Leg Extensions':           'leg-extension',
  'Seated Leg Extension':     'leg-extension',
  'Leg Curl':                 'leg-curl',
  'Leg Curls':                'leg-curl',
  'Lying Leg Curl':           'leg-curl',
  'Hamstring Curl':           'leg-curl',
  'Calf Raise':               'calf-raises',
  'Calf Raises':              'calf-raises',
  'Standing Calf Raise':      'calf-raises',
  'Seated Calf Raise':        'calf-raises',
  'Lunges':                   'lunges',
  'Walking Lunges':           'lunges',
  'Walking Lunges with Dumbbells': 'lunges',
  'Reverse Lunges':           'lunges',
  'Bulgarian Split Squat':    'squat',
  'Bulgarian Split Squats':   'squat',
  'Split Squats':             'squat',
  'Step-ups':                 'leg-press',
  'Hip Thrust':               'deadlift-alt',
  'Barbell Hip Thrust':       'deadlift-alt',
  'Glute Bridge':             'deadlift-alt',

  // Shoulders
  'Overhead Press':           'overhead-press',
  'Military Press':           'overhead-press',
  'Shoulder Press':           'overhead-press',
  'Standing Overhead Press':  'overhead-press',
  'Dumbbell Shoulder Press':  'overhead-press-sit',
  'Seated Shoulder Press':    'overhead-press-sit',
  'Seated Dumbbell Press':    'overhead-press-sit',
  'Arnold Press':             'arnold-press',
  'Lateral Raise':            'lateral-raises',
  'Lateral Raises':           'lateral-raises',
  'Dumbbell Lateral Raise':   'lateral-raises',
  'Cable Lateral Raises':     'lateral-raises',
  'Leaning Lateral Raises':   'lateral-raises',
  'Machine Laterals':         'lateral-raises',
  'Front Raise':              'front-raises',
  'Front Raises':             'front-raises',
  'Dumbbell Front Raise':     'front-raises',
  'Reverse Fly':              'reverse-fly',
  'Reverse Flyes':            'reverse-fly',
  'Rear Delt Fly':            'reverse-fly',
  'Dumbbell Reverse Fly':     'reverse-fly',
  'Landmine Press':           'overhead-press',

  // Arms
  'Barbell Curl':             'barbell-bicep-curl',
  'Bicep Curl':               'barbell-bicep-curl',
  'Bicep Curls':              'barbell-bicep-curl',
  'Barbell Bicep Curl':       'barbell-bicep-curl',
  'Dumbbell Curl':            'hammer-curl',
  'Dumbbell Curls':           'hammer-curl',
  'Hammer Curl':              'hammer-curl',
  'Hammer Curls':             'hammer-curl',
  'Dumbbell Hammer Curl':     'hammer-curl',
  'Preacher Curl':            'biceps-curl-machine',
  'Preacher Curls':           'biceps-curl-machine',
  'Concentration Curl':       'biceps-curl-machine',
  'Machine Bicep Curl':       'biceps-curl-machine',
  'Cable Curl':               'biceps-curl-machine',
  'Tricep Pushdown':          'tricep-pushdown',
  'Tricep Pushdowns':         'tricep-pushdown',
  'Cable Tricep Pushdown':    'tricep-pushdown',
  'Rope Pushdown':            'tricep-pushdown',
  'Tricep Extensions':        'tricep-pushdown',
  'Skull Crusher':            'skull-crushers',
  'Skull Crushers':           'skull-crushers',
  'Barbell Skull Crusher':    'skull-crushers',
  'Close Grip Bench':         'bench-press',
  'Close Grip Bench Press':   'bench-press',

  // Core
  'Plank':                    'plank',
  'Front Plank':              'plank',
  'Forearm Plank':            'plank',
  'Side Plank':               'front-leaning-rest',
  'Dead Bug':                 'front-leaning-rest',
  'Bird Dog':                 'front-leaning-rest',
  'Hollow Hold':              'front-leaning-rest',
  'Crunches':                 'crunches',
  'Ab Crunches':              'crunches',
  'Crunch':                   'crunches',
  'Russian Twist':            'russian-twists',
  'Russian Twists':           'russian-twists',
  'Leg Raise':                'hanging-leg-raises',
  'Leg Raises':               'hanging-leg-raises',
  'Hanging Leg Raise':        'hanging-leg-raises',
  'Hanging Leg Raises':       'hanging-leg-raises',
  'Ab Wheel':                 'plank',
  'Cable Crunch':             'cable-crunches',
  'Cable Crunches':           'cable-crunches',
  'Kneeling Cable Crunch':    'cable-crunches',

  // Cardio
  'Burpees':                  'burpees',
  'Burpee':                   'burpees',
  'Jumping Jacks':            'jumping-jacks',
  'Mountain Climbers':        'mountain-climbers',
  'Mountain Climber':         'mountain-climbers',
  'Jump Rope':                'jumping-jacks',
  'Treadmill':                'treadmill-running',
  'Treadmill Running':        'treadmill-running',
  'Running':                  'treadmill-running',
  'High Knees':               'mountain-climbers',
  'Battle Ropes':             'burpees',
  'Box Jumps':                'burpees',
  'Jump Squats':              'jumping-jacks',
  'Broad Jumps':              'jumping-jacks',
  'Kettlebell Swings':        'deadlift-alt',
  'Power Cleans':             'deadlift',
  'Hang Cleans':              'deadlift',
};

// ── Fallback (hammer-curl has the most coverage) ──────────────────────────
export const fallbackVideoUrl = VIDEOS['hammer-curl'] || VIDEOS['biceps-curl-machine'] || '';

/**
 * Get the Cloudinary video URL for an exercise name.
 * Tries gender-specific variant first, then falls back to base/male version.
 *
 * @param {string} name   - Exercise name, e.g. "Bench Press"
 * @param {string} gender - 'male' | 'female' (optional, defaults to male)
 * @returns {string} Cloudinary video URL
 */
export function getExerciseVideoUrl(name, gender = 'male') {
  if (!name) return fallbackVideoUrl;

  // 1. Exact match
  let slug = exerciseNameToSlug[name];

  // 2. Case-insensitive match
  if (!slug) {
    const lower = name.toLowerCase();
    for (const [key, s] of Object.entries(exerciseNameToSlug)) {
      if (key.toLowerCase() === lower) { slug = s; break; }
    }
  }

  // 3. Partial match
  if (!slug) {
    const lower = name.toLowerCase();
    for (const [key, s] of Object.entries(exerciseNameToSlug)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        slug = s; break;
      }
    }
  }

  if (!slug) return fallbackVideoUrl;

  // Gender-aware: prefer -women variant for female users
  const isFemale = gender === 'female' || gender === 'woman' || gender === 'f';
  if (isFemale) {
    const womenSlug = `${slug}-women`;
    if (VIDEOS[womenSlug]) return VIDEOS[womenSlug];
  }

  return VIDEOS[slug] || fallbackVideoUrl;
}

// Legacy export for backward compatibility
export const exerciseVideoMap = Object.fromEntries(
  Object.entries(exerciseNameToSlug).map(([name, slug]) => [name, VIDEOS[slug] || fallbackVideoUrl])
);
