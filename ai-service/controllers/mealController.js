const asyncHandler = require('express-async-handler');
const { callWithFallback } = require('../services/llmChain');
const {
    buildMealSystem,
    buildMealUserMessage,
    buildMealRecapSystem,
    buildMealRecapUserMessage,
} = require('../prompts/mealPrompt');

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function normalizeMealForRecap(meal = {}) {
    return {
        meal_name: String(meal?.meal_name || '').trim(),
        foods: Array.isArray(meal?.foods)
            ? meal.foods.map((food) => ({
                name: String(food?.name || '').trim(),
                portion: String(food?.portion || '').trim(),
                calories: toFiniteNumber(food?.calories),
                protein: toFiniteNumber(food?.protein),
                carbs: toFiniteNumber(food?.carbs),
                fat: toFiniteNumber(food?.fat),
            })).filter((food) => food.name)
            : [],
        total_calories: toFiniteNumber(meal?.total_calories ?? meal?.calories),
        total_protein: toFiniteNumber(meal?.total_protein ?? meal?.protein),
        total_carbs: toFiniteNumber(meal?.total_carbs ?? meal?.carbs),
        total_fat: toFiniteNumber(meal?.total_fat ?? meal?.fat),
    };
}

function normalizeComparisonText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function localizeRecapText(appLanguage, englishText, hebrewText) {
    return String(appLanguage || '').toLowerCase() === 'he' ? hebrewText : englishText;
}

