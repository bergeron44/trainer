function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function roundNumber(value, digits = 0) {
    const multiplier = 10 ** digits;
    return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveMealCount(profile = {}) {
    const explicitMealFrequency = Number.parseInt(profile.meal_frequency, 10);
    if (Number.isFinite(explicitMealFrequency)) {
        return Math.min(7, Math.max(2, explicitMealFrequency));
    }

    const goal = normalizeText(profile.goal);
    const dietType = normalizeText(profile.diet_type);

    let numMeals = 5;
    if (goal === 'muscle_gain') numMeals = 6;
    if (goal === 'weight_loss') numMeals = 3;
    if (dietType === 'keto') numMeals = Math.max(2, numMeals - 1);

    return Math.max(2, Math.min(7, numMeals));
}

function buildMealPeriods(profile = {}) {
    const mealCount = resolveMealCount(profile);

    if (mealCount === 2) return ['First Meal', 'Final Feast'];
    if (mealCount === 3) return ['Morning Fuel', 'Midday Recharger', 'Evening Recovery'];
    if (mealCount === 4) return ['Breakfast', 'Lunch', 'Pre-Workout Snack', 'Dinner'];
    if (mealCount === 5) return ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner'];
    if (mealCount === 6) {
        return ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner', 'Evening Snack'];
    }

    return [
        'Early Kickoff',
        'Mid-Morning Snack',
        'Lunch',
        'Afternoon Fuel',
        'Dinner',
        'Post-Workout Shake',
        'Late Night Casein',
    ];
}

function buildFallbackNutritionTargets(profile = {}) {
    const weight = clampNumber(profile.weight, 35, 250, 75);
    const goal = normalizeText(profile.goal);
    const targetCalories = clampNumber(
        profile.target_calories || profile.tdee,
        1200,
        6000,
        goal === 'muscle_gain' ? 2800 : goal === 'weight_loss' ? 1900 : 2400
    );
    const proteinGoal = clampNumber(profile.protein_goal, 60, 320, roundNumber(weight * 2));
    const fatGoal = clampNumber(profile.fat_goal, 35, 180, roundNumber((targetCalories * 0.25) / 9));
    const remainderCalories = Math.max(0, targetCalories - (proteinGoal * 4) - (fatGoal * 9));
    const carbsGoal = clampNumber(profile.carbs_goal, 40, 550, roundNumber(remainderCalories / 4));

    return {
        targetCalories,
        proteinGoal,
        carbsGoal,
        fatGoal,
    };
}

function chooseMealType(periodLabel = '', index = 0, mealCount = 4) {
    const label = normalizeText(periodLabel);
    if (label.includes('breakfast') || label.includes('morning') || label.includes('kickoff')) return 'breakfast';
    if (label.includes('lunch') || label.includes('midday')) return 'lunch';
    if (label.includes('dinner') || label.includes('evening') || label.includes('feast')) return 'dinner';
    if (label.includes('post-workout')) return 'shake';
    if (label.includes('casein')) return 'late_snack';
    if (label.includes('snack') || label.includes('fuel')) return 'snack';

    if (mealCount <= 3) {
        if (index === 0) return 'breakfast';
        if (index === mealCount - 1) return 'dinner';
        return 'lunch';
    }

    if (index === 0) return 'breakfast';
    if (index === mealCount - 1) return 'dinner';
    return 'snack';
}

function pickFavoriteFood(foods = [], predicate) {
    return foods
        .filter((food) => predicate(food))
        .sort((a, b) => (b.protein || 0) + (b.carbs || 0) + (b.fat || 0) - ((a.protein || 0) + (a.carbs || 0) + (a.fat || 0)))
        .at(0);
}

function normalizeFavoriteFoods(likedFoods = [], dislikedFoods = []) {
    const disliked = new Set(dislikedFoods.map((food) => normalizeText(food?.name)));
    return likedFoods
        .map((food) => ({
            name: String(food?.name || '').trim(),
            calories: clampNumber(food?.calories, 0, 1200, 0),
            protein: clampNumber(food?.protein, 0, 150, 0),
            carbs: clampNumber(food?.carbs, 0, 150, 0),
            fat: clampNumber(food?.fat, 0, 150, 0),
        }))
        .filter((food) => food.name && !disliked.has(normalizeText(food.name)) && food.calories > 0);
}

function makeFood(name, portionGrams, calories, protein, carbs, fat) {
    return {
        name,
        portion: `${roundNumber(portionGrams)}g`,
        calories: roundNumber(calories),
        protein: roundNumber(protein),
        carbs: roundNumber(carbs),
        fat: roundNumber(fat),
    };
}

function foodFromFavorite(food, portionGrams = 100) {
    const scale = portionGrams / 100;
    return makeFood(
        food.name,
        portionGrams,
        food.calories * scale,
        food.protein * scale,
        food.carbs * scale,
        food.fat * scale
    );
}

function buildTemplateSet(profile = {}, favorites = {}) {
    const dietType = normalizeText(profile.diet_type);
    const isVegan = dietType === 'vegan';
    const isVegetarian = dietType === 'vegetarian';
    const isKeto = dietType === 'keto';

    const proteinFavorite = favorites.proteinFavorite;
    const carbFavorite = favorites.carbFavorite;
    const fatFavorite = favorites.fatFavorite;

    if (isVegan) {
        return {
            breakfast: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 160) : makeFood('Tofu Scramble', 220, 260, 24, 8, 14),
                carbFavorite ? foodFromFavorite(carbFavorite, 150) : makeFood('Oats', 70, 270, 9, 46, 5),
                makeFood('Berries', 120, 55, 1, 13, 0),
            ],
            lunch: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 180) : makeFood('Tempeh', 180, 350, 34, 16, 19),
                carbFavorite ? foodFromFavorite(carbFavorite, 180) : makeFood('Quinoa', 185, 222, 8, 39, 4),
                makeFood('Mixed Greens', 120, 25, 2, 5, 0),
            ],
            dinner: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 220) : makeFood('Lentils', 220, 255, 20, 44, 1),
                carbFavorite ? foodFromFavorite(carbFavorite, 180) : makeFood('Sweet Potato', 180, 155, 3, 36, 0),
                fatFavorite ? foodFromFavorite(fatFavorite, 50) : makeFood('Tahini Dressing', 35, 120, 3, 4, 10),
            ],
            snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 120) : makeFood('Edamame', 130, 160, 15, 13, 6),
                carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Banana', 120, 105, 1, 27, 0),
                fatFavorite ? foodFromFavorite(fatFavorite, 28) : makeFood('Almonds', 28, 165, 6, 6, 14),
            ],
            shake: [
                makeFood('Soy Protein Shake', 350, 230, 30, 15, 6),
                carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Banana', 120, 105, 1, 27, 0),
            ],
            late_snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 120) : makeFood('Soy Yogurt', 180, 140, 10, 12, 5),
                fatFavorite ? foodFromFavorite(fatFavorite, 20) : makeFood('Walnuts', 20, 130, 3, 3, 13),
            ],
        };
    }

    if (isVegetarian) {
        return {
            breakfast: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 180) : makeFood('Greek Yogurt', 220, 200, 22, 10, 5),
                carbFavorite ? foodFromFavorite(carbFavorite, 70) : makeFood('Granola', 70, 300, 8, 45, 9),
                makeFood('Berries', 100, 45, 1, 11, 0),
            ],
            lunch: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 180) : makeFood('Halloumi', 140, 445, 25, 3, 36),
                carbFavorite ? foodFromFavorite(carbFavorite, 170) : makeFood('Rice', 170, 220, 4, 48, 1),
                makeFood('Roasted Vegetables', 160, 110, 3, 16, 4),
            ],
            dinner: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 220) : makeFood('Cottage Cheese', 220, 216, 28, 8, 8),
                carbFavorite ? foodFromFavorite(carbFavorite, 180) : makeFood('Potatoes', 180, 155, 4, 35, 0),
                fatFavorite ? foodFromFavorite(fatFavorite, 18) : makeFood('Olive Oil', 18, 160, 0, 0, 18),
            ],
            snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 140) : makeFood('Skyr', 170, 110, 19, 7, 0),
                carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Apple', 120, 62, 0, 16, 0),
                fatFavorite ? foodFromFavorite(fatFavorite, 20) : makeFood('Peanut Butter', 20, 118, 5, 4, 10),
            ],
            shake: [
                makeFood('Whey Protein Shake', 350, 220, 32, 12, 4),
                carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Banana', 120, 105, 1, 27, 0),
            ],
            late_snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 150) : makeFood('Cottage Cheese', 180, 176, 23, 7, 6),
                fatFavorite ? foodFromFavorite(fatFavorite, 18) : makeFood('Walnuts', 18, 117, 3, 2, 11),
            ],
        };
    }

    if (isKeto) {
        return {
            breakfast: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 170) : makeFood('Egg Omelet', 220, 320, 24, 4, 24),
                fatFavorite ? foodFromFavorite(fatFavorite, 80) : makeFood('Avocado', 80, 128, 2, 7, 12),
                makeFood('Spinach', 60, 14, 2, 2, 0),
            ],
            lunch: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 200) : makeFood('Salmon', 200, 412, 44, 0, 26),
                makeFood('Leafy Salad', 120, 35, 2, 6, 0),
                fatFavorite ? foodFromFavorite(fatFavorite, 25) : makeFood('Olive Oil', 25, 221, 0, 0, 25),
            ],
            dinner: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 200) : makeFood('Chicken Thigh', 200, 418, 42, 0, 28),
                makeFood('Broccoli', 140, 48, 4, 10, 1),
                fatFavorite ? foodFromFavorite(fatFavorite, 40) : makeFood('Avocado', 100, 160, 2, 9, 15),
            ],
            snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 110) : makeFood('Greek Yogurt', 170, 160, 17, 6, 7),
                fatFavorite ? foodFromFavorite(fatFavorite, 25) : makeFood('Mixed Nuts', 25, 150, 5, 5, 13),
            ],
            shake: [
                makeFood('Low-Carb Protein Shake', 320, 210, 30, 8, 6),
                fatFavorite ? foodFromFavorite(fatFavorite, 18) : makeFood('Almond Butter', 18, 110, 4, 3, 10),
            ],
            late_snack: [
                proteinFavorite ? foodFromFavorite(proteinFavorite, 120) : makeFood('Cottage Cheese', 170, 166, 22, 6, 6),
                fatFavorite ? foodFromFavorite(fatFavorite, 20) : makeFood('Macadamia Nuts', 20, 144, 2, 3, 15),
            ],
        };
    }

    return {
        breakfast: [
            proteinFavorite ? foodFromFavorite(proteinFavorite, 170) : makeFood('Greek Yogurt', 220, 200, 22, 10, 5),
            carbFavorite ? foodFromFavorite(carbFavorite, 70) : makeFood('Oats', 70, 270, 9, 46, 5),
            makeFood('Berries', 100, 45, 1, 11, 0),
        ],
        lunch: [
            proteinFavorite ? foodFromFavorite(proteinFavorite, 190) : makeFood('Chicken Breast', 190, 314, 59, 0, 7),
            carbFavorite ? foodFromFavorite(carbFavorite, 170) : makeFood('Rice', 170, 220, 4, 48, 1),
            makeFood('Mixed Vegetables', 140, 65, 3, 12, 1),
        ],
        dinner: [
            proteinFavorite ? foodFromFavorite(proteinFavorite, 200) : makeFood('Salmon', 180, 370, 40, 0, 23),
            carbFavorite ? foodFromFavorite(carbFavorite, 180) : makeFood('Potatoes', 180, 155, 4, 35, 0),
            fatFavorite ? foodFromFavorite(fatFavorite, 18) : makeFood('Olive Oil', 18, 160, 0, 0, 18),
        ],
        snack: [
            proteinFavorite ? foodFromFavorite(proteinFavorite, 140) : makeFood('Cottage Cheese', 180, 176, 23, 7, 6),
            carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Banana', 120, 105, 1, 27, 0),
            fatFavorite ? foodFromFavorite(fatFavorite, 20) : makeFood('Peanut Butter', 20, 118, 5, 4, 10),
        ],
        shake: [
            makeFood('Whey Protein Shake', 350, 220, 32, 12, 4),
            carbFavorite ? foodFromFavorite(carbFavorite, 120) : makeFood('Banana', 120, 105, 1, 27, 0),
        ],
        late_snack: [
            proteinFavorite ? foodFromFavorite(proteinFavorite, 140) : makeFood('Greek Yogurt', 170, 155, 17, 8, 5),
            fatFavorite ? foodFromFavorite(fatFavorite, 18) : makeFood('Walnuts', 18, 117, 3, 2, 11),
        ],
    };
}

