const PERSONALITY_DESC = {
    drill_sergeant: 'an intense military drill sergeant — demanding, blunt, no excuses',
    drill_sergeant_coach: 'an intense military drill sergeant — demanding, blunt, no excuses',
    scientist: 'an analytical sports nutritionist — data-driven, precise, evidence-based',
    scientist_coach: 'an analytical sports nutritionist — data-driven, precise, evidence-based',
    nutritionist: 'an analytical sports nutritionist — data-driven, precise, evidence-based',
    zen_coach: 'a calm and balanced wellness coach — supportive, mindful, holistic',
};

/**
 * Build system prompt for meal generation
 */
function buildMealSystem(user) {
    const p = user.profile || {};
    const personality = PERSONALITY_DESC[p.trainer_personality] || PERSONALITY_DESC.zen_coach;

    return `You are NEXUS, ${personality}.

User profile:
- Goal: ${p.goal || 'recomp'}
- Diet: ${p.diet_type || 'everything'}
- Daily targets: ${p.target_calories || 2000} kcal | ${p.protein_goal || 150}g protein | ${p.carbs_goal || 200}g carbs | ${p.fat_goal || 65}g fat

Rules:
- Respond ONLY with valid JSON — no markdown, no extra text, no explanation
- Food names in English
- coach_note in Hebrew (short, motivational, 1 sentence)
- Choose real foods that fit the user's diet type
- Portions must be realistic (grams/units)`;
}

/**
 * Build user message for meal generation
 */
function buildMealUserMessage(data) {
    const {
        remaining,
        per_meal_target,
        liked_foods = [],
        disliked_foods = [],
        time_of_day = '12:00',
        meal_period = 'Lunch',
        meals_remaining = 2,
    } = data;

    const likedList = liked_foods.slice(0, 20).map(f => `${f.name} (${f.calories}kcal/100g, P:${f.protein}g C:${f.carbs}g F:${f.fat}g)`).join('\n');
    const dislikedList = disliked_foods.slice(0, 10).join(', ');

    return `Generate my next meal now.

Time: ${time_of_day} | Period: ${meal_period} | Meals remaining today: ${meals_remaining}

Remaining macros I still need today:
- Calories: ${Math.max(0, remaining.calories)} kcal
- Protein: ${Math.max(0, remaining.protein)}g
- Carbs: ${Math.max(0, remaining.carbs)}g
- Fat: ${Math.max(0, remaining.fat)}g

Target for THIS meal (~${Math.max(0, per_meal_target.calories)} kcal):
- Protein: ~${Math.max(0, per_meal_target.protein)}g
- Carbs: ~${Math.max(0, per_meal_target.carbs)}g
- Fat: ~${Math.max(0, per_meal_target.fat)}g

My liked foods (prefer these):
${likedList || 'Any healthy foods'}

Foods I dislike (avoid): ${dislikedList || 'none'}

Respond with this exact JSON structure:
{
  "meal_name": "Creative name for this meal",
  "foods": [
    { "name": "Food name", "portion": "Xg", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0,
  "coach_note": "משפט מוטיבציה קצר בעברית"
}`;
}

module.exports = { buildMealSystem, buildMealUserMessage };
