# 🏋️ Collection: `workouts`

> הcollection החשובה ביותר — מכילה את כל תוכנית האימונים של כל משתמש.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 168 |
| **משתמשים עם תוכנית** | 1 (Ron) |
| **אימונים מתוכננים** | 165 |
| **אימונים שהושלמו** | 3 |
| **טווח תאריכים** | פברואר 2026 → ~מאי 2026 (12 שבועות) |

### פיזור לפי muscle_group

| קבוצת שריר | כמות | סטטוסים |
|-----------|------|---------|
| Push | 56 | planned + completed |
| Pull | 56 | planned + completed |
| Legs | 56 | planned |

### פיזור לפי status

| status | כמות |
|--------|------|
| `planned` | 165 |
| `completed` | 3 |
| `in_progress` | 0 |

---

## 🗂️ Schema — שדות

```js
{
  _id:          ObjectId        // מזהה ייחודי (MongoDB auto)
  user:         ObjectId        // → ref: User (required)
  date:         Date            // תאריך האימון (required)
  muscle_group: String          // 'Push' | 'Pull' | 'Legs' | 'Full Body' | ...

  exercises: [                  // מערך תרגילים (required)
    {
      _id:          ObjectId    // (auto)
      id:           String      // מזהה ייחודי בתוך המערך
      name:         String      // שם התרגיל — 'Bench Press', 'Pull-ups', ...
      sets:         Number      // מספר סטים — ברירת מחדל: 3-4
      reps:         String      // טווח חזרות — '8-10', '12-15', '10-12'
      rest_seconds: Number      // מנוחה בין סטים — ברירת מחדל: 90
      weight:       Number      // משקל בק"ג (0 = bodyweight) [optional]
      notes:        String      // הערות [optional]
    }
  ]

  status:           String      // 'planned' | 'in_progress' | 'completed'
  duration_minutes: Number      // משך האימון בפועל [optional]
  total_volume:     Number      // נפח = sets × reps × weight [optional]
  notes:            String      // הערות לאימון [optional]

  createdAt:    Date            // (timestamps)
  updatedAt:    Date            // (timestamps)
  __v:          Number
}
```

---

## 🔍 דוגמאות מהDB האמיתי

### דוגמה 1 — אימון Push שהושלם
```json
{
  "muscle_group": "Push",
  "date": "2026-02-28",
  "status": "completed",
  "exercises": [
    { "name": "Bench Press",       "sets": 4, "reps": "8-10",  "rest_seconds": 90 },
    { "name": "Overhead Press",    "sets": 3, "reps": "10-12", "rest_seconds": 90 },
    { "name": "Tricep Pushdown",   "sets": 3, "reps": "12-15", "rest_seconds": 60 }
  ]
}
```

### דוגמה 2 — אימון Pull שהושלם
```json
{
  "muscle_group": "Pull",
  "date": "2026-03-02",
  "status": "completed",
  "exercises": [
    { "name": "Pull-ups",    "sets": 4, "reps": "8-10",  "rest_seconds": 90 },
    { "name": "Barbell Row", "sets": 3, "reps": "10-12", "rest_seconds": 90 },
    { "name": "Face Pulls",  "sets": 3, "reps": "15-20", "rest_seconds": 60 }
  ]
}
```

### דוגמה 3 — אימון Legs מתוכנן
```json
{
  "muscle_group": "Legs",
  "date": "2026-03-04",
  "status": "planned",
  "exercises": [
    { "name": "Squats",          "sets": 4, "reps": "8-10",  "rest_seconds": 120 },
    { "name": "Romanian Deadlift","sets": 3, "reps": "10-12", "rest_seconds": 90  },
    { "name": "Leg Press",       "sets": 3, "reps": "12-15", "rest_seconds": 90  }
  ]
}
```

---

## ⚙️ איך נוצרת תוכנית 12 שבועות

```
POST /api/workouts/generate
        ↓
generateWorkoutPlan()
        ↓
בדיקה: has_existing_plan !== true
        ↓
שליפת exercises מה-DB לפי movement_type
(רק עם video_url)
        ↓
Template לפי goal:
  recomp / muscle_gain → PPL: Push / Pull / Legs
  weight_loss          → Full Body / Upper+Core / Lower HIIT
  athletic_performance → Power / Agility / Functional
        ↓
12 שבועות × workout_days_per_week = 168 אימונים
פיזור תאריכים (דילוג שישי-שבת)
        ↓
כל אימון: 3 תרגילים מהקבוצה המתאימה
default_sets / default_reps / rest_seconds מתוך Exercise model
        ↓
user.profile.has_existing_plan = true
```

---

## 🔗 קשרים

```
Workout.user  → User._id       (many-to-one)
Workout._id   → WorkoutSession.workout_id  (one-to-one)
Workout.exercises[].name → Exercise.name   (soft reference by name)
```

---

## 📡 API Endpoints

| Method | Endpoint | תיאור |
|--------|----------|--------|
| GET | `/api/workouts` | כל האימונים (?startDate=&endDate=) |
| GET | `/api/workouts/:id` | אימון בודד |
| POST | `/api/workouts` | יצירת אימון ידנית |
| PUT | `/api/workouts/:id` | עדכון אימון |
| DELETE | `/api/workouts/:id` | מחיקת אימון |
| POST | `/api/workouts/generate` | יצירת תוכנית 12 שבועות |
| DELETE | `/api/workouts/reset` | מחיקת כל התוכנית |

---

## 🚧 שדות חסרים / שיפורים אפשריים

| שדה | תיאור | עדיפות |
|-----|--------|--------|
| `difficulty` | קושי האימון (easy/medium/hard) | בינונית |
| `user_rating` | דירוג המשתמש אחרי האימון (1-5) | גבוהה |
| `calories_burned` | קלוריות שנשרפו (חישוב MET) | בינונית |
| `week_number` | שבוע בתוכנית (1-12) | גבוהה |
| `is_deload` | שבוע deload | נמוכה |
| `exercises[].actual_weight` | משקל שהורם בפועל vs מתוכנן | גבוהה |
| `exercises[].completed_sets` | סטים שבוצעו בפועל | גבוהה |
