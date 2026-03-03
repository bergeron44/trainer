# ⏱️ Collection: `workoutsessions`

> מעקב בזמן אמת אחר ביצוע אימון פעיל — session חי.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 2 |
| **status: active** | 2 |
| **status: completed** | 0 |
| **status: abandoned** | 0 |

> ⚠️ שני ה-sessions במצב `active` — ככל הנראה נפתחו ולא נסגרו. כדאי להוסיף cleanup logic.

---

## 🗂️ Schema — שדות

```js
{
  _id:         ObjectId    // מזהה ייחודי
  user:        ObjectId    // → ref: User (required)
  workout_id:  ObjectId    // → ref: Workout (האימון שמבוצע)

  start_time:  Date        // מתי התחיל ה-session (required)
  end_time:    Date        // מתי הסתיים [optional — null בזמן אימון]

  completed_exercises: [   // תרגילים שהושלמו
    {
      exercise_id:     String  // מזהה התרגיל
      sets_completed:  Number  // כמה סטים בוצעו
      time_spent:      Number  // שניות שהוקדשו לתרגיל
    }
  ]

  total_volume:  Number    // נפח סה"כ (kg × reps × sets)
  xp_earned:     Number    // נקודות ניסיון שהורווחו
  status:        String    // 'active' | 'completed' | 'abandoned'

  createdAt:   Date
  updatedAt:   Date
  __v:         Number
}
```

---

## 🔍 מצב נוכחי בDB

```json
// Session 1 (פעיל, לא הסתיים)
{
  "status": "active",
  "start_time": "2026-02-XX",
  "end_time": null,
  "completed_exercises": [],
  "total_volume": 0,
  "xp_earned": 0
}

// Session 2 (פעיל, לא הסתיים)
{
  "status": "active",
  "start_time": "2026-03-XX",
  "end_time": null,
  "completed_exercises": [],
  "total_volume": 0,
  "xp_earned": 0
}
```

---

## ⚙️ זרימת Session

```
POST /api/workouts/session   → יצירת session חדש (status: 'active')
        ↓
LiveSession.jsx פועל בזמן אמת
(כרגע: לא מעדכן completed_exercises)
        ↓
[חסר כרגע] PUT /api/workouts/session/:id
→ עדכון completed_exercises, end_time, total_volume, xp_earned
→ status: 'completed'
→ עדכון workout.status = 'completed'
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| POST | `/api/workouts/session` | ✅ | פתיחת session חדש |
| GET | `/api/workouts/session/active` | ✅ | שליפת session פעיל |

---

## 🚧 חסר / שיפורים נדרשים

| פיצ'ר | תיאור | עדיפות |
|-------|--------|--------|
| `PUT /session/:id` | עדכון session בזמן אמת (set by set) | **קריטי** |
| `PATCH /session/:id/complete` | סיום session → completed | **קריטי** |
| Cleanup logic | סגירת sessions "active" ישנים אוטומטית | גבוהה |
| `rest_time_actual` | זמן מנוחה בפועל בין סטים | בינונית |
| `heart_rate_avg` | דופק ממוצע (אם יש wearable) | נמוכה |
| `difficulty_rating` | Easy / Hard feedback מהמשתמש | גבוהה |
| `personal_records` | PR שנשבר באימון זה | בינונית |