function buildFallbackMealRecap({ meal, app_language }) {
    const language = String(app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const foods = Array.isArray(meal?.foods) ? meal.foods.filter((food) => String(food?.name || '').trim()) : [];
    const ingredientsRubric = foods.length
        ? foods.map((food) => {
            const portion = String(food?.portion || '').trim();
            const name = String(food?.name || '').trim();
            return portion ? `${portion} ${name}` : name;
        })
        : [String(meal?.meal_name || '').trim()].filter(Boolean);

    const recipeTitle = String(meal?.meal_name || '').trim() || localizeRecapText(language, 'Meal Recipe', 'מתכון לארוחה');
    const recipeGuide = foods.length
        ? localizeRecapText(
            language,
            `1. Prepare all the ingredients for ${recipeTitle}. Rinse, peel, trim, or slice each ingredient as needed, and place everything on the counter in the order you will use it.\n2. Measure the ingredients exactly from the list: ${ingredientsRubric.join(', ')}. If any ingredient needs cutting, cut it now into bite-size pieces or the shape that best fits the dish.\n3. Heat the appropriate pan, pot, oven, or serving bowl depending on the meal style. If the meal is cooked, preheat the cookware over medium heat for 2 to 3 minutes before adding the main ingredients. If it is assembly-based, prepare a clean mixing or serving bowl.\n4. Start with the main ingredients from the meal and cook or assemble them in a practical order. Add the protein or main base first, then the vegetables or supporting ingredients, stirring, flipping, or combining as needed so everything cooks or mixes evenly.\n5. Season and adjust during cooking or mixing. If something needs more time, continue in 1 to 2 minute intervals until the texture looks right. Look for clear doneness cues such as softened vegetables, warmed-through ingredients, lightly browned edges, or a fully heated center.\n6. Once the ingredients are ready, plate or bowl the meal neatly. Add the final ingredients or toppings at the end so the meal keeps the same identity as the selected meal.\n7. Let the meal rest for 1 minute if it was cooked hot, then serve immediately.`,
            `1. הכינו את כל המרכיבים עבור ${recipeTitle}. שטפו, קלפו, חתכו או סדרו כל מרכיב לפי הצורך והניחו את הכול מולכם לפי סדר השימוש.\n2. מדדו במדויק את המרכיבים מהרשימה: ${ingredientsRubric.join(', ')}. אם צריך לחתוך מרכיב כלשהו, חתכו עכשיו לגודל מתאים לאכילה או לצורת ההגשה של המנה.\n3. חממו את המחבת, הסיר, התנור או קערת ההגשה לפי סוג המנה. אם זו מנה מבושלת, חממו מראש על חום בינוני במשך 2 עד 3 דקות לפני שמוסיפים את המרכיבים המרכזיים. אם זו מנה להרכבה בלבד, הכינו קערת ערבוב או צלחת הגשה נקייה.\n4. התחילו מהמרכיבים המרכזיים של הארוחה ובשלו או הרכיבו אותם בסדר הגיוני. הוסיפו קודם את החלבון או הבסיס המרכזי, אחר כך את הירקות או המרכיבים התומכים, וערבבו, הפכו או שלבו לפי הצורך כדי שהכול יתבשל או יתערבב בצורה אחידה.\n5. תבלו והתאימו תוך כדי בישול או ערבוב. אם משהו צריך עוד זמן, המשיכו במקטעים של דקה עד שתיים עד שהמרקם נראה נכון. חפשו סימני מוכנות ברורים כמו ירקות שהתרככו, מרכיבים שחוממו היטב, שוליים שהזהיבו מעט או מרכז חם לגמרי.\n6. כשהמרכיבים מוכנים, סדרו את המנה בצורה מסודרת בצלחת או בקערה. הוסיפו את המרכיבים הסופיים או התוספות בסוף כדי לשמור על הזהות של המנה שנבחרה.\n7. אם זו מנה חמה, תנו לה לנוח דקה אחת ואז הגישו מיד.`
        )
        : localizeRecapText(
            language,
            `1. Prepare the ingredients for ${recipeTitle}.\n2. Assemble or cook them in a practical order.\n3. Plate and serve the meal so it stays faithful to the selected dish.`,
            `1. הכינו את המרכיבים עבור ${recipeTitle}.\n2. הרכיבו או בשלו אותם בסדר הגיוני.\n3. סדרו והגישו את המנה כך שתישאר נאמנה למנה שנבחרה.`
        );

    return {
        recipe_title: recipeTitle,
        ingredients_rubric: ingredientsRubric,
        recipe_guide: recipeGuide,
    };
}

function recapMatchesMeal(recap = {}, meal = {}) {
    const mealFoods = (Array.isArray(meal?.foods) ? meal.foods : [])
        .map((food) => normalizeComparisonText(food?.name))
        .filter(Boolean);

    if (!mealFoods.length) return true;

    const ingredientsText = normalizeComparisonText(
        Array.isArray(recap?.ingredients_rubric) ? recap.ingredients_rubric.join(' | ') : ''
    );
    const guideText = normalizeComparisonText(recap?.recipe_guide || recap?.recipe_text || '');

    if (!ingredientsText || !guideText) return false;

    let overlapCount = 0;
    for (const foodName of mealFoods) {
        const inIngredients = ingredientsText.includes(foodName);
        const inGuide = guideText.includes(foodName);
        if (inIngredients || inGuide) {
            overlapCount += 1;
        }
    }

    return overlapCount >= Math.max(1, Math.ceil(mealFoods.length * 0.5));
}

const LOCALIZED_LABELS = {
    en: {
        meals: {
            'Protein Oats Bowl': 'Protein Oats Bowl',
            'Tofu Scramble Plate': 'Tofu Scramble Plate',
            'Egg and Avocado Skillet': 'Egg and Avocado Skillet',
            'Chicken Rice Bowl': 'Chicken Rice Bowl',
            'Turkey Wrap Meal': 'Turkey Wrap Meal',
            'Tofu Quinoa Bowl': 'Tofu Quinoa Bowl',
            'Tempeh Rice Bowl': 'Tempeh Rice Bowl',
            'Lentil Pasta Bowl': 'Lentil Pasta Bowl',
            'Chicken Avocado Salad': 'Chicken Avocado Salad',
            'Salmon Potato Plate': 'Salmon Potato Plate',
            'Lean Beef Sweet Potato Bowl': 'Lean Beef Sweet Potato Bowl',
            'Yogurt Fruit Bowl': 'Yogurt Fruit Bowl',
            'Protein Smoothie': 'Protein Smoothie',
        },
        foods: {
            'Rolled Oats': 'Rolled Oats',
            'Greek Yogurt': 'Greek Yogurt',
            'Banana': 'Banana',
            'Almonds': 'Almonds',
            'Tofu': 'Tofu',
            'Tempeh': 'Tempeh',
            'Whole Grain Bread': 'Whole Grain Bread',
            'Avocado': 'Avocado',
            'Tomato': 'Tomato',
            'Eggs': 'Eggs',
            'Turkey Breast': 'Turkey Breast',
            'Spinach': 'Spinach',
            'Chicken Breast': 'Chicken Breast',
            'Jasmine Rice': 'Jasmine Rice',
            'Broccoli': 'Broccoli',
            'Olive Oil': 'Olive Oil',
            'Whole Wheat Wrap': 'Whole Wheat Wrap',
            'Hummus': 'Hummus',
            'Cucumber': 'Cucumber',
            'Quinoa': 'Quinoa',
            'Brown Rice': 'Brown Rice',
            'Chickpeas': 'Chickpeas',
            'Mixed Vegetables': 'Mixed Vegetables',
            'Edamame': 'Edamame',
            'Lentil Pasta': 'Lentil Pasta',
            'Lettuce': 'Lettuce',
            'Salmon': 'Salmon',
            'Potato': 'Potato',
            'Green Beans': 'Green Beans',
            'Lean Beef': 'Lean Beef',
            'Sweet Potato': 'Sweet Potato',
            'Bell Pepper': 'Bell Pepper',
            'Berries': 'Berries',
            'Honey': 'Honey',
            'Walnuts': 'Walnuts',
            'Soy Milk': 'Soy Milk',
            'Peanut Butter': 'Peanut Butter',
            'Oats': 'Oats',
        },
        coach_note: 'Fallback meal generated locally while the AI provider is unavailable.',
    },
    he: {
        meals: {
            'Protein Oats Bowl': 'קערת שיבולת שועל וחלבון',
            'Tofu Scramble Plate': 'צלחת טופו מקושקש',
            'Egg and Avocado Skillet': 'מחבת ביצים ואבוקדו',
            'Chicken Rice Bowl': 'קערת עוף ואורז',
            'Turkey Wrap Meal': 'ארוחת טורטיית הודו',
            'Tofu Quinoa Bowl': 'קערת טופו וקינואה',
            'Chicken Avocado Salad': 'סלט עוף ואבוקדו',
            'Salmon Potato Plate': 'צלחת סלמון ותפוח אדמה',
            'Lean Beef Sweet Potato Bowl': 'קערת בקר רזה ובטטה',
            'Yogurt Fruit Bowl': 'קערת יוגורט ופירות',
            'Protein Smoothie': 'שייק חלבון',
        },
        foods: {
            'Rolled Oats': 'שיבולת שועל',
            'Greek Yogurt': 'יוגורט יווני',
            'Banana': 'בננה',
            'Almonds': 'שקדים',
            'Tofu': 'טופו',
            'Whole Grain Bread': 'לחם מחיטה מלאה',
            'Avocado': 'אבוקדו',
            'Tomato': 'עגבנייה',
            'Eggs': 'ביצים',
            'Turkey Breast': 'חזה הודו',
            'Spinach': 'תרד',
            'Chicken Breast': 'חזה עוף',
            'Jasmine Rice': 'אורז יסמין',
            'Broccoli': 'ברוקולי',
            'Olive Oil': 'שמן זית',
            'Whole Wheat Wrap': 'טורטייה מחיטה מלאה',
            'Hummus': 'חומוס',
            'Cucumber': 'מלפפון',
            'Quinoa': 'קינואה',
            'Chickpeas': 'חומוס מבושל',
            'Mixed Vegetables': 'ירקות מעורבים',
            'Lettuce': 'חסה',
            'Salmon': 'סלמון',
            'Potato': 'תפוח אדמה',
            'Green Beans': 'שעועית ירוקה',
            'Lean Beef': 'בקר רזה',
            'Sweet Potato': 'בטטה',
            'Bell Pepper': 'פלפל',
            'Berries': 'פירות יער',
            'Honey': 'דבש',
            'Walnuts': 'אגוזי מלך',
            'Soy Milk': 'חלב סויה',
            'Peanut Butter': 'חמאת בוטנים',
            'Oats': 'שיבולת שועל',
        },
        coach_note: 'הארוחה נבנתה מקומית בזמן שספק ה-AI לא היה זמין.',
    },
};

const FALLBACK_MEAL_TEMPLATES = [
    {
        key: 'breakfast_oats_yogurt',
        periods: ['breakfast'],
        diets: ['everything', 'vegetarian'],
        tags: ['high_protein', 'light'],
        meal_name: 'Protein Oats Bowl',
        foods: [
            { name: 'Rolled Oats', portion: '70g', calories: 272, protein: 9, carbs: 46, fat: 5 },
            { name: 'Greek Yogurt', portion: '250g', calories: 150, protein: 25, carbs: 9, fat: 2 },
            { name: 'Banana', portion: '120g', calories: 105, protein: 1, carbs: 27, fat: 0 },
            { name: 'Almonds', portion: '15g', calories: 87, protein: 3, carbs: 3, fat: 8 },
        ],
    },
    {
        key: 'breakfast_tofu_scramble',
        periods: ['breakfast'],
        diets: ['vegan', 'vegetarian'],
        tags: ['savory', 'high_protein'],
        meal_name: 'Tofu Scramble Plate',
        foods: [
            { name: 'Tofu', portion: '180g', calories: 144, protein: 18, carbs: 4, fat: 8 },
            { name: 'Whole Grain Bread', portion: '80g', calories: 190, protein: 8, carbs: 34, fat: 3 },
            { name: 'Avocado', portion: '70g', calories: 112, protein: 1, carbs: 6, fat: 10 },
            { name: 'Tomato', portion: '120g', calories: 22, protein: 1, carbs: 5, fat: 0 },
        ],
    },
    {
        key: 'breakfast_keto_eggs',
        periods: ['breakfast'],
        diets: ['keto', 'paleo', 'everything'],
        tags: ['high_protein', 'low_carb'],
        meal_name: 'Egg and Avocado Skillet',
        foods: [
            { name: 'Eggs', portion: '150g', calories: 215, protein: 19, carbs: 2, fat: 15 },
            { name: 'Avocado', portion: '100g', calories: 160, protein: 2, carbs: 9, fat: 15 },
            { name: 'Turkey Breast', portion: '120g', calories: 162, protein: 32, carbs: 0, fat: 3 },
            { name: 'Spinach', portion: '80g', calories: 18, protein: 2, carbs: 3, fat: 0 },
        ],
    },
    {
        key: 'lunch_chicken_rice',
        periods: ['lunch', 'dinner'],
        diets: ['everything'],
        tags: ['high_protein', 'balanced'],
        meal_name: 'Chicken Rice Bowl',
        foods: [
            { name: 'Chicken Breast', portion: '180g', calories: 297, protein: 55, carbs: 0, fat: 6 },
            { name: 'Jasmine Rice', portion: '200g', calories: 260, protein: 5, carbs: 57, fat: 1 },
            { name: 'Broccoli', portion: '120g', calories: 42, protein: 4, carbs: 8, fat: 0 },
            { name: 'Olive Oil', portion: '10g', calories: 90, protein: 0, carbs: 0, fat: 10 },
        ],
    },
    {
        key: 'lunch_turkey_wrap',
        periods: ['lunch'],
        diets: ['everything'],
        tags: ['portable', 'high_protein'],
        meal_name: 'Turkey Wrap Meal',
        foods: [
            { name: 'Turkey Breast', portion: '150g', calories: 203, protein: 40, carbs: 0, fat: 4 },
            { name: 'Whole Wheat Wrap', portion: '90g', calories: 240, protein: 8, carbs: 40, fat: 6 },
            { name: 'Hummus', portion: '45g', calories: 117, protein: 4, carbs: 10, fat: 7 },
            { name: 'Cucumber', portion: '120g', calories: 18, protein: 1, carbs: 4, fat: 0 },
        ],
    },
    {
        key: 'lunch_tofu_quinoa',
        periods: ['lunch', 'dinner'],
        diets: ['vegan', 'vegetarian'],
        tags: ['balanced', 'high_protein'],
        meal_name: 'Tofu Quinoa Bowl',
        foods: [
            { name: 'Tofu', portion: '220g', calories: 176, protein: 22, carbs: 5, fat: 10 },
            { name: 'Quinoa', portion: '185g', calories: 222, protein: 8, carbs: 39, fat: 4 },
            { name: 'Chickpeas', portion: '130g', calories: 213, protein: 11, carbs: 35, fat: 3 },
            { name: 'Mixed Vegetables', portion: '140g', calories: 55, protein: 3, carbs: 11, fat: 0 },
        ],
    },
    {
        key: 'lunch_tempeh_rice',
        periods: ['lunch', 'dinner'],
        diets: ['vegan', 'vegetarian'],
        tags: ['balanced', 'high_protein'],
        meal_name: 'Tempeh Rice Bowl',
        foods: [
            { name: 'Tempeh', portion: '180g', calories: 346, protein: 34, carbs: 16, fat: 20 },
            { name: 'Brown Rice', portion: '180g', calories: 216, protein: 5, carbs: 45, fat: 2 },
            { name: 'Edamame', portion: '120g', calories: 146, protein: 13, carbs: 11, fat: 6 },
            { name: 'Broccoli', portion: '120g', calories: 42, protein: 4, carbs: 8, fat: 0 },
        ],
    },
    {
        key: 'lunch_lentil_pasta',
        periods: ['lunch', 'dinner'],
        diets: ['vegan', 'vegetarian'],
        tags: ['balanced', 'high_protein'],
        meal_name: 'Lentil Pasta Bowl',
        foods: [
            { name: 'Lentil Pasta', portion: '90g', calories: 320, protein: 23, carbs: 53, fat: 2 },
            { name: 'Tomato', portion: '180g', calories: 33, protein: 2, carbs: 7, fat: 0 },
            { name: 'Spinach', portion: '100g', calories: 23, protein: 3, carbs: 4, fat: 0 },
            { name: 'Olive Oil', portion: '12g', calories: 108, protein: 0, carbs: 0, fat: 12 },
        ],
    },
    {
        key: 'lunch_keto_chicken_salad',
        periods: ['lunch', 'dinner'],
        diets: ['keto', 'paleo', 'everything'],
        tags: ['high_protein', 'low_carb'],
        meal_name: 'Chicken Avocado Salad',
        foods: [
            { name: 'Chicken Breast', portion: '180g', calories: 297, protein: 55, carbs: 0, fat: 6 },
            { name: 'Avocado', portion: '100g', calories: 160, protein: 2, carbs: 9, fat: 15 },
            { name: 'Lettuce', portion: '120g', calories: 20, protein: 1, carbs: 4, fat: 0 },
            { name: 'Olive Oil', portion: '15g', calories: 135, protein: 0, carbs: 0, fat: 15 },
        ],
    },
    {
        key: 'dinner_salmon_potato',
        periods: ['dinner'],
        diets: ['everything', 'paleo'],
        tags: ['balanced', 'recovery'],
        meal_name: 'Salmon Potato Plate',
        foods: [
            { name: 'Salmon', portion: '180g', calories: 367, protein: 39, carbs: 0, fat: 22 },
            { name: 'Potato', portion: '250g', calories: 215, protein: 6, carbs: 49, fat: 0 },
            { name: 'Green Beans', portion: '140g', calories: 44, protein: 2, carbs: 10, fat: 0 },
            { name: 'Olive Oil', portion: '8g', calories: 72, protein: 0, carbs: 0, fat: 8 },
        ],
    },
    {
        key: 'dinner_beef_potato',
        periods: ['dinner'],
        diets: ['everything'],
        tags: ['high_protein', 'hearty'],
        meal_name: 'Lean Beef Sweet Potato Bowl',
        foods: [
            { name: 'Lean Beef', portion: '170g', calories: 295, protein: 44, carbs: 0, fat: 13 },
            { name: 'Sweet Potato', portion: '260g', calories: 224, protein: 4, carbs: 52, fat: 0 },
            { name: 'Bell Pepper', portion: '120g', calories: 37, protein: 1, carbs: 7, fat: 0 },
            { name: 'Olive Oil', portion: '8g', calories: 72, protein: 0, carbs: 0, fat: 8 },
        ],
    },
    {
        key: 'snack_yogurt_bowl',
        periods: ['morning_snack', 'afternoon_snack', 'evening_snack', 'post_workout', 'other'],
        diets: ['everything', 'vegetarian'],
        tags: ['high_protein', 'light'],
        meal_name: 'Yogurt Fruit Bowl',
        foods: [
            { name: 'Greek Yogurt', portion: '250g', calories: 150, protein: 25, carbs: 9, fat: 2 },
            { name: 'Berries', portion: '120g', calories: 57, protein: 1, carbs: 14, fat: 0 },
            { name: 'Honey', portion: '12g', calories: 36, protein: 0, carbs: 9, fat: 0 },
            { name: 'Walnuts', portion: '18g', calories: 118, protein: 3, carbs: 2, fat: 12 },
        ],
    },
    {
        key: 'snack_smoothie',
        periods: ['morning_snack', 'afternoon_snack', 'evening_snack', 'post_workout', 'other'],
        diets: ['vegan', 'vegetarian', 'everything'],
        tags: ['high_protein', 'light'],
        meal_name: 'Protein Smoothie',
        foods: [
            { name: 'Soy Milk', portion: '300ml', calories: 99, protein: 10, carbs: 4, fat: 5 },
            { name: 'Banana', portion: '120g', calories: 105, protein: 1, carbs: 27, fat: 0 },
            { name: 'Peanut Butter', portion: '20g', calories: 118, protein: 5, carbs: 4, fat: 10 },
            { name: 'Oats', portion: '35g', calories: 136, protein: 5, carbs: 23, fat: 2 },
        ],
    },
];

function normalizeMealPeriodKey(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!raw) return 'lunch';
    if (raw === 'afternoon') return 'afternoon_snack';
    if (raw === 'evening') return 'evening_snack';
    return raw;
}

