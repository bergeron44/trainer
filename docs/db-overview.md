# 🗄️ Database Overview — כל ה-Collections

> סקירה מהירה של כל מסדי הנתונים במערכת.

---

## מפת Collections

```
MongoDB Atlas → trainer (database)
├── users            (2 docs)   ← משתמשים, פרופיל, העדפות מזון
├── workouts         (168 docs) ← תוכנית אימונים 12 שבועות
├── exercises        (173 docs) ← מאגר תרגילים עם וידאו
├── workoutsessions  (2 docs)   ← sessions פעילים
├── nutritionlogs    (0 docs)   ← לוגי תזונה [ריק]
└── chatsummaries    (0 docs)   ← שיחות AI [ריק]
```

---

## טבלת סיכום

| Collection | Documents | מצב | קובץ פירוט |
|-----------|-----------|-----|-----------|
| **users** | 2 | ✅ פעיל | [db-users.md](db-users.md) |
| **workouts** | 168 | ✅ פעיל | [db-workouts.md](db-workouts.md) |
| **exercises** | 173 | ✅ פעיל | [db-exercises.md](db-exercises.md) |
| **workoutsessions** | 2 | ⚠️ active ולא נסגרו | [db-workout-sessions.md](db-workout-sessions.md) |
| **nutritionlogs** | 0 | ❌ ריק — לא מחובר | [db-nutrition-logs.md](db-nutrition-logs.md) |
| **chatsummaries** | 0 | ❌ ריק — mock AI | [db-chat-summaries.md](db-chat-summaries.md) |

---

## קשרים בין Collections

```
User (1)
 ├──→ Workout (many)          user._id → workout.user
 ├──→ WorkoutSession (many)   user._id → workoutsession.user
 ├──→ NutritionLog (many)     user._id → nutritionlog.user
 ├──→ ChatSummary (many)      user._id → chatsummary.user
 └──→ liked_foods / disliked_foods (embedded)

Workout (1) ──→ WorkoutSession (1)
              workout._id → workoutsession.workout_id

Exercise (independent)
  ← referenced by name in Workout.exercises[].name
  ← referenced by movement_type in generateWorkoutPlan()
```

---

## עדיפויות לשיפור

| עדיפות | פעולה | Collection |
|--------|--------|-----------|
| 🔴 קריטי | חיבור שמירת ארוחות לDB | nutritionlogs |
| 🔴 קריטי | חיבור LLM אמיתי (Claude/GPT) | chatsummaries |
| 🔴 קריטי | עדכון 89 תרגילים עם movement_type=null | exercises |
| 🟡 גבוה | סגירת sessions שנשארו `active` | workoutsessions |
| 🟡 גבוה | תרגום 88 תרגילים חסרי name_he | exercises |
| 🟡 גבוה | שדות actual_weight / completed_sets | workouts |
| 🟢 בינוני | תמונות נשים ל-128 תרגילים | exercises |
| 🟢 בינוני | מדידות גוף (measurements) | users |