function scaleFoodsToCalories(foods = [], targetCalories = 500) {
    const baseCalories = foods.reduce((sum, food) => sum + Number(food.calories || 0), 0);
    if (baseCalories <= 0) return foods;

    const scale = Math.min(1.65, Math.max(0.8, targetCalories / baseCalories));
    return foods.map((food) => {
        const portionValue = Number.parseFloat(String(food.portion || '').replace('g', ''));
        const scaledPortion = Number.isFinite(portionValue) ? portionValue * scale : undefined;

        return {
            ...food,
            portion: scaledPortion ? `${roundNumber(scaledPortion)}g` : food.portion,
            calories: roundNumber(food.calories * scale),
            protein: roundNumber(food.protein * scale),
            carbs: roundNumber(food.carbs * scale),
            fat: roundNumber(food.fat * scale),
        };
    });
}

function summarizeFoods(foods = []) {
    return foods.reduce((totals, food) => ({
        calories: roundNumber(totals.calories + Number(food.calories || 0)),
        protein: roundNumber(totals.protein + Number(food.protein || 0)),
        carbs: roundNumber(totals.carbs + Number(food.carbs || 0)),
        fat: roundNumber(totals.fat + Number(food.fat || 0)),
    }), {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });
}

function buildMealName(periodLabel, mealType) {
    if (mealType === 'shake') return `${periodLabel} Protein Blend`;
    if (mealType === 'snack' || mealType === 'late_snack') return `${periodLabel} Snack`;
    return `${periodLabel} Plan`;
}