function extractDietType(user = {}, nutritionPreferences = {}) {
    const hardDiets = Array.isArray(nutritionPreferences?.hard_restrictions?.diets)
        ? nutritionPreferences.hard_restrictions.diets.map((entry) => String(entry || '').trim().toLowerCase())
        : [];
    const profileDiet = String(user?.profile?.diet_type || '').trim().toLowerCase();
    if (hardDiets.includes('vegan') || profileDiet === 'vegan') return 'vegan';
    if (hardDiets.includes('vegetarian') || profileDiet === 'vegetarian') return 'vegetarian';
    if (profileDiet === 'keto') return 'keto';
    if (profileDiet === 'paleo') return 'paleo';
    return 'everything';
}

function collectFoodNameSet(values = []) {
    const set = new Set();
    for (const value of Array.isArray(values) ? values : []) {
        const name = String(value?.name || value || '').trim().toLowerCase();
        if (name) set.add(name);
    }
    return set;
}

function doesTemplateMatchDiet(template, dietType) {
    const diets = Array.isArray(template?.diets) ? template.diets : [];
    if (dietType === 'vegan') return diets.includes('vegan');
    if (dietType === 'vegetarian') return diets.includes('vegetarian') || diets.includes('vegan');
    if (dietType === 'keto') return diets.includes('keto');
    if (dietType === 'paleo') return diets.includes('paleo');
    return diets.includes('everything');
}

