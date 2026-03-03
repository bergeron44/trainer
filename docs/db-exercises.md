# 💪 Collection: `exercises`

> מאגר התרגילים המרכזי — הבסיס לכל גנרציית תוכניות אימון.

---

## 📊 סטטיסטיקות נוכחיות (עודכן 2026-03-03)

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 319 |
| **עם וידאו גברים** | 115 (36%) |
| **עם וידאו נשים** | 116 (36%) — סימטריה ✅ |
| **עם שם בעברית** | ~230+ |
| **עם movement_type** | 319 (100%) ✅ |

> ✅ **תוקן:** כל 89 התרגילים שהיו עם movement_type=null עודכנו
> ✅ **תוקן:** סימטריה גברים/נשים — video_url_women = video_url כברירת מחדל
> ✅ **הורחב:** נוספו 146 תרגילים חדשים (מ-173 ל-319)

### פיזור לפי `muscle_group`

| קבוצת שריר | כמות |
|-----------|------|
| legs | 61 |
| arms | 55 |
| back | 45 |
| chest | 42 |
| core | 35 |
| shoulders | 34 |
| cardio | 32 |
| full_body | 15 |

### תרגילים שנוספו

**חזה:** Wide/Diamond/Decline/Incline/Clap/Archer Push-Up, Incline/Decline Bench (Barbell+Dumbbell), Dumbbell Flyes, Cable Crossover, Low/High Cable Fly, Pec Deck, Machine Press, Chest Dip, Svend Press, Smith Machine, Landmine Press

**גב:** Wide/Close/Neutral/Weighted Pull-Up, Chin-Up, Wide/Close/Reverse Grip Lat Pulldown, Single Arm Pulldown, Bent Over Row, Pendlay Row, T-Bar Row, Chest Supported Row, Meadows Row, Machine Row, Face Pull, Rack Pull, Good Morning, Hyperextension, Superman, Band Pull-Apart, Straight Arm Pulldown

**רגליים:** Front Squat, Hack Squat, Leg Press, Romanian/Stiff Leg Deadlift, Bulgarian Split Squat, Walking/Reverse/Lateral Lunge, Box Step-Up, Box Jump, Jump Squat, Goblet/Sumo Squat, Sumo Deadlift, Leg Extension/Curl Machine, Hip Thrust, Glute Bridge, Donkey Kick, Fire Hydrant, Abductor/Adductor Machine, Calf Raises, Nordic Curl, Sissy/Pistol Squat, Wall Sit, Single Leg RDL, Smith Squat, Cable Pull Through

**כתפיים:** Standing/Seated Barbell Press, Arnold Press, Push Press, Cable/Front/Bent-Over Lateral Raise, Reverse Pec Deck, Upright Row, Barbell/Dumbbell Shrug, Machine Press, Plate Front Raise, Cable Rear Delt Fly, Pike Push-Up

**ידיים (ביספס+טריספס):** Barbell/EZ/Hammer/Incline/Concentration/Preacher/Spider/Reverse/Zottman Curl, Cable Curls, Machine Curl, Close Grip Bench Press, Skull Crushers, Tricep Dips, Cable Pushdowns, Overhead Extensions, Kickbacks, Machine Extension

**ליבה:** Crunch, Bicycle, Russian Twist, Side Plank, Hollow Hold, Ab Wheel, Hanging Leg Raise, Cable Crunch, Reverse Crunch, Dead Bug, Bird Dog, V-Up, Toes to Bar, Woodchopper, Mountain Climber, Flutter Kick, L-Sit, Dragon Flag, Windshield Wiper, Pallof Press

**קרדיו:** Treadmill, Stationary Bike, Elliptical, Rowing Machine, Jump Rope, Burpee, High Knees, Jumping Jacks, Battle Rope, Stair Climber, Sprint Intervals, Sled Push/Pull, Assault Bike, Shuttle Run, Incline Walk, Bear Crawl

**גוף שלם:** Power Clean, Clean & Press, Thruster, Kettlebell Swing, Turkish Get-Up, Man Maker, Power Snatch, Farmers Walk, Dumbbell Snatch, Kettlebell Goblet Squat, Barbell Complex, Sandbag Clean

---

## 🗂️ Schema — שדות

