function formatFavoriteFoods(foods = []) {
    if (!Array.isArray(foods) || foods.length === 0) return 'none';
    return foods
        .slice(0, 20)
        .map((food) => (
            `${food.name} (${food.calories || 0} kcal/100g, P:${food.protein || 0} C:${food.carbs || 0} F:${food.fat || 0})`
        ))
        .join('\n');
}

function formatDislikedFoods(foods = []) {
    if (!Array.isArray(foods) || foods.length === 0) return 'none';
    return foods
        .slice(0, 20)
        .map((food) => String(food?.name || '').trim())
        .filter(Boolean)
        .join(', ');
}

function buildAllowedMealPeriodsText() {
    return [
        '2 meals: ["First Meal", "Final Feast"]',
        '3 meals: ["Morning Fuel", "Midday Recharger", "Evening Recovery"]',
        '4 meals: ["Breakfast", "Lunch", "Pre-Workout Snack", "Dinner"]',
        '5 meals: ["Early Kickoff", "Mid-Morning Snack", "Lunch", "Afternoon Fuel", "Dinner"]',
        '6 meals: ["Early Kickoff", "Mid-Morning Snack", "Lunch", "Afternoon Fuel", "Dinner", "Evening Snack"]',
    ].join('\n');
}

function buildOnboardingNutritionMenuSystem() {
    return [
        'You are the onboarding nutrition menu planner.',
        'Design a full-day meal menu for one user.',
        'Choose between 2 and 6 meal-times per day based on the user profile.',
        'For each meal-time, generate 3 or 4 distinct full meal options.',
        'Reason internally and return that reasoning only inside the JSON "reasoning" object.',
        'Do not include any explanation outside the JSON response.',
        'Use food names in English.',
        'Respect diet type, calorie target, macro targets, liked foods, and disliked foods.',
        'Use realistic portions and realistic macro totals.',
        'You must use the exact allowed meal_period labels for the chosen meal count.',
        'Return valid JSON only.',
    ].join('\n');
}

function buildOnboardingNutritionMenuUserMessage({
    profile = {},
    likedFoods = [],
    dislikedFoods = [],
    targets = {},
}) {
    return `Create the user's onboarding nutrition menu.

User profile:
- Goal: ${profile.goal || 'recomp'}
- Diet type: ${profile.diet_type || 'everything'}
- Activity level: ${profile.activity_level || 'unknown'}
- Experience level: ${profile.experience_level || 'unknown'}
- Weight: ${profile.weight || 'unknown'} kg
- Sleep: ${profile.sleep_hours || 'unknown'} hours
- Existing meal frequency preference: ${profile.meal_frequency || 'not provided'}

Daily targets:
- Calories: ${targets.targetCalories || 2000}
- Protein: ${targets.proteinGoal || 150}g
- Carbs: ${targets.carbsGoal || 200}g
- Fat: ${targets.fatGoal || 65}g

Liked foods:
${formatFavoriteFoods(likedFoods)}

Disliked foods:
${formatDislikedFoods(dislikedFoods)}

Allowed meal-period sets:
${buildAllowedMealPeriodsText()}

Return this exact JSON shape:
{
  "reasoning": {
    "meal_count": 0,
    "meal_count_rationale": "short internal rationale",
    "option_count": 0,
    "option_count_rationale": "short internal rationale",
    "notes": ["short internal notes"]
  },
  "meal_periods": [
    {
      "meal_period": "Breakfast",
      "options": [
        {
          "meal_name": "Meal option name",
          "foods": [
            { "name": "Food name", "portion": "Xg", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
          ],
          "total_calories": 0,
          "total_protein": 0,
          "total_carbs": 0,
          "total_fat": 0
        }
      ]
    }
  ]
}`;
}

module.exports = {
    buildOnboardingNutritionMenuSystem,
    buildOnboardingNutritionMenuUserMessage,
};
