# 🏋️ Trainer App — Architecture Document

> תיעוד מלא של הארכיטקטורה, ה-APIs, מסדי הנתונים, השירותים והזרימות של האפליקציה.

---

## 📋 תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [מבנה הפרויקט](#2-מבנה-הפרויקט)
3. [Frontend](#3-frontend)
4. [Backend](#4-backend)
5. [מסד הנתונים — MongoDB Schemas](#5-מסד-הנתונים--mongodb-schemas)
6. [כל ה-Routes והendpoints](#6-כל-ה-routes-וה-endpoints)
7. [שירותים חיצוניים ו-APIs](#7-שירותים-חיצוניים-ו-apis)
8. [אינטגרציית LLM (מצב נוכחי ותוכניות)](#8-אינטגרציית-llm)
9. [אימות ואבטחה](#9-אימות-ואבטחה)
10. [משתני סביבה](#10-משתני-סביבה)
11. [הרצה מקומית](#11-הרצה-מקומית)

---

## 1. סקירה כללית

אפליקציית פיטנס ותזונה אישית — "Trainer App". מאפשרת למשתמשים לקבל תוכנית אימונים ל-12 שבועות שנוצרת אוטומטית, לעקוב אחר תזונה, לקיים שיחות עם AI Coach, ולדרג העדפות מזון בממשק Tinder-like.

### Stack טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| **Frontend** | React 18 + Vite, Tailwind CSS, Radix UI, Framer Motion |
| **Routing** | react-router-dom v6 |
| **State** | React Context + TanStack React Query + useState |
| **Backend** | Node.js + Express 4 |
| **Database** | MongoDB Atlas (mongoose 8) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **Video Hosting** | Cloudinary |
| **i18n** | react-i18next (עברית + אנגלית / RTL) |
| **Charts** | Recharts |
| **Build** | Vite 6 |

---

## 2. מבנה הפרויקט

```
trainer/
├── src/                          ← Frontend (React)
│   ├── api/
│   │   ├── axios.js              ← Axios instance + interceptor
│   │   └── exerciseDb.js         ← ExerciseDB API (RapidAPI)
│   ├── components/
│   │   ├── ui/                   ← 42 Radix UI wrappers
│   │   ├── dashboard/            ← Workout cards, AI buttons, progress
│   │   ├── coach/                ← GlobalCoachFAB, GlobalCoachChat
│   │   ├── session/              ← LiveSession UI components
│   │   ├── nutrition/            ← FoodSearch, FoodSwipeGame, MealPlanCard
│   │   ├── onboarding/           ← Registration flow steps
│   │   ├── analytics/            ← Charts (strength, volume, heatmap)
│   │   ├── calendar/             ← Training calendar
│   │   └── workouts/             ← WorkoutReelsPreview
│   ├── data/
│   │   └── exerciseVideos.js     ← Cloudinary video URL mappings
│   ├── lib/
│   │   └── AuthContext.jsx       ← Auth state, JWT, login/logout
│   ├── locales/
│   │   ├── en.json               ← English translations
│   │   └── he.json               ← Hebrew translations
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Workouts.jsx
│   │   ├── WorkoutSession.jsx
│   │   ├── LiveSession.jsx
│   │   ├── NutritionDemo.jsx
│   │   ├── Analytics.jsx
│   │   └── Profile.jsx
│   ├── App.jsx                   ← Router + providers + auth guard
│   ├── Layout.jsx                ← Bottom nav, FAB, language toggle
│   ├── pages.config.js           ← Page registry (routing)
│   └── i18n.js                   ← i18n setup + RTL detection
│
├── server/                       ← Backend (Express)
│   ├── config/
│   │   └── db.js                 ← MongoDB connection
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── workoutController.js
│   │   ├── nutritionController.js
│   │   └── chatController.js
│   ├── middleware/
│   │   └── authMiddleware.js     ← JWT protect()
│   ├── models/
│   │   ├── User.js
│   │   ├── Workout.js
│   │   ├── WorkoutSession.js
│   │   ├── Exercise.js
│   │   ├── NutritionLog.js
│   │   └── ChatSummary.js
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── workoutRoutes.js
│   │   ├── exerciseRoutes.js
│   │   ├── nutritionRoutes.js
│   │   └── chatRoutes.js
│   ├── seeds/
│   │   ├── uploadToCloudinary.js       ← Script: upload MP4s to Cloudinary
│   │   └── updateExercisesWithVideos.cjs ← Script: populate Exercise.video_url
│   └── index.js                  ← Server entry point (port 5001)
│
├── public/                       ← Static assets
├── dist/                         ← Build output
├── vite.config.js
├── tailwind.config.js
├── package.json                  ← Frontend deps
└── ARCHITECTURE.md               ← this file
```

---

## 3. Frontend

### 3.1 דפים (Pages)

| דף | נתיב | תיאור |
|----|------|--------|
| `Onboarding` | `/` (mainPage) | 20+ שלבי פרופיל: גיל, מגדר, גובה, משקל, מטרה, אחוז שומן, שינה, תדירות אימונים, ניסיון, סביבה, תזונה, אלרגיות, מוטיבציה |
| `Dashboard` | `/dashboard` | תוכנית השבוע, אימון היום, preview וידאו לתרגילים. אם אין תוכנית — מייצר 12-שבועות אוטומטית |
| `LiveSession` | `/live-session` | ממשק Reels-style לביצוע אימון: coach ticker מונפש, bonus challenges, Easy/Hard feedback |
| `WorkoutSession` | `/workout-session` | ביצוע אימון עם מעקב sets/reps |
| `Workouts` | `/workouts` | היסטוריית אימונים + לוח שנה |
| `NutritionDemo` | `/nutrition-demo` | מעקב קלוריות/מאקרו, הוספת ארוחות, FoodSwipeGame (דירוג 20 מזונות), Plan Meal (AI) |
| `Analytics` | `/analytics` | גרפי strength, volume, calendar heatmap (Recharts) |
| `Profile` | `/profile` | עריכת פרופיל, הגדרות |
| `Login` | `/login` | כניסה עם אימייל/סיסמה |
| `Register` | `/register` | יצירת חשבון |

### 3.2 Auth Flow

```
משתמש פותח אפליקציה
        ↓
AuthContext.checkUserAuth()
        ↓
   יש token ב-localStorage?
   ├── כן → GET /api/users/me → מאמת token → מגדיר user
   └── לא → מפנה ל-/login

login(email, password)
        ↓
POST /api/users/login
        ↓
מקבל JWT token → שומר ב-localStorage('token')
        ↓
מגדיר user ב-AuthContext
```

**AuthContext מספק:**
- `user` — אובייקט המשתמש הנוכחי
- `isAuthenticated` — boolean
- `authError` — `{ type: 'auth_required' | 'user_not_registered', message }`
- `login()`, `register()`, `logout()`, `updateProfile()`, `navigateToLogin()`

### 3.3 API Layer

**`src/api/axios.js`**
```js
baseURL: process.env.VITE_API_URL || '/api'  // → http://localhost:5001/api

// Request interceptor:
config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`
```

**`src/api/exerciseDb.js`** (RapidAPI)
```js
baseURL: 'https://exercisedb.p.rapidapi.com'
headers: {
  'X-RapidAPI-Key': VITE_EXERCISEDB_API_KEY,
  'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
}

fetchExerciseGif(name)           // GIF בודד לפי שם
fetchAllExerciseGifs(exercises)  // GIFs מקבילים לרשימת תרגילים
```

### 3.4 FoodSwipeGame — לוגיקה

- **מאגר סטטי:** 236 מזונות עם ערכי USDA + תמונות Spoonacular CDN
- **Session:** 20 מזונות רנדומיים שעוד לא דורגו (נסנן לפי liked/disliked arrays)
- **אחרי 20 דירוגים:** סגירה אוטומטית + reload העדפות
- **אם הכל דורג:** מסך "כבר אנחנו מכירים את העדפות שלך 😊"
- **שמירה:** כל swipe → `POST /api/users/food-preference`

### 3.5 Vite Dev Proxy

```js
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:5001'  // פרוקסי ל-backend בזמן פיתוח
  }
}
```

---

## 4. Backend

### 4.1 Entry Point — `server/index.js`

```
Express app (port 5001)
├── cors()
├── express.json()
├── connectDB() → MongoDB Atlas
├── /api/users      → userRoutes
├── /api/workouts   → workoutRoutes
├── /api/exercises  → exerciseRoutes
├── /api/nutrition  → nutritionRoutes
├── /api/chat       → chatRoutes
└── GET /           → "API is running..."
```

### 4.2 Controllers

#### `userController.js`
| פונקציה | תיאור |
|---------|--------|
| `registerUser()` | יצירת משתמש + hash סיסמה + החזרת JWT |
| `loginUser()` | אימות סיסמה עם bcrypt + החזרת JWT |
| `getMe()` | פרופיל משתמש נוכחי |
| `updateProfile()` | עדכון נתוני פרופיל (merge) |
| `addFoodPreference()` | הוספה/הסרה ממערך liked_foods / disliked_foods |
| `getFoodPreferences()` | שליפת liked + disliked foods |

#### `workoutController.js`
| פונקציה | תיאור |
|---------|--------|
| `getWorkouts()` | כל האימונים של משתמש (תומך date range) |
| `setWorkout()` | יצירת אימון חדש |
| `updateWorkout()` | עדכון אימון (בדיקת בעלות) |
| `deleteWorkout()` | מחיקת אימון |
| `startSession()` | יצירת WorkoutSession פעיל |
| `getActiveSession()` | שליפת session פעיל |
| `generateWorkoutPlan()` | **יצירת תוכנית 12 שבועות** (ראו פרוט למטה) |

**`generateWorkoutPlan()` — זרימה:**
```
1. בדיקה: has_existing_plan === true? → שגיאה (כבר יש תוכנית)
2. שליפת תרגילים מה-DB לפי movement_type:
   push / pull / legs / core / cardio / full_body
   (סינון: רק תרגילים עם video_url)
3. בחירת template לפי goal:
   • muscle_gain         → PPL: Push / Pull / Legs
   • weight_loss         → Full Body Circuit / Upper+Core / Lower HIIT
   • athletic_performance → Power&Speed / Agility&Core / Functional Strength
4. חישוב: 12 שבועות × תדירות_שבועית = X אימונים
5. פיזור תאריכים החל מהיום, דילוג על שבת+ראשון (weekend)
6. יצירת Workout docs עם default_sets/reps/rest מה-Exercise model
7. עדכון user.profile.has_existing_plan = true
```

#### `nutritionController.js`
| פונקציה | תיאור |
|---------|--------|
| `getNutritionLogs()` | כל לוגי התזונה |
| `logMeal()` | רישום ארוחה |
| `getLogsByDate()` | ארוחות לתאריך ספציפי (00:00–23:59:59) |
| `generateMealPlan()` | **הצעת ארוחה rule-based** (ראו פרוט) |
| `fetchFoods()` | פרוקסי ל-OpenFoodFacts API |

**`generateMealPlan()` — לוגיקה:**
```
קלט: liked_foods, disliked_foods, קלוריות ומאקרו שנצרכו/יעד, שעה, מספר ארוחות
↓
חישוב remaining macros = goal - consumed
÷ meals_remaining = per_meal_target
↓
בחירת 2-3 מזונות מ-liked_foods (או default אם ריק)
↓
חישוב portions: 0.5x – 2x multiplier לפי קלוריות
↓
שם ארוחה לפי שעה:
  < 10:00 → "Morning Fuel"
  < 14:00 → "Midday Power Plate"
  < 18:00 → "Afternoon Boost"
  < 21:00 → "Evening Recovery"
↓
הערת coach לפי goal (muscle_gain / weight_loss / recomp / athletic_performance)
↓
פלט: { meal_name, foods[], totals{calories, protein, carbs, fat}, coach_note }
```

#### `chatController.js`
| פונקציה | תיאור |
|---------|--------|
| `generateResponse()` | **⚠️ Mock — rule-based (עוד לא LLM אמיתי)** |
| `getSummaries()` | שליפת היסטוריית שיחות |
| `createSummary()` | שמירת שיחה |

---

## 5. מסד הנתונים — MongoDB Schemas

### `User`
```js
{
  name: String (required)
  email: String (required, unique)
  password: String (hashed, bcrypt salt:10)

  profile: {
    age: Number
    gender: 'male' | 'female' | 'other'
    height: Number       // cm
    weight: Number       // kg
    goal: 'weight_loss' | 'muscle_gain' | 'recomp' | 'athletic_performance'
    body_fat_percentage: Number
    injuries: String
    experience_level: 'beginner' | 'intermediate' | 'advanced'
    workout_days_per_week: Number
    session_duration: 30 | 60 | 90    // minutes
    environment: 'commercial_gym' | 'home_gym' | 'bodyweight_park'
    diet_type: 'everything' | 'vegan' | 'vegetarian' | 'keto' | 'paleo'
    allergies: String
    meal_frequency: Number
    activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
    sleep_hours: Number
    past_obstacles: String
    motivation_source: String
    tdee: Number                      // Total Daily Energy Expenditure
    target_calories: Number
    protein_goal: Number              // grams
    carbs_goal: Number                // grams
    fat_goal: Number                  // grams
    trainer_personality: 'drill_sergeant' | 'scientist' | 'zen_coach'
    onboarding_completed: Boolean
    has_existing_plan: Boolean        // מונע כפל בגנרציית תוכנית
  }

  liked_foods: [{ name, image, calories, protein, carbs, fat }]
  disliked_foods: [{ name }]

  timestamps: true
}
```

### `Workout`
```js
{
  user: ObjectId → User
  date: Date (required)
  muscle_group: String        // 'Push' | 'Pull' | 'Legs' | ...

  exercises: [{
    id: String
    name: String
    sets: Number
    reps: String              // '8-12'
    weight: Number            // kg (0 = bodyweight)
    rest_seconds: Number
    notes: String
  }]

  status: 'planned' | 'in_progress' | 'completed'
  duration_minutes: Number
  total_volume: Number        // sets × reps × weight
  notes: String
  timestamps: true
}
```

### `WorkoutSession`
```js
{
  user: ObjectId → User
  workout_id: ObjectId → Workout
  start_time: Date
  end_time: Date

  completed_exercises: [{
    exercise_id: String
    sets_completed: Number
    time_spent: Number        // seconds
  }]

  total_volume: Number
  xp_earned: Number
  status: 'active' | 'completed' | 'abandoned'
  timestamps: true
}
```

### `Exercise`
```js
{
  name: String (required, unique)
  name_he: String             // תרגום עברי

  muscle_group: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'full_body'
  equipment: String           // 'barbell' | 'dumbbell' | ...

  // ExerciseDB fields
  body_part: String
  target: String              // primary muscle
  secondary_muscles: [String]
  instructions: [String]
  difficulty: 'beginner' | 'intermediate' | 'advanced' | ''

  // Media
  gif_url: String             // ExerciseDB fallback GIF
  video_url: String           // Cloudinary (גברים)
  video_url_women: String     // Cloudinary (נשים)
  gif_verified: Boolean

  // Workout generation
  default_sets: Number        // default: 3
  default_reps: String        // default: '8-12'
  rest_seconds: Number        // default: 90
  movement_type: 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'full_body'

  alternatives: [String]      // שמות תרגילים חלופיים
  timestamps: true
}
```

### `NutritionLog`
```js
{
  user: ObjectId → User
  date: Date
  meal_name: String           // 'Morning Fuel' | 'Midday Power Plate' | ...
  calories: Number
  protein: Number             // grams
  carbs: Number               // grams
  fat: Number                 // grams

  foods: [{ name, portion, calories }]
  timestamps: true
}
```

### `ChatSummary`
```js
{
  user: ObjectId → User
  user_request: String
  ai_response: String
  context: String             // 'Dashboard' | 'Nutrition' | ...
  timestamps: true
}
```

---

## 6. כל ה-Routes וה-Endpoints

### Users — `/api/users`

| Method | Endpoint | Auth | Controller | תיאור |
|--------|----------|------|-----------|--------|
| POST | `/api/users` | ❌ | `registerUser` | יצירת חשבון |
| POST | `/api/users/login` | ❌ | `loginUser` | כניסה |
| GET | `/api/users/me` | ✅ | `getMe` | פרופיל נוכחי |
| PUT | `/api/users/profile` | ✅ | `updateProfile` | עדכון פרופיל |
| POST | `/api/users/food-preference` | ✅ | `addFoodPreference` | like/dislike מזון |
| GET | `/api/users/food-preferences` | ✅ | `getFoodPreferences` | שליפת העדפות |

### Workouts — `/api/workouts`

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| GET | `/api/workouts` | ✅ | כל האימונים (תומך ?startDate=&endDate=) |
| POST | `/api/workouts` | ✅ | יצירת אימון |
| POST | `/api/workouts/generate` | ✅ | יצירת תוכנית 12 שבועות |
| DELETE | `/api/workouts/reset` | ✅ | איפוס תוכנית |
| POST | `/api/workouts/session` | ✅ | התחלת session |
| GET | `/api/workouts/session/active` | ✅ | session פעיל |
| GET | `/api/workouts/:id` | ✅ | אימון בודד |
| PUT | `/api/workouts/:id` | ✅ | עדכון אימון |
| DELETE | `/api/workouts/:id` | ✅ | מחיקת אימון |

### Exercises — `/api/exercises`

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| GET | `/api/exercises` | ✅ | כל התרגילים (?muscle_group=) |
| GET | `/api/exercises/lookup` | ✅ | חיפוש fuzzy לפי שם (?name=) — 4-tier matching |
| GET | `/api/exercises/:id` | ✅ | תרגיל בודד |

**Fuzzy search 4 רמות:**
1. התאמה מדויקת (case insensitive)
2. צורת יחיד (strip `-s`/`-es`)
3. חיפוש partial
4. דירוג לפי מילים משותפות

### Nutrition — `/api/nutrition`

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| GET | `/api/nutrition` | ✅ | כל הלוגים |
| POST | `/api/nutrition` | ✅ | רישום ארוחה |
| GET | `/api/nutrition/date/:date` | ✅ | ארוחות לתאריך (YYYY-MM-DD) |
| POST | `/api/nutrition/meal-plan` | ✅ | הצעת ארוחה rule-based |
| POST | `/api/nutrition/foods` | ✅ | חיפוש מזון (proxy → OpenFoodFacts) |

### Chat — `/api/chat`

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| POST | `/api/chat/response` | ✅ | תגובת AI Coach (⚠️ mock כרגע) |
| GET | `/api/chat/summaries` | ✅ | היסטוריית שיחות |
| POST | `/api/chat/summaries` | ✅ | שמירת שיחה |

---

## 7. שירותים חיצוניים ו-APIs

### 7.1 Cloudinary — Video Hosting

**שימוש:** אחסון סרטוני הדגמה לתרגילים (גברים + נשים)

```
Cloud Name: dgmgsqam5
CDN URL:    https://res.cloudinary.com/dgmgsqam5/video/upload
```

**ניהול:**
- `server/seeds/uploadToCloudinary.js` — script להעלאת MP4 מהמחשב
- `src/data/exerciseVideos.js` — מיפוי public_id → exercise slug
- כל תרגיל יכול לקבל `video_url` (גברים) ו-`video_url_women`

**Env keys:**
```
CLOUDINARY_CLOUD_NAME=dgmgsqam5
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

### 7.2 ExerciseDB (RapidAPI)

**שימוש:** GIFים של תרגילים (fallback כשאין Cloudinary video)

```
Base URL: https://exercisedb.p.rapidapi.com
Header:   X-RapidAPI-Key: {VITE_EXERCISEDB_API_KEY}
```

**קריאות Frontend:**
```js
// src/api/exerciseDb.js
GET /exercises/name/{name}?limit=1   → GIF URL לתרגיל
```

**Env key:** `VITE_EXERCISEDB_API_KEY`

---

### 7.3 OpenFoodFacts (Public API)

**שימוש:** חיפוש מזון בדף תזונה (דרך backend proxy)

```
Endpoint: https://world.openfoodfacts.org/cgi/search.pl
Params:   search_terms, json=1, page_size=3
          fields=product_name,image_front_url,nutriments,brands
Timeout:  8000ms
```

**⚠️ הערה:** ה-API חוסם לעתים קרובות קריאות מ-Node.js. כרגע הדף משתמש במאגר סטטי (236 מזונות) ב-FoodSwipeGame.

---

### 7.4 Spoonacular CDN (Static Images)

**שימוש:** תמונות מזון ב-FoodSwipeGame

```
CDN: https://spoonacular.com/cdn/ingredients_500x500/{name}.jpg
```
אין API key נדרש — תמונות ציבוריות. כ-150 URL מאומתים בודדים מוטמעים ב-FoodSwipeGame.

---

### 7.5 Pexels API (זמין, לא בשימוש פעיל)

```
API Key: PEXELS_API_KEY (ב-.env)
```
זמין לשימוש עתידי לתמונות.

---

## 8. אינטגרציית LLM

### מצב נוכחי — Mock בלבד

`chatController.js → generateResponse()` — **לא מחובר ל-LLM אמיתי**. משתמש במיפוי מילות מפתח:

```js
// קריאת מזון/תזונה → תשובת תזונה
// קריאת אימון/ספורט → תשובת אימון
// עייפות/מנוחה → תשובת התאוששות
// + מודולציה לפי coach style (drill_sergeant / scientist / zen_coach)
```

### תוכנית לאינטגרציה אמיתית

```
1. הוסף לserver/.env:
   OPENAI_API_KEY=sk-...
   או
   ANTHROPIC_API_KEY=sk-ant-...

2. התקן:
   npm install openai
   או
   npm install @anthropic-ai/sdk

3. ב-chatController.js → generateResponse():
   - בנה system prompt עם:
     • פרופיל המשתמש (goal, experience, diet_type)
     • coach style (drill_sergeant / scientist / zen_coach)
     • context (Nutrition / Dashboard / Workouts)
     • liked_foods, workout history
   - שלח לאנתרופיק (claude-sonnet-4-6) או OpenAI (gpt-4o)
   - הצע streaming לחוויית משתמש טובה יותר

// Prompt מוכן לשימוש:
const systemPrompt = `
  You are a ${coachStyle} fitness coach.
  User goal: ${user.profile.goal}
  Experience: ${user.profile.experience_level}
  Context: ${context}
  Respond in ${language}, concise, motivational.
`
```

---

## 9. אימות ואבטחה

### JWT Flow
```
Register/Login → bcrypt.hash(password, 10)
              → jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' })
              → token נשמר ב-localStorage('token')

כל בקשה מוגנת → Authorization: Bearer {token}
              → jwt.verify(token, JWT_SECRET)
              → req.user = await User.findById(id).select('-password')
```

### Middleware
- **`protect()`** — בודק Authorization header, מאמת JWT, מחזיר 401 אם לא תקין
- **CORS** — מופעל על כל ה-backend (`cors()`)
- **express.json()** — parsing של request body

---

## 10. משתני סביבה

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:5001/api
VITE_EXERCISEDB_API_KEY=<rapidapi_key>
PEXELS_API_KEY=<pexels_key>
```

### Backend (`server/.env`)
```env
PORT=5001
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/trainer
JWT_SECRET=<secret_key>

CLOUDINARY_CLOUD_NAME=dgmgsqam5
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
CLOUDINARY_URL=cloudinary://<key>:<secret>@dgmgsqam5

# עתידי — LLM
OPENAI_API_KEY=sk-...
# או
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 11. הרצה מקומית

```bash
# התקנת dependencies
npm install
cd server && npm install && cd ..

# הרצת Frontend + Backend ביחד
npm run dev:full

# הרצה נפרדת
npm run dev        # Frontend → http://localhost:5173
npm run server     # Backend  → http://localhost:5001

# Build לייצור
npm run build
```

### Scripts נוספים (Backend)
```bash
# העלאת ויאו לCloudinary
node server/seeds/uploadToCloudinary.js ~/Downloads

# עדכון Exercise collection עם video URLs
node server/seeds/updateExercisesWithVideos.cjs
```

---

## נספח — תרשים ארכיטקטורה

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                    │
│                                                         │
│  React 18 + Vite                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Dashboard │  │Nutrition │  │Analytics │  ...          │
│  └────┬─────┘  └────┬─────┘  └──────────┘              │
│       │              │                                   │
│  ┌────▼──────────────▼────────────────┐                 │
│  │     axios.js (Bearer token)        │                 │
│  └────────────────┬───────────────────┘                 │
└───────────────────┼─────────────────────────────────────┘
                    │ HTTP /api/*
┌───────────────────▼─────────────────────────────────────┐
│                  EXPRESS SERVER (5001)                   │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐      │
│  │  /users  │ │/workouts │ │  /chat │ │/nutrition│     │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └────┬────┘      │
│       │             │            │            │          │
│  ┌────▼─────────────▼────────────▼────────────▼──────┐  │
│  │          Controllers + authMiddleware              │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                  │
│  ┌────────────────────▼───────────────────────────────┐  │
│  │              Mongoose ODM                          │  │
│  └────────────────────┬───────────────────────────────┘  │
└───────────────────────┼──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│              MongoDB Atlas (trainer DB)                   │
│                                                          │
│  Users  Workouts  WorkoutSessions  Exercises             │
│  NutritionLogs   ChatSummaries                          │
└──────────────────────────────────────────────────────────┘

External Services:
┌──────────────┐  ┌──────────────┐  ┌─────────────────┐
│  Cloudinary  │  │  ExerciseDB  │  │  OpenFoodFacts  │
│ (videos CDN) │  │  (RapidAPI)  │  │  (food search)  │
└──────────────┘  └──────────────┘  └─────────────────┘
```

---

*עודכן לאחרונה: מרץ 2026*
