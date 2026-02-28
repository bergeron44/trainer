/**
 * Exercise Seed Script
 * Run once: node server/seeds/seedExercises.js
 *
 * - Inserts all exercises into MongoDB
 * - Fetches and verifies GIF URLs from ExerciseDB (RapidAPI)
 * - Reports which exercises have working GIFs and which don't
 */

const path = require('path');
// server/.env  → MONGO_URI, PORT, JWT_SECRET
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// root .env    → VITE_EXERCISEDB_API_KEY
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');

const RAPIDAPI_KEY = process.env.VITE_EXERCISEDB_API_KEY;
const EXERCISEDB_BASE = 'https://exercisedb.p.rapidapi.com';

// ─── Complete Exercise Library ────────────────────────────────────────────────
const EXERCISES = [

  // ── CHEST ──────────────────────────────────────────────────────────────────
  { name: 'Bench Press',              name_he: 'לחיצת חזה',              muscle_group: 'chest',     equipment: 'barbell',     default_sets: 4, default_reps: '8-10',  rest_seconds: 120 },
  { name: 'Incline Bench Press',      name_he: 'לחיצת חזה עליונה',       muscle_group: 'chest',     equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Incline Dumbbell Press',   name_he: 'לחיצת דמבל עליונה',      muscle_group: 'chest',     equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Dumbbell Press',           name_he: 'לחיצת דמבל',             muscle_group: 'chest',     equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Floor Press',              name_he: 'לחיצת רצפה',             muscle_group: 'chest',     equipment: 'barbell',     default_sets: 3, default_reps: '8-10',  rest_seconds: 90  },
  { name: 'Machine Chest Press',      name_he: 'לחיצת חזה מכונה',        muscle_group: 'chest',     equipment: 'machine',     default_sets: 3, default_reps: '10-12', rest_seconds: 60  },
  { name: 'Dumbbell Fly',             name_he: 'פרפר דמבלס',              muscle_group: 'chest',     equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Cable Chest Fly',          name_he: 'פרפר כבלים',             muscle_group: 'chest',     equipment: 'cable',       default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Low Cable Fly',            name_he: 'פרפר כבל נמוך',          muscle_group: 'chest',     equipment: 'cable',       default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Pec Deck',                 name_he: 'פק דק',                  muscle_group: 'chest',     equipment: 'machine',     default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Push-Up',                  name_he: 'שכיבות סמיכה',           muscle_group: 'chest',     equipment: 'body weight', default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Incline Push-Up',          name_he: 'שכיבות סמיכה עליונות',   muscle_group: 'chest',     equipment: 'body weight', default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Pike Push-Up',             name_he: 'שכיבות פייק',             muscle_group: 'chest',     equipment: 'body weight', default_sets: 3, default_reps: '10-15', rest_seconds: 60  },
  { name: 'Dips',                     name_he: 'מתח מוטות',              muscle_group: 'chest',     equipment: 'body weight', default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Close Grip Bench Press',   name_he: 'לחיצה צרה',              muscle_group: 'chest',     equipment: 'barbell',     default_sets: 3, default_reps: '8-10',  rest_seconds: 90  },

  // ── BACK ───────────────────────────────────────────────────────────────────
  { name: 'Pull-Up',                  name_he: 'מתח',                    muscle_group: 'back',      equipment: 'body weight', default_sets: 4, default_reps: '6-10',  rest_seconds: 120 },
  { name: 'Chin-Up',                  name_he: 'מתח אחיזה הפוכה',        muscle_group: 'back',      equipment: 'body weight', default_sets: 3, default_reps: '6-10',  rest_seconds: 120 },
  { name: 'Assisted Pull-Up',         name_he: 'מתח עם עזרה',            muscle_group: 'back',      equipment: 'machine',     default_sets: 3, default_reps: '8-12',  rest_seconds: 90  },
  { name: 'Barbell Row',              name_he: 'חתירה מוט',              muscle_group: 'back',      equipment: 'barbell',     default_sets: 4, default_reps: '8-10',  rest_seconds: 120 },
  { name: 'Pendlay Row',              name_he: 'חתירת פנדליי',            muscle_group: 'back',      equipment: 'barbell',     default_sets: 3, default_reps: '6-8',   rest_seconds: 120 },
  { name: 'T-Bar Row',                name_he: 'חתירת T',                muscle_group: 'back',      equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Dumbbell Row',             name_he: 'חתירה דמבל',             muscle_group: 'back',      equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Lat Pulldown',             name_he: 'משיכת לט',               muscle_group: 'back',      equipment: 'cable',       default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Seated Cable Row',         name_he: 'חתירה כבלים ישיבה',      muscle_group: 'back',      equipment: 'cable',       default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Deadlift',                 name_he: 'דדליפט',                 muscle_group: 'back',      equipment: 'barbell',     default_sets: 4, default_reps: '5-6',   rest_seconds: 180 },
  { name: 'Face Pull',                name_he: 'פייס פול',               muscle_group: 'back',      equipment: 'cable',       default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Rear Delt Fly',            name_he: 'פרפר אחורי',             muscle_group: 'back',      equipment: 'dumbbell',    default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Reverse Pec Deck',         name_he: 'פק דק הפוך',             muscle_group: 'back',      equipment: 'machine',     default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Band Pull Apart',          name_he: 'פתיחת גומייה',           muscle_group: 'back',      equipment: 'resistance band', default_sets: 3, default_reps: '20', rest_seconds: 45 },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  { name: 'Squat',                    name_he: 'סקוואט',                 muscle_group: 'legs',      equipment: 'barbell',     default_sets: 4, default_reps: '6-8',   rest_seconds: 180 },
  { name: 'Goblet Squat',             name_he: 'סקוואט גביע',            muscle_group: 'legs',      equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 90  },
  { name: 'Air Squat',                name_he: 'סקוואט אוויר',           muscle_group: 'legs',      equipment: 'body weight', default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Hack Squat',               name_he: 'האק סקוואט',             muscle_group: 'legs',      equipment: 'machine',     default_sets: 4, default_reps: '10-12', rest_seconds: 120 },
  { name: 'Leg Press',                name_he: 'פרס רגליים',             muscle_group: 'legs',      equipment: 'machine',     default_sets: 4, default_reps: '10-12', rest_seconds: 120 },
  { name: 'Romanian Deadlift',        name_he: 'דדליפט רומני',           muscle_group: 'legs',      equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 120 },
  { name: 'Walking Lunge',            name_he: 'ראנג׳ים הליכה',          muscle_group: 'legs',      equipment: 'dumbbell',    default_sets: 3, default_reps: '12',    rest_seconds: 90  },
  { name: 'Reverse Lunge',            name_he: 'ראנג׳ אחורי',            muscle_group: 'legs',      equipment: 'body weight', default_sets: 3, default_reps: '12',    rest_seconds: 90  },
  { name: 'Bulgarian Split Squat',    name_he: 'בולגרי',                 muscle_group: 'legs',      equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Split Squat',              name_he: 'סקוואט מפוצל',           muscle_group: 'legs',      equipment: 'body weight', default_sets: 3, default_reps: '12',    rest_seconds: 90  },
  { name: 'Step Up',                  name_he: 'עליית קופסה',            muscle_group: 'legs',      equipment: 'box',         default_sets: 3, default_reps: '12',    rest_seconds: 60  },
  { name: 'Leg Curl',                 name_he: 'כיפוף רגליים',           muscle_group: 'legs',      equipment: 'machine',     default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Leg Extension',            name_he: 'פשיטת רגליים',           muscle_group: 'legs',      equipment: 'machine',     default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Calf Raise',               name_he: 'עליית עקבים',            muscle_group: 'legs',      equipment: 'machine',     default_sets: 4, default_reps: '15-20', rest_seconds: 60  },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  { name: 'Overhead Press',           name_he: 'לחיצת כתפיים',           muscle_group: 'shoulders', equipment: 'barbell',     default_sets: 4, default_reps: '8-10',  rest_seconds: 120 },
  { name: 'Dumbbell Shoulder Press',  name_he: 'לחיצת כתפיים דמבל',      muscle_group: 'shoulders', equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Arnold Press',             name_he: 'ארנולד פרס',             muscle_group: 'shoulders', equipment: 'dumbbell',    default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Landmine Press',           name_he: 'לחיצת לנדמיין',          muscle_group: 'shoulders', equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Lateral Raise',            name_he: 'הרמת צד',                muscle_group: 'shoulders', equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Cable Lateral Raise',      name_he: 'הרמת צד כבל',            muscle_group: 'shoulders', equipment: 'cable',       default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Front Raise',              name_he: 'הרמת קדמי',              muscle_group: 'shoulders', equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Upright Row',              name_he: 'חתירה עמידה',            muscle_group: 'shoulders', equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 90  },
  { name: 'Reverse Fly',              name_he: 'פרפר הפוך',              muscle_group: 'shoulders', equipment: 'dumbbell',    default_sets: 3, default_reps: '15-20', rest_seconds: 60  },

  // ── ARMS — BICEPS ──────────────────────────────────────────────────────────
  { name: 'Barbell Curl',             name_he: 'כפיפת מרפק מוט',         muscle_group: 'arms',      equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 60  },
  { name: 'Dumbbell Curl',            name_he: 'כפיפת מרפק דמבל',        muscle_group: 'arms',      equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Hammer Curl',              name_he: 'כפיפת פטיש',             muscle_group: 'arms',      equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Preacher Curl',            name_he: 'פריצ׳ר קרל',             muscle_group: 'arms',      equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 60  },
  { name: 'Cable Curl',               name_he: 'כפיפת כבל',              muscle_group: 'arms',      equipment: 'cable',       default_sets: 3, default_reps: '12-15', rest_seconds: 60  },

  // ── ARMS — TRICEPS ─────────────────────────────────────────────────────────
  { name: 'Tricep Pushdown',          name_he: 'פשיטת מרפק כבל',         muscle_group: 'arms',      equipment: 'cable',       default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Skull Crusher',            name_he: 'מחץ גולגולת',            muscle_group: 'arms',      equipment: 'barbell',     default_sets: 3, default_reps: '10-12', rest_seconds: 60  },
  { name: 'Overhead Tricep Extension',name_he: 'פשיטת מרפק מעל ראש',     muscle_group: 'arms',      equipment: 'dumbbell',    default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Tricep Dips',              name_he: 'שכיבות שלש ראשי',        muscle_group: 'arms',      equipment: 'body weight', default_sets: 3, default_reps: '10-15', rest_seconds: 90  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  { name: 'Plank',                    name_he: 'פלנק',                   muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '60 sec', rest_seconds: 60 },
  { name: 'Crunch',                   name_he: 'כפיפות בטן',             muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '20-25', rest_seconds: 45  },
  { name: 'Hanging Leg Raise',        name_he: 'הרמת רגליים תלוי',       muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '12-15', rest_seconds: 60  },
  { name: 'Russian Twist',            name_he: 'טוויסט רוסי',            muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '20',    rest_seconds: 45  },
  { name: 'Cable Crunch',             name_he: 'כפיפות בטן כבל',         muscle_group: 'core',      equipment: 'cable',       default_sets: 3, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Dead Bug',                 name_he: 'דד באג',                 muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '10-12', rest_seconds: 45  },
  { name: 'Bird Dog',                 name_he: 'בירד דוג',               muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '10-12', rest_seconds: 45  },
  { name: 'Hollow Hold',              name_he: 'החזקת גוף',              muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '30 sec', rest_seconds: 45 },
  { name: 'Mountain Climber',         name_he: 'מטפס הרים',              muscle_group: 'core',      equipment: 'body weight', default_sets: 3, default_reps: '30 sec', rest_seconds: 45 },

  // ── FULL BODY / POWER ──────────────────────────────────────────────────────
  { name: 'Power Clean',              name_he: 'פאוור קלין',             muscle_group: 'full_body', equipment: 'barbell',     default_sets: 4, default_reps: '3-5',   rest_seconds: 180 },
  { name: 'Hang Clean',               name_he: 'האנג קלין',              muscle_group: 'full_body', equipment: 'barbell',     default_sets: 4, default_reps: '4-6',   rest_seconds: 150 },
  { name: 'High Pull',                name_he: 'משיכה גבוהה',            muscle_group: 'full_body', equipment: 'barbell',     default_sets: 3, default_reps: '5-6',   rest_seconds: 120 },
  { name: 'Kettlebell Swing',         name_he: 'נדנוד קטלבל',            muscle_group: 'full_body', equipment: 'kettlebell',  default_sets: 4, default_reps: '15-20', rest_seconds: 60  },
  { name: 'Medicine Ball Slam',       name_he: 'זריקת כדור רפואי',       muscle_group: 'full_body', equipment: 'medicine ball', default_sets: 3, default_reps: '10-12', rest_seconds: 60 },

  // ── CARDIO / PLYOMETRICS ───────────────────────────────────────────────────
  { name: 'Burpee',                   name_he: 'ברפי',                   muscle_group: 'cardio',    equipment: 'body weight', default_sets: 4, default_reps: '10',    rest_seconds: 60  },
  { name: 'Box Jump',                 name_he: 'קפיצת ארגז',             muscle_group: 'cardio',    equipment: 'box',         default_sets: 4, default_reps: '8-10',  rest_seconds: 90  },
  { name: 'Jump Squat',               name_he: 'סקוואט קפיצה',           muscle_group: 'cardio',    equipment: 'body weight', default_sets: 3, default_reps: '10-12', rest_seconds: 60  },
  { name: 'Tuck Jump',                name_he: 'קפיצת ברך',              muscle_group: 'cardio',    equipment: 'body weight', default_sets: 3, default_reps: '10',    rest_seconds: 60  },
  { name: 'Broad Jump',               name_he: 'קפיצה לרחב',             muscle_group: 'cardio',    equipment: 'body weight', default_sets: 3, default_reps: '6-8',   rest_seconds: 90  },
  { name: 'Depth Jump',               name_he: 'קפיצת עומק',             muscle_group: 'cardio',    equipment: 'box',         default_sets: 3, default_reps: '6-8',   rest_seconds: 90  },
  { name: 'Jumping Jack',             name_he: 'קפיצות ג׳ק',             muscle_group: 'cardio',    equipment: 'body weight', default_sets: 3, default_reps: '30 sec', rest_seconds: 30 },
  { name: 'High Knees',               name_he: 'ברכיים גבוהות',          muscle_group: 'cardio',    equipment: 'body weight', default_sets: 3, default_reps: '30 sec', rest_seconds: 30 },
  { name: 'Battle Ropes',             name_he: 'חבלי קרב',               muscle_group: 'cardio',    equipment: 'rope',        default_sets: 4, default_reps: '30 sec', rest_seconds: 60 },
  { name: 'Jump Rope',                name_he: 'חבל קפיצה',              muscle_group: 'cardio',    equipment: 'rope',        default_sets: 3, default_reps: '60 sec', rest_seconds: 60 },
];

const HEADERS = {
  'X-RapidAPI-Key':  RAPIDAPI_KEY,
  'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
};

// ExerciseDB bodyPart → our muscle_group
const BODY_PART_MAP = {
  'back':        'back',
  'cardio':      'cardio',
  'chest':       'chest',
  'lower arms':  'arms',
  'lower legs':  'legs',
  'neck':        'back',
  'shoulders':   'shoulders',
  'upper arms':  'arms',
  'upper legs':  'legs',
  'waist':       'core',
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url) {
  await delay(600); // stay well under free-plan rate limit
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`ExerciseDB ${res.status}: ${url}`);
  return res.json();
}

async function fetchBodyPartList() {
  return apiFetch(`${EXERCISEDB_BASE}/exercises/bodyPartList`);
}

async function fetchByBodyPart(bodyPart, limit = 10) {
  const encoded = encodeURIComponent(bodyPart);
  return apiFetch(`${EXERCISEDB_BASE}/exercises/bodyPart/${encoded}?limit=${limit}&offset=0`);
}

async function fetchByName(name) {
  const encoded = encodeURIComponent(name.toLowerCase());
  const data = await apiFetch(`${EXERCISEDB_BASE}/exercises/name/${encoded}?limit=1&offset=0`);
  return data[0] ?? null;
}

function saveApiFields(apiData) {
  return {
    gif_url:           apiData?.gifUrl           ?? null,
    gif_verified:      !!apiData?.gifUrl,
    instructions:      apiData?.instructions     ?? [],
    description:       apiData?.description      ?? '',
    difficulty:        apiData?.difficulty       ?? '',
    category:          apiData?.category         ?? '',
    body_part:         apiData?.bodyPart         ?? '',
    target:            apiData?.target           ?? '',
    secondary_muscles: apiData?.secondaryMuscles ?? [],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Build a quick lookup: exercise name (lowercase) → our metadata
  const ourMeta = {};
  EXERCISES.forEach(ex => { ourMeta[ex.name.toLowerCase()] = ex; });

  let total = 0, withGif = 0, withInstructions = 0, notFound = [];

  // ── PHASE 1: fetch top exercises by body part from ExerciseDB ───────────────
  console.log('═══ PHASE 1: Fetch by body part ═══\n');
  let bodyParts;
  try {
    bodyParts = await fetchBodyPartList();
    console.log(`Body parts available: ${bodyParts.join(', ')}\n`);
  } catch (e) {
    console.warn('Could not fetch body part list:', e.message);
    bodyParts = Object.keys(BODY_PART_MAP);
  }

  for (const bodyPart of bodyParts) {
    const muscleGroup = BODY_PART_MAP[bodyPart] ?? 'full_body';
    console.log(`\n── ${bodyPart} (→ ${muscleGroup}) ──`);
    let apiList = [];
    try {
      apiList = await fetchByBodyPart(bodyPart, 10);
    } catch (e) {
      console.warn(`  ⚠️  Could not fetch: ${e.message}`);
      continue;
    }

    for (const apiEx of apiList) {
      const nameLower = apiEx.name.toLowerCase();
      // Capitalize first letter of each word for display
      const displayName = apiEx.name
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const meta = ourMeta[nameLower] ?? {
        name:          displayName,
        muscle_group:  muscleGroup,
        equipment:     apiEx.equipment ?? 'body weight',
        default_sets:  3,
        default_reps:  '10-12',
        rest_seconds:  90,
      };

      const fields = saveApiFields(apiEx);
      if (fields.gif_url) withGif++;
      if (fields.instructions.length > 0) withInstructions++;
      total++;

      console.log(`  ${fields.gif_url ? '✅' : '⚠️ '} ${displayName}${fields.instructions.length ? ` (${fields.instructions.length} steps)` : ''}`);

      await Exercise.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${displayName}$`, 'i') } },
        { ...meta, name: displayName, ...fields },
        { upsert: true, new: true }
      );
    }
  }

  // ── PHASE 2: ensure every exercise in our list is in the DB ─────────────────
  console.log('\n\n═══ PHASE 2: Verify our exercise list ═══\n');

  for (const ex of EXERCISES) {
    const existing = await Exercise.findOne({ name: { $regex: new RegExp(`^${ex.name}$`, 'i') } });
    if (existing?.instructions?.length > 0) {
      console.log(`  ✅ ${ex.name} — already seeded`);
      continue;
    }

    console.log(`  🔍 ${ex.name} — fetching from API...`);
    let apiData = null;
    try { apiData = await fetchByName(ex.name); } catch {}

    const fields = saveApiFields(apiData);
    if (!existing) {
      total++;
      if (fields.gif_url) withGif++;
      if (fields.instructions.length > 0) withInstructions++;
    }
    if (!fields.instructions.length) {
      notFound.push(ex.name);
      console.log(`     ❌ Not found in ExerciseDB — saved with defaults only`);
    } else {
      console.log(`     📋 ${fields.instructions.length} instructions${fields.gif_url ? ' + GIF' : ''}`);
    }

    await Exercise.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${ex.name}$`, 'i') } },
      { ...ex, ...fields },
      { upsert: true, new: true }
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const dbTotal = await Exercise.countDocuments();
  console.log('\n═════════════════════════════════════════');
  console.log(`Exercises in DB:       ${dbTotal}`);
  console.log(`✅ With GIF:           ${withGif}`);
  console.log(`📋 With instructions:  ${withInstructions}`);
  console.log(`❌ Not found in API:   ${notFound.length}`);
  if (notFound.length) {
    console.log('\nNot found in ExerciseDB (saved without API data):');
    notFound.forEach(n => console.log(`  - ${n}`));
  }
  console.log('═════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