function templateMatchesDislikes(template, dislikes) {
    if (!dislikes.size) return false;
    return template.foods.some((food) => {
        const name = String(food?.name || '').trim().toLowerCase();
        return Array.from(dislikes).some((entry) => name.includes(entry) || entry.includes(name));
    });
}

function scoreTemplate(template, { likedFoods, mealRequestNote, dietType, periodKey }) {
    let score = 0;
    if (template.periods.includes(periodKey)) score += 4;
    if (template.diets.includes(dietType)) score += 4;

    const request = String(mealRequestNote || '').trim().toLowerCase();
    if ((request.includes('high protein') || request.includes('protein')) && template.tags.includes('high_protein')) {
        score += 3;
    }
    if ((request.includes('light') || request.includes('easy digestion')) && template.tags.includes('light')) {
        score += 2;
    }
    if ((request.includes('low carb') || request.includes('keto')) && template.tags.includes('low_carb')) {
        score += 3;
    }

    for (const food of template.foods) {
        const foodName = String(food?.name || '').trim().toLowerCase();
        if (Array.from(likedFoods).some((entry) => foodName.includes(entry) || entry.includes(foodName))) {
            score += 1;
        }
    }

    return score;
}

function scalePortion(portion, multiplier) {
    const match = String(portion || '').trim().match(/^(\d+(?:\.\d+)?)(g|ml)$/i);
    if (!match) return String(portion || '').trim();
    const amount = Math.max(1, Math.round(Number(match[1]) * multiplier));
    return `${amount}${match[2].toLowerCase()}`;
}

