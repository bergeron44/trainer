# 👤 Collection: `users`

> מכיל את כל המשתמשים הרשומים, הפרופיל האישי, נתוני תזונה ומטרות.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ משתמשים** | 2 |
| **עם onboarding שהושלם** | 2 (100%) |
| **עם תוכנית אימונים** | 1 (Ron) |
| **עם העדפות מזון** | 1 (Ron — 62 liked, 35 disliked) |

### המשתמשים הנוכחיים

| שם | אימייל | מטרה | מגדר | ניסיון | תוכנית |
|----|--------|------|------|--------|--------|
| Ron berger | ronberger40@gmail.com | recomp | male | advanced | ✅ |
| אורי | aurh10@gmail.com | recomp | male | intermediate | ❌ |

---

## 🗂️ Schema — שדות

```js
{
  _id:      ObjectId   // מזהה ייחודי (MongoDB auto)
  name:     String     // שם מלא (required)
  email:    String     // אימייל (required, unique)
  password: String     // hash bcrypt (salt: 10) — לא נחשף ב-API

  // ─── פרופיל אישי ───────────────────────────────
  profile: {
    // פיזי
    age:                  Number   // גיל בשנים
    gender:               String   // 'male' | 'female' | 'other'
    height:               Number   // גובה בס"מ
    weight:               Number   // משקל בק"ג
    body_fat_percentage:  Number   // אחוז שומן גוף

    // מטרה ואימון
    goal:                     String  // 'weight_loss' | 'muscle_gain' | 'recomp' | 'athletic_performance'
    experience_level:         String  // 'beginner' | 'intermediate' | 'advanced'
    workout_days_per_week:    Number  // 2–6 ימים
    session_duration:         Number  // 30 | 60 | 90 דקות
    environment:              String  // 'commercial_gym' | 'home_gym' | 'bodyweight_park'
    injuries:                 String  // פציעות/מגבלות טקסט חופשי

    // תזונה
    diet_type:        String  // 'everything' | 'vegan' | 'vegetarian' | 'keto' | 'paleo'
    allergies:        String  // אלרגיות (טקסט חופשי)
    meal_frequency:   Number  // ארוחות ביום

    // אורח חיים
    activity_level:   String  // 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
    sleep_hours:      Number  // שעות שינה ממוצעות
    past_obstacles:   String  // מכשולים עבר (טקסט חופשי)
    motivation_source:String  // מקור מוטיבציה (טקסט חופשי)

    // מדדים מחושבים (בעת onboarding)
    tdee:             Number  // Total Daily Energy Expenditure (קלוריות/יום)
    target_calories:  Number  // יעד קלורי יומי
    protein_goal:     Number  // יעד חלבון (גרם/יום)
    carbs_goal:       Number  // יעד פחמימות (גרם/יום)
    fat_goal:         Number  // יעד שומן (גרם/יום)

    // AI Coach
    trainer_personality: String  // 'drill_sergeant' | 'scientist' | 'zen_coach'

    // דגלים
    onboarding_completed: Boolean  // האם סיים onboarding
    has_existing_plan:    Boolean  // האם יש תוכנית 12-שבועות פעילה
  }

  // ─── העדפות מזון ───────────────────────────────
  liked_foods: [
    {
      name:     String  // 'Chicken Breast'
      image:    String  // URL תמונה
      calories: Number  // קלוריות ל-100g
      protein:  Number  // גרם חלבון
      carbs:    Number  // גרם פחמימות
      fat:      Number  // גרם שומן
    }
  ]

  disliked_foods: [
    { name: String }   // רק שם — לא צריך נתונים מלאים
  ]

  createdAt:  Date
  updatedAt:  Date
  __v:        Number
}
```

---

## 🔍 דוגמה — Ron (משתמש מלא)

```json
{
  "name": "Ron berger",
  "email": "ronberger40@gmail.com",
  "profile": {
    "age": 27,
    "gender": "male",
    "height": 178,
    "weight": 80,
    "body_fat_percentage": 15,
    "goal": "recomp",
    "experience_level": "advanced",
    "workout_days_per_week": 4,
    "session_duration": 60,
    "environment": "commercial_gym",
    "diet_type": "everything",
    "activity_level": "moderately_active",
    "sleep_hours": 7,
    "tdee": 2800,
    "target_calories": 2800,
    "protein_goal": 180,
    "carbs_goal": 250,
    "fat_goal": 80,
    "trainer_personality": "drill_sergeant",
    "onboarding_completed": true,
    "has_existing_plan": true
  },
  "liked_foods": [ /* 62 מזונות */ ],
  "disliked_foods": [ /* 35 מזונות */ ]
}
```

---

## ⚙️ חישוב TDEE ומאקרו

```
TDEE = BMR × Activity Multiplier

BMR (Mifflin-St Jeor):
  גבר: (10 × weight) + (6.25 × height) − (5 × age) + 5
  אישה: (10 × weight) + (6.25 × height) − (5 × age) − 161

Activity Multipliers:
  sedentary         → ×1.2
  lightly_active    → ×1.375
  moderately_active → ×1.55
  very_active       → ×1.725

Target Calories לפי goal:
  weight_loss   → TDEE − 300  (גירעון)
  muscle_gain   → TDEE + 300  (עודף)
  recomp        → TDEE         (תחזוקה)
  athletic      → TDEE + 200

Macro split:
  protein: weight × 2.0–2.2 g/kg
  fat:     target_calories × 25% ÷ 9
  carbs:   שאר הקלוריות ÷ 4
```

---

## 🔒 אבטחה

- **סיסמה:** מאוחסנת כ-bcrypt hash (salt: 10) — לעולם לא מוחזרת ב-API
- **JWT:** `{ id }` → נחתם עם `JWT_SECRET`, תפוגה 30 יום
- **הגנת endpoint:** כל route מלבד register/login דורש Bearer token

---

## 📡 API Endpoints

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| POST | `/api/users` | ❌ | הרשמה |
| POST | `/api/users/login` | ❌ | כניסה → מחזיר token |
| GET | `/api/users/me` | ✅ | פרופיל נוכחי |
| PUT | `/api/users/profile` | ✅ | עדכון פרופיל (merge) |
| POST | `/api/users/food-preference` | ✅ | `{ food, action: 'like'|'dislike' }` |
| GET | `/api/users/food-preferences` | ✅ | `{ liked_foods, disliked_foods }` |

---

## 🚧 שדות חסרים / שיפורים אפשריים

| שדה | תיאור | עדיפות |
|-----|--------|--------|
| `profile.phone` | מספר טלפון | נמוכה |
| `profile.profile_image` | תמונת פרופיל (Cloudinary) | בינונית |
| `profile.measurements` | מדידות גוף (chest, waist, hips) | גבוהה |
| `profile.progress_photos` | תמונות התקדמות | בינונית |
| `profile.weekly_check_in` | סטטוס שבועי (weight, mood) | גבוהה |
| `notification_settings` | הגדרות התראות | נמוכה |
| `subscription_tier` | free | premium | נמוכה |
