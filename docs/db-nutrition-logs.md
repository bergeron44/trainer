# 🥗 Collection: `nutritionlogs`

> רישום יומי של ארוחות וצריכת מאקרו.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 0 |
| **משתמשים עם לוגים** | 0 |

> ⚠️ הcollection ריקה — הUI קיים (NutritionDemo) אבל המשתמשים לא רושמים ארוחות לDB.
> הנתונים מוצגים כרגע **locally בזיכרון React** בלבד, ולא נשמרים.

---

## 🗂️ Schema — שדות

```js
{
  _id:       ObjectId    // מזהה ייחודי
  user:      ObjectId    // → ref: User (required)
  date:      Date        // תאריך הארוחה (required)
  meal_name: String      // שם תקופת הארוחה (required)
                         // 'Morning Fuel' | 'Midday Power Plate' |
                         // 'Afternoon Boost' | 'Evening Recovery'

  // מאקרו כולל לארוחה
  calories:  Number      // קלוריות (required)
  protein:   Number      // גרם חלבון
  carbs:     Number      // גרם פחמימות
  fat:       Number      // גרם שומן

  // פירוט מזונות
  foods: [
    {
      name:     String   // שם המזון — 'Chicken Breast'
      portion:  String   // גודל מנה — '200g' | '1 cup'
      calories: Number   // קלוריות למנה זו
    }
  ]

  createdAt:  Date
  updatedAt:  Date
  __v:        Number
}
```

---

## 🔍 דוגמה — לוג ארוחה מתוכנן

```json
{
  "date": "2026-03-03",
  "meal_name": "Morning Fuel",
  "calories": 520,
  "protein": 42,
  "carbs": 45,
  "fat": 15,
  "foods": [
    { "name": "Eggs",           "portion": "3 large",  "calories": 210 },
    { "name": "Oatmeal",        "portion": "80g",       "calories": 280 },
    { "name": "Almond Butter",  "portion": "1 tbsp",    "calories": 98  }
  ]
}
```

---

## ⚙️ generateMealPlan — לוגיקה

```
POST /api/nutrition/meal-plan
        ↓
קלט:
  liked_foods[]         ← מ-user.liked_foods
  disliked_foods[]      ← לסינון
  current_calories_consumed
  target_calories
  protein/carbs/fat goals & consumed
  time_of_day (HH:mm)
  meal_period (Breakfast/Lunch/...)
  meals_eaten_today
  total_meals_planned
  diet_type
  goal
        ↓
חישוב remaining = target - consumed
per_meal_target = remaining ÷ meals_remaining
        ↓
בחירת 2-3 מזונות מ-liked_foods
חישוב portions (0.5x – 2x multiplier)
        ↓
שם ארוחה לפי שעה:
  < 10:00  → "Morning Fuel"
  < 14:00  → "Midday Power Plate"
  < 18:00  → "Afternoon Boost"
  < 21:00  → "Evening Recovery"
  > 21:00  → "Late Night Casein"
        ↓
coach note לפי goal:
  muscle_gain → "High protein window! 💪"
  weight_loss → "Stay in deficit! 🔥"
  recomp      → "Balance is key! ⚖️"
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| GET | `/api/nutrition` | ✅ | כל הלוגים של המשתמש |
| POST | `/api/nutrition` | ✅ | רישום ארוחה חדשה |
| GET | `/api/nutrition/date/:date` | ✅ | ארוחות לתאריך (YYYY-MM-DD) |
| POST | `/api/nutrition/meal-plan` | ✅ | קבלת הצעת ארוחה |
| POST | `/api/nutrition/foods` | ✅ | חיפוש מזון (proxy → OpenFoodFacts) |

---

## 🚧 מה חסר / שיפורים נדרשים

| בעיה/שיפור | תיאור | עדיפות |
|-----------|--------|--------|
| **חיבור שמירה לDB** | כרגע הארוחות נשמרות רק בזיכרון React | **קריטי** |
| `water_ml` | מעקב שתיית מים | גבוהה |
| `meal_photo` | תמונה של הארוחה (Cloudinary) | בינונית |
| `barcode_scan` | סריקת ברקוד למוצר | נמוכה |
| `weekly_summary` | סיכום שבועי מאקרו | גבוהה |
| `streak` | רצף של ימי מעקב | בינונית |
| קישור ל-Workout | "אכלת X לפני אימון Y" | גבוהה |
