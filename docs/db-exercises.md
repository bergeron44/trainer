# 💪 Collection: `exercises`

> מאגר התרגילים המרכזי — הבסיס לכל גנרציית תוכניות אימון.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 173 |
| **עם וידאו גברים** | 173 (100%) |
| **עם וידאו נשים** | 45 (26%) |
| **עם שם בעברית** | 85 (49%) |
| **עם movement_type** | 84 (49%) — שאר: null |

### פיזור לפי `muscle_group`

| קבוצת שריר | כמות |
|-----------|------|
| legs | 34 |
| arms | 28 |
| chest | 25 |
| back | 25 |
| shoulders | 19 |
| core | 19 |
| cardio | 18 |
| full_body | 5 |

### פיזור לפי `movement_type`

| movement_type | כמות | הערה |
|--------------|------|-------|
| **null** | 89 | ❗ חסר — חשוב לעדכן |
| push | 27 | תרגילי לחיצה |
| pull | 19 | תרגילי משיכה |
| legs | 14 | תרגילי רגליים |
| cardio | 10 | תרגילי קרדיו |
| core | 9 | תרגילי ליבה |
| full_body | 5 | תרגילי גוף שלם |

> ⚠️ **89 תרגילים עם movement_type=null** — אלו לא ייבחרו בגנרציית תוכנית אימונים!

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

גברים:  video_url        — 173/173 תרגילים
נשים:   video_url_women  — 45/173 תרגילים

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

## 🚧 בעיות ידועות / שיפורים נדרשים

| בעיה | כמות | פתרון |
|------|------|--------|
| `movement_type = null` | 89 תרגילים | הרצת seed script לסיווג |
| `name_he` חסר | 88 תרגילים | תרגום ידני / GPT batch |
| `video_url_women` חסר | 128 תרגילים | הוספת וידאו נשים |
| `difficulty` ריק | ~50 תרגילים | מילוי ידני |
| `default_reps` אחיד | רוב התרגילים | כיול לפי difficulty |