function sumMealTotals(foods = []) {
    return foods.reduce((totals, food) => ({
        calories: totals.calories + toFiniteNumber(food.calories),
        protein: totals.protein + toFiniteNumber(food.protein),
        carbs: totals.carbs + toFiniteNumber(food.carbs),
        fat: totals.fat + toFiniteNumber(food.fat),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function buildFallbackMeal({
    user,
    per_meal_target,
    meal_period,
    meal_request_note,
    nutrition_preferences,
    app_language,
    previous_generated_meals = [],
}) {
    const periodKey = normalizeMealPeriodKey(meal_period);
    const dietType = extractDietType(user, nutrition_preferences);
    const likedFoods = collectFoodNameSet(user?.liked_foods || []);
    const dislikedFoods = collectFoodNameSet([
        ...(user?.disliked_foods || []),
        ...((nutrition_preferences?.soft_dislikes?.foods) || []),
        ...((nutrition_preferences?.hard_restrictions?.forbidden_ingredients) || []),
    ]);

    const priorMealNames = new Set(
        (Array.isArray(previous_generated_meals) ? previous_generated_meals : [])
            .map((meal) => String(meal?.meal_name || '').trim().toLowerCase())
            .filter(Boolean)
    );
    const periodTemplates = FALLBACK_MEAL_TEMPLATES.filter((template) => template.periods.includes(periodKey));
    const compatibleTemplates = periodTemplates.filter((template) => doesTemplateMatchDiet(template, dietType));
    const usableTemplates = (compatibleTemplates.length ? compatibleTemplates : periodTemplates)
        .filter((template) => !templateMatchesDislikes(template, dislikedFoods));
    const distinctTemplates = usableTemplates.filter((template) => !priorMealNames.has(String(template.meal_name || '').trim().toLowerCase()));
    const dietSafeFallbackTemplates = FALLBACK_MEAL_TEMPLATES.filter((template) => doesTemplateMatchDiet(template, dietType));
    const candidates = distinctTemplates.length
        ? distinctTemplates
        : (usableTemplates.length ? usableTemplates : (dietSafeFallbackTemplates.length ? dietSafeFallbackTemplates : FALLBACK_MEAL_TEMPLATES));

    const rankedTemplates = [...candidates]
        .map((template) => ({
            template,
            score: scoreTemplate(template, {
                likedFoods,
                mealRequestNote: meal_request_note,
                dietType,
                periodKey,
            }),
        }))
        .sort((a, b) => b.score - a.score);

    const requestSeed = Array.from(String(meal_request_note || ''))
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const pickIndex = rankedTemplates.length > 1 && /different|alternative|another/i.test(String(meal_request_note || ''))
        ? 1
        : (requestSeed % rankedTemplates.length);
    const selectedTemplate = rankedTemplates[pickIndex]?.template || rankedTemplates[0]?.template || FALLBACK_MEAL_TEMPLATES[0];
    const templateTotals = sumMealTotals(selectedTemplate.foods);
    const requestedCalories = Math.max(250, toFiniteNumber(per_meal_target?.calories) || templateTotals.calories);
    const multiplier = Math.min(1.25, Math.max(0.8, requestedCalories / Math.max(1, templateTotals.calories)));

    const foods = selectedTemplate.foods.map((food) => ({
        ...food,
        portion: scalePortion(food.portion, multiplier),
        calories: Math.max(1, Math.round(toFiniteNumber(food.calories) * multiplier)),
        protein: Math.max(0, Math.round(toFiniteNumber(food.protein) * multiplier)),
        carbs: Math.max(0, Math.round(toFiniteNumber(food.carbs) * multiplier)),
        fat: Math.max(0, Math.round(toFiniteNumber(food.fat) * multiplier)),
    }));
    const totals = sumMealTotals(foods);
    const language = String(app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const labels = LOCALIZED_LABELS[language] || LOCALIZED_LABELS.en;

    return {
        meal_name: labels.meals[selectedTemplate.meal_name] || selectedTemplate.meal_name,
        meal_type: periodKey,
        foods: foods.map((food) => ({
            ...food,
            name: labels.foods[food.name] || food.name,
        })),
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fat,
        coach_note: labels.coach_note,
    };
}

/**
 * @desc    Generate next meal using LLM
 * @route   POST /ai/meal/next
 * @access  Private
 */
const generateNextMeal = asyncHandler(async (req, res) => {
    const user = req.user;
    const p = user.profile || {};

    const {
        current_calories_consumed = 0,
        protein_consumed = 0,
        carbs_consumed = 0,
        fat_consumed = 0,
        meals_eaten_today = 0,
        total_meals_planned = 4,
        time_of_day = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        meal_period = 'Lunch',
        day_of_week = '',
        meal_request_note = '',
        meal_request_priority = 'normal',
        nutrition_preferences_note = '',
        nutrition_preferences = null,
        app_language = 'en',
        meal_slot_label = '',
        meal_slot_id = '',
        workout_context = null,
        accepted_meal_history = [],
        previous_generated_meals = [],
    } = req.body;

    // Calculate remaining macros
    const remaining = {
        calories: Math.max(0, (p.target_calories || 2000) - current_calories_consumed),
        protein: Math.max(0, (p.protein_goal || 150) - protein_consumed),
        carbs: Math.max(0, (p.carbs_goal || 200) - carbs_consumed),
        fat: Math.max(0, (p.fat_goal || 65) - fat_consumed),
    };

    const meals_remaining = Math.max(1, total_meals_planned - meals_eaten_today);
    const per_meal_target = {
        calories: Math.round(remaining.calories / meals_remaining),
        protein: Math.round(remaining.protein / meals_remaining),
        carbs: Math.round(remaining.carbs / meals_remaining),
        fat: Math.round(remaining.fat / meals_remaining),
    };

    const profileWorkoutContext = {
        goal: p.goal || '',
        experience_level: p.experience_level || '',
        workout_days_per_week: Number.isFinite(p.workout_days_per_week) ? Number(p.workout_days_per_week) : null,
        session_duration: Number.isFinite(p.session_duration) ? Number(p.session_duration) : null,
        environment: p.environment || '',
        activity_level: p.activity_level || '',
        injuries: p.injuries || '',
        workout_plan_status: p.workout_plan_status || '',
        workout_plan_source: p.workout_plan_source || '',
        has_existing_plan: Boolean(p.has_existing_plan),
        trainer_personality: p.trainer_personality || '',
    };
    const resolvedWorkoutContext = workout_context && typeof workout_context === 'object'
        ? { ...profileWorkoutContext, ...workout_context }
        : profileWorkoutContext;

    const systemPrompt = buildMealSystem(user, { app_language });
    const userMessage = buildMealUserMessage({
        remaining,
        per_meal_target,
        liked_foods: user.liked_foods || [],
        disliked_foods: (user.disliked_foods || []).map(f => f.name),
        nutrition_preferences:
            nutrition_preferences && typeof nutrition_preferences === 'object'
                ? nutrition_preferences
                : (user.nutrition_preferences || {}),
        time_of_day,
        meal_period,
        day_of_week,
        meals_remaining,
        meal_request_note,
        meal_request_priority,
        nutrition_preferences_note,
        app_language,
        meal_slot_label,
        meal_slot_id,
        workout_context: resolvedWorkoutContext,
        accepted_meal_history: Array.isArray(accepted_meal_history) ? accepted_meal_history : [],
    });

    try {
        const { text, provider } = await callWithFallback(systemPrompt, userMessage, 800);

    // Parse JSON – strip markdown code fences if model added them
        let meal;
        try {
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            meal = JSON.parse(cleaned);
        } catch (err) {
            res.status(500);
            throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
        }

        res.json({ ...meal, _provider: provider });
    } catch (error) {
        console.warn('generateNextMeal falling back to local generator:', {
            message: error?.message,
            status: error?.status,
            code: error?.code,
        });

        const resolvedNutritionPreferences =
            nutrition_preferences && typeof nutrition_preferences === 'object'
                ? nutrition_preferences
                : (user.nutrition_preferences || {});

        const fallbackMeal = buildFallbackMeal({
            user,
            per_meal_target,
            meal_period,
            meal_request_note,
            nutrition_preferences: resolvedNutritionPreferences,
            app_language,
            previous_generated_meals,
        });

        res.json({
            ...fallbackMeal,
            _provider: 'local-fallback',
            _fallback_reason: String(error?.message || 'Gemini request failed'),
        });
    }
});

/**
 * @desc    Parse user's free-text meal description into structured meal data
 * @route   POST /ai/meal/from-text
 * @access  Private
 */
const generateMealFromText = asyncHandler(async (req, res) => {
    const user = req.user;
    const p = user.profile || {};
    const { meal_description } = req.body;

    if (!meal_description || !meal_description.trim()) {
        res.status(400);
        throw new Error('meal_description is required');
    }

    const systemPrompt = buildMealSystem(user);

    const userMessage = `The user described a meal they ate or plan to eat:
"${meal_description.trim()}"

Parse this description and estimate nutritional values for each component.
User diet: ${p.diet_type || 'everything'}.

Respond ONLY with this exact JSON structure (no markdown, no extra text):
{
  "meal_name": "Short name describing the meal",
  "foods": [
    { "name": "Food name", "portion": "Xg or X units", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0,
  "coach_note": "משפט קצר בעברית על הארוחה"
}`;

    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 800);

    let meal;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        meal = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
    }

    res.json({ ...meal, _provider: provider });
});

/**
 * @desc    Generate an AI recap for a selected meal
 * @route   POST /ai/meal/recap
 * @access  Private
 */
const generateMealRecap = asyncHandler(async (req, res) => {
    const user = req.user;
    const p = user.profile || {};
    const {
        meal,
        current_calories_consumed = 0,
        protein_consumed = 0,
        carbs_consumed = 0,
        fat_consumed = 0,
        time_of_day = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        meal_period = 'Lunch',
        day_of_week = '',
        meal_request_note = '',
        meal_request_priority = 'normal',
        nutrition_preferences = null,
        app_language = 'en',
        workout_context = null,
        accepted_meal_history = [],
        previous_recap = '',
        recap_feedback = '',
        variation_request = '',
    } = req.body || {};

    const normalizedMeal = normalizeMealForRecap(meal);
    if (!normalizedMeal.meal_name) {
        res.status(400);
        throw new Error('meal is required for recap');
    }

    const currentConsumed = {
        calories: toFiniteNumber(current_calories_consumed),
        protein: toFiniteNumber(protein_consumed),
        carbs: toFiniteNumber(carbs_consumed),
        fat: toFiniteNumber(fat_consumed),
    };
    const dailyTargets = {
        calories: toFiniteNumber(p.target_calories || 2000),
        protein: toFiniteNumber(p.protein_goal || 150),
        carbs: toFiniteNumber(p.carbs_goal || 200),
        fat: toFiniteNumber(p.fat_goal || 65),
    };
    const remainingBeforeMeal = {
        calories: Math.max(0, dailyTargets.calories - currentConsumed.calories),
        protein: Math.max(0, dailyTargets.protein - currentConsumed.protein),
        carbs: Math.max(0, dailyTargets.carbs - currentConsumed.carbs),
        fat: Math.max(0, dailyTargets.fat - currentConsumed.fat),
    };
    const updatedMacros = {
        daily_targets: dailyTargets,
        consumed_after_meal: {
            calories: currentConsumed.calories + normalizedMeal.total_calories,
            protein: currentConsumed.protein + normalizedMeal.total_protein,
            carbs: currentConsumed.carbs + normalizedMeal.total_carbs,
            fat: currentConsumed.fat + normalizedMeal.total_fat,
        },
    };
    updatedMacros.remaining_after_meal = {
        calories: Math.max(0, dailyTargets.calories - updatedMacros.consumed_after_meal.calories),
        protein: Math.max(0, dailyTargets.protein - updatedMacros.consumed_after_meal.protein),
        carbs: Math.max(0, dailyTargets.carbs - updatedMacros.consumed_after_meal.carbs),
        fat: Math.max(0, dailyTargets.fat - updatedMacros.consumed_after_meal.fat),
    };

    const profileWorkoutContext = {
        goal: p.goal || '',
        experience_level: p.experience_level || '',
        workout_days_per_week: Number.isFinite(p.workout_days_per_week) ? Number(p.workout_days_per_week) : null,
        session_duration: Number.isFinite(p.session_duration) ? Number(p.session_duration) : null,
        environment: p.environment || '',
        activity_level: p.activity_level || '',
        injuries: p.injuries || '',
        workout_plan_status: p.workout_plan_status || '',
        workout_plan_source: p.workout_plan_source || '',
        has_existing_plan: Boolean(p.has_existing_plan),
        trainer_personality: p.trainer_personality || '',
    };
    const resolvedWorkoutContext = workout_context && typeof workout_context === 'object'
        ? { ...profileWorkoutContext, ...workout_context }
        : profileWorkoutContext;

    const systemPrompt = buildMealRecapSystem(user, { app_language });
    const userMessage = buildMealRecapUserMessage({
        meal: normalizedMeal,
        current_consumed: currentConsumed,
        daily_targets: dailyTargets,
        remaining_before_meal: remainingBeforeMeal,
        updated_macros: updatedMacros,
        time_of_day,
        meal_period,
        day_of_week,
        nutrition_preferences:
            nutrition_preferences && typeof nutrition_preferences === 'object'
                ? nutrition_preferences
                : (user.nutrition_preferences || {}),
        workout_context: resolvedWorkoutContext,
        accepted_meal_history: Array.isArray(accepted_meal_history) ? accepted_meal_history : [],
        meal_request_note,
        meal_request_priority,
        previous_recap,
        recap_feedback,
        variation_request,
        app_language,
    });

    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 700);

    let recap;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        recap = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
    }

    if (!recapMatchesMeal(recap, normalizedMeal)) {
        console.warn('generateMealRecap replacing drifted recap with local fallback:', {
            mealName: normalizedMeal.meal_name,
            provider,
        });
        recap = buildFallbackMealRecap({
            meal: normalizedMeal,
            app_language,
        });
    }

    res.json({
        ...recap,
        meal_macros: {
            calories: normalizedMeal.total_calories,
            protein: normalizedMeal.total_protein,
            carbs: normalizedMeal.total_carbs,
            fat: normalizedMeal.total_fat,
        },
        updated_macros,
        source: {
            label: 'Generated from your selected meal, profile, nutrition preferences, training context, and saved meals.',
            url: '',
            provider,
        },
        _provider: provider,
    });
});

module.exports = { generateNextMeal, generateMealFromText, generateMealRecap };

