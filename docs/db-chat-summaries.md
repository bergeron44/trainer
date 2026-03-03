# 💬 Collection: `chatsummaries`

> היסטוריית שיחות עם ה-AI Coach.

---

## 📊 סטטיסטיקות נוכחיות

| מדד | ערך |
|-----|-----|
| **סה"כ documents** | 0 |

> ⚠️ הcollection ריקה — ה-AI Coach כרגע mock (rule-based), לא LLM אמיתי.
> ברגע שיחובר LLM אמיתי, כל שיחה תישמר כאן.

---

## 🗂️ Schema — שדות

```js
{
  _id:           ObjectId   // מזהה ייחודי
  user:          ObjectId   // → ref: User (required)
  user_request:  String     // הודעת המשתמש (required)
  ai_response:   String     // תגובת ה-AI (required)
  context:       String     // עמוד/הקשר — 'Dashboard' | 'Nutrition' | 'Workouts' | 'General'

  createdAt:     Date
  updatedAt:     Date
  __v:           Number
}
```

---

## 🔍 דוגמה עתידית

```json
{
  "user_request": "מה כדאי לאכול לפני אימון רגליים?",
  "ai_response": "לפני אימון רגליים, אני ממליץ על ארוחה עם 40-60g פחמימות ו-20-30g חלבון, כ-90 דקות לפני האימון. נסה אורז עם חזה עוף, או בטטה עם ביצים. 💪",
  "context": "Nutrition",
  "createdAt": "2026-03-03T09:00:00Z"
}
```

---

## ⚙️ מצב נוכחי — Mock Coach

```js
// chatController.js → generateResponse()
// לא מחובר ל-LLM אמיתי!

// לוגיקה נוכחית:
if (prompt.includes('nutrition') || prompt.includes('eat')) {
  response = "Nutrition is key! 🍎 Focus on whole foods..."
}
if (prompt.includes('workout') || prompt.includes('exercise')) {
  response = "Training smart is everything! 💪..."
}

// Coach styles:
drill_sergeant → ALL CAPS + "NO EXCUSES!"
spicy          → "Don't slack off now! 🔥"
zen_coach      → calm, balanced tone
```

---

## 🔮 תוכנית אינטגרציית LLM

```js
// לחיבור Claude/OpenAI:

const systemPrompt = `
  You are a ${coachStyle} fitness coach named NEXUS.

  User profile:
    Goal: ${user.profile.goal}
    Experience: ${user.profile.experience_level}
    Diet: ${user.profile.diet_type}
    Liked foods: ${user.liked_foods.map(f => f.name).join(', ')}

  Context: ${context}
  Language: Hebrew (respond in Hebrew unless asked otherwise)

  Be concise, motivational, and specific to the user's data.
`;

// Claude API:
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
  system: systemPrompt,
  messages: [{ role: 'user', content: prompt }]
});
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | תיאור |
|--------|----------|------|--------|
| POST | `/api/chat/response` | ✅ | שאל את ה-AI Coach |
| GET | `/api/chat/summaries` | ✅ | כל השיחות הקודמות |
| POST | `/api/chat/summaries` | ✅ | שמירת שיחה ידנית |

### Request Body — `/api/chat/response`
```json
{
  "prompt": "מה כדאי לאכול לפני אימון?",
  "context": "Nutrition",
  "coachStyle": "drill_sergeant"
}
```

---

## 🚧 שיפורים נדרשים

| שיפור | תיאור | עדיפות |
|-------|--------|--------|
| **חיבור LLM אמיתי** | Claude Sonnet / GPT-4o | **קריטי** |
| Streaming | תגובה מדורגת (typing effect) | גבוהה |
| Thread / conversation | זיכרון שיחה (history) | גבוהה |
| RAG על נתוני משתמש | AI עם גישה לאימונים/תזונה אמיתיים | גבוהה |
| Push notifications | "זמן להתאמן!" | נמוכה |
| Voice input | הקלטת שאלה קולית | נמוכה |