```js
{
  _id:          ObjectId    // מזהה ייחודי (MongoDB auto)
  name:         String      // שם באנגלית (required, unique) — 'Bench Press'
  name_he:      String      // שם בעברית — 'לחיצת חזה'

  // קטגוריה
  muscle_group: String      // 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'full_body'
  movement_type: String     // 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'full_body' | null
  equipment:    String      // 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | ...
  category:     String      // קטגוריה נוספת (מ-ExerciseDB)

  // פירוט שרירים (מ-ExerciseDB)
  body_part:          String    // 'chest' | 'back' | 'upper legs' | ...
  target:             String    // שריר ראשי — 'pectorals' | 'lats' | 'quads' | ...
  secondary_muscles:  [String]  // שרירי עזר — ['triceps', 'anterior deltoid']

  // הנחיות
  instructions: [String]    // שלבי ביצוע (1-8 שלבים)
  description:  String      // תיאור כללי
  difficulty:   String      // 'beginner' | 'intermediate' | 'advanced' | ''

  // מדיה
  gif_url:          String  // GIF מ-ExerciseDB (fallback)
  gif_verified:     Boolean // האם ה-GIF אומת
  video_url:        String  // Cloudinary (גברים) — CDN URL
  video_url_women:  String  // Cloudinary (נשים) — CDN URL | null

  // ברירות מחדל לגנרציית תוכנית
  default_sets:  Number     // default: 3
  default_reps:  String     // default: '8-12'
  rest_seconds:  Number     // default: 90

  // תרגילים חלופיים
  alternatives: [String]    // שמות תרגילים חלופיים

  createdAt:    Date
  updatedAt:    Date
  __v:          Number
}
```

---

## 🔍 דוגמה מהDB האמיתי

```json
{
  "name": "Bench Press",
  "name_he": "לחיצת חזה",
  "muscle_group": "chest",
  "movement_type": "push",
  "equipment": "barbell",
  "body_part": "chest",
  "target": "pectorals",
  "secondary_muscles": ["triceps", "anterior deltoid"],
  "difficulty": "intermediate",
  "default_sets": 4,
  "default_reps": "8-10",
  "rest_seconds": 90,
  "video_url": "https://res.cloudinary.com/dgmgsqam5/video/upload/...",
  "video_url_women": null,
  "gif_url": "https://exercisedb.p.rapidapi.com/.../bench-press.gif",
  "alternatives": ["Dumbbell Press", "Push-ups", "Cable Fly"],
  "instructions": [
    "Lie on bench with feet flat on floor",
    "Grip bar slightly wider than shoulder-width",
    "..."
  ]
}
```

---

## ⚙️ שימוש בגנרציית תוכנית

```
generateWorkoutPlan()
        ↓
סנן: { movement_type: { $ne: null }, video_url: { $exists: true } }
        ↓
קיבוץ לפי movement_type:
  push  → [Bench Press, Overhead Press, Dips, ...]
  pull  → [Pull-ups, Barbell Row, Face Pulls, ...]
  legs  → [Squats, RDL, Leg Press, ...]
  core  → [Plank, Ab Wheel, ...]
  cardio→ [Treadmill, Jump Rope, ...]
        ↓
בחירת 3 תרגילים לכל אימון מהקבוצה המתאימה
```

---

## 🎥 וידאו — Cloudinary

```
CDN:  https://res.cloudinary.com/dgmgsqam5/video/upload/
Format: MP4 (ממוטב לנייד)

גברים:  video_url        — 115/319 תרגילים (שאר null — ממתינים להעלאה)
נשים:   video_url_women  — 116/319 תרגילים (סימטרי לגברים ✅)

בחירת וידאו לפי gender:
  user.profile.gender === 'female' && exercise.video_url_women
    → video_url_women
  אחרת
    → video_url
```

---

## 📡 API Endpoints

| Method | Endpoint | Params | תיאור |
|--------|----------|--------|--------|
| GET | `/api/exercises` | `?muscle_group=chest` | כל התרגילים (עם סינון אופציונלי) |
| GET | `/api/exercises/lookup` | `?name=bench+press` | חיפוש fuzzy לפי שם |
| GET | `/api/exercises/:id` | — | תרגיל בודד |

### Fuzzy Search — 4 רמות
```
שאילתה: "bench press"
1. Exact match (case insensitive): "Bench Press" ✓
2. Singular form (strip -s/-es): "pull-up" → "pull-ups" ✓
3. Partial match: "bench" → מוצא "Bench Press" ✓
4. Word scoring: "press" → מדרג לפי מילים משותפות ✓
```

---

## 🚧 שיפורים נדרשים

| בעיה | כמות | פתרון |
|------|------|--------|
| `video_url` חסר | 204 תרגילים (64%) | העלאת וידאו ל-Cloudinary |
| `video_url_women` חסר | 203 תרגילים | העלאת וידאו נשים |
| `name_he` חסר | ~89 תרגילים חדשים | תרגום ידני / GPT batch |
| `difficulty` ריק | ~50 תרגילים | מילוי ידני |
| `instructions` חסר | רוב התרגילים החדשים | הוספת הוראות ביצוע |