function buildOnboardingAiNutritionMenu({
    profile = {},
    likedFoods = [],
    dislikedFoods = [],
    date = new Date(),
} = {}) {
    const periods = buildMealPeriods(profile);
    const mealCount = periods.length;
    const targets = buildFallbackNutritionTargets(profile);
    const favoriteFoods = normalizeFavoriteFoods(likedFoods, dislikedFoods);
    const favorites = {
        proteinFavorite: pickFavoriteFood(favoriteFoods, (food) => food.protein >= 8 && food.protein >= food.carbs),
        carbFavorite: pickFavoriteFood(favoriteFoods, (food) => food.carbs >= 12),
        fatFavorite: pickFavoriteFood(favoriteFoods, (food) => food.fat >= 8),
    };
    const templates = buildTemplateSet(profile, favorites);

    return periods.map((periodLabel, index) => {
        const mealType = chooseMealType(periodLabel, index, mealCount);
        const templateFoods = templates[mealType] || templates.snack || [];
        const foods = scaleFoodsToCalories(templateFoods, targets.targetCalories / mealCount);
        const totals = summarizeFoods(foods);

        return {
            date,
            meal_period: periodLabel,
            meal_name: buildMealName(periodLabel, mealType),
            source: 'ai',
            total_calories: totals.calories,
            total_protein: totals.protein,
            total_carbs: totals.carbs,
            total_fat: totals.fat,
            note: `AI onboarding menu for ${targets.targetCalories} kcal/day`,
            foods,
        };
    });
}

module.exports = {
    buildOnboardingAiNutritionMenu,
    buildMealPeriods,
};
