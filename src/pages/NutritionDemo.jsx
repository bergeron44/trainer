import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Flame, Beef, Wheat, Droplet, Target, MessageCircle, ChevronRight, Plus, X, Heart, Utensils, CheckCircle2, SlidersHorizontal, RefreshCcw, ThumbsUp, ThumbsDown, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';
import FoodSwipeGame from '@/components/nutrition/FoodSwipeGame';
import MealPlanCard from '@/components/nutrition/MealPlanCard';
import ManualFoodEntry from '@/components/nutrition/ManualFoodEntry';
import NutritionCalendar from '@/components/nutrition/NutritionCalendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/axios';
import aiApi from '@/api/aiAxios';

/** @type {any} */
const DialogContentAny = DialogContent;
/** @type {any} */
const DialogHeaderAny = DialogHeader;
/** @type {any} */
const DialogTitleAny = DialogTitle;
/** @type {any} */
const TextareaAny = Textarea;

// --- Coach Logic: Dynamic Meal Periods ---
const generateCoachPeriods = (goal, dietType, t = null) => {
  let numMeals = 5;
  if (goal === 'muscle_gain') numMeals = 6;
  if (goal === 'weight_loss') numMeals = 3;
  if (dietType === 'keto') numMeals = Math.max(2, numMeals - 1);
  numMeals = Math.max(2, Math.min(7, numMeals));

  const periods = [];
  if (numMeals === 2) {
    periods.push({ id: 'm1', label: t ? t('nutrition.meals.firstMeal', 'First Meal') : 'First Meal' }, { id: 'm2', label: t ? t('nutrition.meals.finalFeast', 'Final Feast') : 'Final Feast' });
  } else if (numMeals === 3) {
    periods.push({ id: 'm1', label: t ? t('nutrition.meals.morningFuel', 'Morning Fuel') : 'Morning Fuel' }, { id: 'm2', label: t ? t('nutrition.meals.middayRecharger', 'Midday Recharger') : 'Midday Recharger' }, { id: 'm3', label: t ? t('nutrition.meals.eveningRecovery', 'Evening Recovery') : 'Evening Recovery' });
  } else if (numMeals === 4) {
    periods.push({ id: 'm1', label: t ? t('nutrition.breakfast', 'Breakfast') : 'Breakfast' }, { id: 'm2', label: t ? t('nutrition.lunch', 'Lunch') : 'Lunch' }, { id: 'm3', label: t ? t('nutrition.meals.preWorkoutSnack', 'Pre-Workout Snack') : 'Pre-Workout Snack' }, { id: 'm4', label: t ? t('nutrition.dinner', 'Dinner') : 'Dinner' });
  } else if (numMeals >= 5) {
    periods.push({ id: 'm1', label: t ? t('nutrition.meals.earlyKickoff', 'Early Kickoff') : 'Early Kickoff' }, { id: 'm2', label: t ? t('nutrition.meals.midMorningSnack', 'Mid-Morning Snack') : 'Mid-Morning Snack' }, { id: 'm3', label: t ? t('nutrition.lunch', 'Lunch') : 'Lunch' }, { id: 'm4', label: t ? t('nutrition.meals.afternoonFuel', 'Afternoon Fuel') : 'Afternoon Fuel' });
    if (numMeals >= 6) periods.push({ id: 'm5', label: t ? t('nutrition.dinner', 'Dinner') : 'Dinner' });
    if (numMeals === 7) {
      periods.push({ id: 'm6', label: t ? t('nutrition.meals.postWorkoutShake', 'Post-Workout Shake') : 'Post-Workout Shake' });
      periods.push({ id: 'm7', label: t ? t('nutrition.meals.lateNightCasein', 'Late Night Casein') : 'Late Night Casein' });
    } else if (numMeals === 6) {
      periods.push({ id: 'm6', label: t ? t('nutrition.meals.eveningSnack', 'Evening Snack') : 'Evening Snack' });
    } else {
      periods.push({ id: 'm5', label: t ? t('nutrition.dinner', 'Dinner') : 'Dinner' });
    }
  }
  return periods;
};

// --- Static Inspirations ---
const getInspirationsForPeriod = (dietType) => {
  const db = {
    vegan: [
      { name: 'Tofu Scramble Bowl', cals: 415, protein: 25, carbs: 45, fat: 15 },
      { name: 'Oatmeal & Protein Shake', cals: 350, protein: 20, carbs: 50, fat: 8 },
      { name: 'Avocado Toast', cals: 300, protein: 10, carbs: 30, fat: 18 }
    ],
    keto: [
      { name: 'Eggs & Bacon', cals: 450, protein: 25, carbs: 2, fat: 38 },
      { name: 'Avocado & Salmon', cals: 400, protein: 28, carbs: 5, fat: 30 },
      { name: 'Cheese Omelette', cals: 350, protein: 20, carbs: 3, fat: 28 }
    ],
    everything: [
      { name: 'Greek Yogurt & Berries', cals: 250, protein: 20, carbs: 30, fat: 5 },
      { name: 'Turkey Wrap', cals: 400, protein: 35, carbs: 40, fat: 12 },
      { name: 'Steak & Sweet Potato', cals: 550, protein: 45, carbs: 45, fat: 20 }
    ]
  };
  return db[dietType] || db['everything'];
};

const DIET_TIPS = {
  vegan: "Plant-based proteins like lentils, tofu, and quinoa are essential for muscle repair.",
  vegetarian: "Incorporate eggs and dairy for complete amino acid profiles.",
  keto: "Keep carbs under 30g and focus on high-quality fats for sustained energy.",
  everything: "Balance is key. Prioritize lean meats and complex carbohydrates."
};

const GOAL_LABELS = {
  weight_loss: 'Fat Loss',
  muscle_gain: 'Muscle Gain',
  recomp: 'Maintenance',
  athletic_performance: 'Athletic Performance'
};

// Map hour → period ID (matches 5-meal layout: m1-m5)
const getPeriodId = (hour) => {
  if (hour < 10) return 'm1';
  if (hour < 13) return 'm2';
  if (hour < 16) return 'm3';
  if (hour < 19) return 'm4';
  return 'm5';
};

const detectCountryCodeFromBrowser = () => {
  try {
    const locale = String(
      (typeof navigator !== 'undefined' && navigator.language) ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      ''
    );
    const match = locale.match(/[-_]\s*([A-Za-z]{2})\b/);
    return match ? String(match[1]).toUpperCase() : '';
  } catch (_) {
    return '';
  }
};

const resolveVisiblePeriodId = (hour, periodDefinitions = []) => {
  const preferred = getPeriodId(hour);
  const ids = (periodDefinitions || []).map((period) => period.id).filter(Boolean);

  if (!ids.length) return preferred;
  if (ids.includes(preferred)) return preferred;

  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const bucketIndex = Math.min(
    Math.floor((safeHour / 24) * ids.length),
    ids.length - 1
  );

  return ids[bucketIndex];
};

const DEFAULT_MEAL_TYPE_SEQUENCES = {
  2: ['breakfast', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'],
  5: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'],
  6: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'],
  7: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'post_workout', 'evening_snack'],
};

const normalizeMealPeriodKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return '';
  if (normalized === 'mid_morning_snack') return 'morning_snack';
  if (normalized === 'afternoon') return 'afternoon_snack';
  if (normalized === 'evening') return 'evening_snack';
  if (normalized === 'pre_workout_snack') return 'afternoon_snack';
  if (normalized === 'late_night_casein') return 'evening_snack';
  return normalized;
};

const getMealTypeSequence = (periodDefinitions = []) => {
  const count = Array.isArray(periodDefinitions) ? periodDefinitions.length : 0;
  return DEFAULT_MEAL_TYPE_SEQUENCES[count] || DEFAULT_MEAL_TYPE_SEQUENCES[5];
};

const getMealSlotContext = (periodId, periodDefinitions = []) => {
  const periodList = Array.isArray(periodDefinitions) ? periodDefinitions : [];
  const sequence = getMealTypeSequence(periodList);
  const index = periodList.findIndex((period) => period.id === periodId);
  const fallbackPeriod = periodList[0] || null;
  const resolvedIndex = index >= 0 ? index : 0;
  const period = index >= 0 ? periodList[index] : fallbackPeriod;

  return {
    periodId: period?.id || periodId || '',
    periodLabel: period?.label || '',
    mealType: sequence[resolvedIndex] || 'other',
  };
};

const resolvePeriodIdForStoredMeal = (log, periodDefinitions = []) => {
  const periodList = Array.isArray(periodDefinitions) ? periodDefinitions : [];
  const storedPeriodId = String(log?.meal_period_id || '').trim();
  if (storedPeriodId && periodList.some((period) => period.id === storedPeriodId)) {
    return storedPeriodId;
  }

  const storedMealType = normalizeMealPeriodKey(log?.meal_period);
  if (storedMealType) {
    const sequence = getMealTypeSequence(periodList);
    const matchedIndex = sequence.findIndex((mealType) => mealType === storedMealType);
    if (matchedIndex >= 0 && periodList[matchedIndex]?.id) {
      return periodList[matchedIndex].id;
    }
  }

  return '';
};

const hasUsableMealContent = (meal) => {
  if (!meal || typeof meal !== 'object') return false;

  const foods = Array.isArray(meal.foods) ? meal.foods : [];
  const hasNamedFood = foods.some((food) => String(food?.name || '').trim().length > 0);
  const caloriesFromFoods = foods.reduce((sum, food) => sum + Math.max(0, Number(food?.calories) || 0), 0);

  const totalCalories = Math.max(
    0,
    Number(meal.total_calories ?? meal.calories ?? 0) || 0
  );
  const macroSum =
    Math.max(0, Number(meal.total_protein ?? meal.protein ?? 0) || 0) +
    Math.max(0, Number(meal.total_carbs ?? meal.carbs ?? 0) || 0) +
    Math.max(0, Number(meal.total_fat ?? meal.fat ?? 0) || 0);

  if (totalCalories > 0) return true;
  if (caloriesFromFoods > 0) return true;
  if (hasNamedFood && macroSum > 0) return true;
  return false;
};

const areMealsTooSimilar = (firstMeal, secondMeal) => {
  if (!firstMeal || !secondMeal) return false;

  const firstName = String(firstMeal?.meal_name || '').trim().toLowerCase();
  const secondName = String(secondMeal?.meal_name || '').trim().toLowerCase();
  if (firstName && secondName && firstName === secondName) return true;

  const firstFoods = new Set(
    (Array.isArray(firstMeal?.foods) ? firstMeal.foods : [])
      .map((food) => String(food?.name || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const secondFoods = new Set(
    (Array.isArray(secondMeal?.foods) ? secondMeal.foods : [])
      .map((food) => String(food?.name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  if (!firstFoods.size || !secondFoods.size) return false;

  let overlapCount = 0;
  secondFoods.forEach((foodName) => {
    if (firstFoods.has(foodName)) overlapCount += 1;
  });

  return overlapCount >= Math.min(firstFoods.size, secondFoods.size);
};

export default function NutritionDemo() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [chatOpen, setChatOpen] = useState(false);
  const [coachStyle, setCoachStyle] = useState('motivational');

  // Swipe game & meal planner state
  const [showSwipeGame, setShowSwipeGame] = useState(false);
  const [showMealPlan, setShowMealPlan] = useState(false);
  const [showMealRequestDialog, setShowMealRequestDialog] = useState(false);
  const [mealRequestText, setMealRequestText] = useState('');
  const [showMealRefineDialog, setShowMealRefineDialog] = useState(false);
  const [mealRefineText, setMealRefineText] = useState('');
  const [lastMealRequestContext, setLastMealRequestContext] = useState({ text: '', priority: 'normal' });
  const [showNutritionPreferencesDialog, setShowNutritionPreferencesDialog] = useState(false);
  const [nutritionPreferencesNote, setNutritionPreferencesNote] = useState('');
  const [nutritionPreferencesDraft, setNutritionPreferencesDraft] = useState('');
  const [structuredNutritionPreferences, setStructuredNutritionPreferences] = useState(null);
  const [isSavingNutritionPreferences, setIsSavingNutritionPreferences] = useState(false);
  const [nutritionPreferencesError, setNutritionPreferencesError] = useState('');
  const [showMealPlanRefreshPrompt, setShowMealPlanRefreshPrompt] = useState(false);
  const [isRefreshingMealPlan, setIsRefreshingMealPlan] = useState(false);
  const [showMealRecapDialog, setShowMealRecapDialog] = useState(false);
  const [isMealRecapLoading, setIsMealRecapLoading] = useState(false);
  const [mealRecapData, setMealRecapData] = useState(null);
  const [mealRecapContext, setMealRecapContext] = useState(null);
  const [mealRecapFeedback, setMealRecapFeedback] = useState(null);
  const [showLikedRecapsDialog, setShowLikedRecapsDialog] = useState(false);
  const [likedRecapItems, setLikedRecapItems] = useState([]);
  const [isLikedRecapsLoading, setIsLikedRecapsLoading] = useState(false);
  const [isLikedRecapMutating, setIsLikedRecapMutating] = useState(false);
  const [mealPlanTargetPeriodId, setMealPlanTargetPeriodId] = useState(null);
  const [currentMeal, setCurrentMeal] = useState(null);
  const [mealOptions, setMealOptions] = useState([]);
  const [selectedMealOptionIndex, setSelectedMealOptionIndex] = useState(null);
  const [isMealLoading, setIsMealLoading] = useState(false);
  const [likedFoods, setLikedFoods] = useState([]);
  const [dislikedFoods, setDislikedFoods] = useState([]);

  const profile = user?.profile || {};
  const dietType = profile.diet_type || 'everything';
  const goal = profile.goal || 'recomp';

  const [activeSearchPeriod, setActiveSearchPeriod] = useState(null);
  const [loggedFoods, setLoggedFoods] = useState({});
  const [periods, setPeriods] = useState([]);
  const [activeMealPlan, setActiveMealPlan] = useState(null);
  const [selectedPlanMeal, setSelectedPlanMeal] = useState(null); // meal detail sheet

  useEffect(() => {
    setPeriods(generateCoachPeriods(goal, dietType, t));
  }, [goal, dietType, t]);

  // Load food preferences, today's saved meals, and active meal plan on mount
  const loadActiveMealPlan = async () => {
    try {
      const res = await api.get('/nutrition/menu/active');
      setActiveMealPlan(res.data || null);
    } catch (_) {
      setActiveMealPlan(null);
    }
  };

  const loadTodaysLogs = async () => {
    const periodDefinitions = generateCoachPeriods(goal, dietType, t);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const res = await api.get(`/nutrition/date/${todayStr}`);
      const logs = Array.isArray(res.data) ? res.data : [];
      setLoggedFoods(() => {
        const updated = {};
        logs.forEach((log) => {
          const hour = new Date(log.createdAt || log.date).getHours();
          const pid =
            resolvePeriodIdForStoredMeal(log, periodDefinitions) ||
            resolveVisiblePeriodId(hour, periodDefinitions);
          updated[pid] = [...(updated[pid] || []), {
            name: log.meal_name,
            cals: log.calories,
            protein: log.protein || 0,
            carbs: log.carbs || 0,
            fat: log.fat || 0,
          }];
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to load today nutrition logs:', error?.response?.data || error?.message || error);
      setLoggedFoods({});
    }
  };

  useEffect(() => {
    loadFoodPreferences();
    loadActiveMealPlan();
    loadLikedRecapItems();
    loadTodaysLogs();
  }, [goal, dietType, t]);

  const loadFoodPreferences = async () => {
    try {
      const res = await api.get('/users/food-preferences');
      setLikedFoods(res.data.liked_foods || []);
      setDislikedFoods(res.data.disliked_foods || []);
    } catch (err) {
      console.error('Failed to load food preferences:', err);
    }
  };

  const tdee = profile.target_calories || 2000;
  const p_goal = profile.protein_goal || 150;
  const c_goal = profile.carbs_goal || 200;
  const f_goal = profile.fat_goal || 65;

  const currentMacros = Object.values(loggedFoods).flat().reduce((acc, food) => {
    return {
      cals: acc.cals + (food.cals || 0),
      pro: acc.pro + (food.protein || 0),
      carb: acc.carb + (food.carbs || 0),
      fat: acc.fat + (food.fat || 0)
    };
  }, { cals: 0, pro: 0, carb: 0, fat: 0 });

  const buildMealLogPayload = (meal, slotContext, date) => ({
    meal_name: meal.meal_name,
    calories: Number(meal.total_calories ?? meal.calories ?? 0) || 0,
    protein: Number(meal.total_protein ?? meal.protein ?? 0) || 0,
    carbs: Number(meal.total_carbs ?? meal.carbs ?? 0) || 0,
    fat: Number(meal.total_fat ?? meal.fat ?? 0) || 0,
    meal_period: slotContext?.mealType || '',
    meal_period_id: slotContext?.periodId || '',
    meal_period_label: slotContext?.periodLabel || '',
    date,
    foods: (Array.isArray(meal.foods) ? meal.foods : []).map((food) => ({
      name: food.name,
      portion: food.portion || '',
      calories: food.calories,
    })),
  });

  const buildLoggedMealEntry = (meal, date) => ({
    name: meal.meal_name,
    cals: Number(meal.total_calories ?? meal.calories ?? 0) || 0,
    protein: Number(meal.total_protein ?? meal.protein ?? 0) || 0,
    carbs: Number(meal.total_carbs ?? meal.carbs ?? 0) || 0,
    fat: Number(meal.total_fat ?? meal.fat ?? 0) || 0,
    _aiTime: date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
  });

  // Block AI meal generation if current period already has an AI meal
  const effectivePeriods = periods.length > 0 ? periods : generateCoachPeriods(goal, dietType, t);
  const currentPeriodId = resolveVisiblePeriodId(new Date().getHours(), effectivePeriods);
  const currentPeriodHasAIMeal = (loggedFoods[currentPeriodId] || []).some(f => f._aiTime);

  const macroCards = [
    { key: 'calories', label: t('common.calories', 'Calories'), icon: Flame, value: currentMacros.cals, target: tdee, color: '#00F2FF', unit: '' },
    { key: 'protein', label: t('common.protein', 'Protein'), icon: Beef, value: currentMacros.pro, target: p_goal, color: '#CCFF00', unit: 'g' },
    { key: 'carbs', label: t('common.carbs', 'Carbs'), icon: Wheat, value: currentMacros.carb, target: c_goal, color: '#FF6B6B', unit: 'g' },
    { key: 'fat', label: t('common.fat', 'Fat'), icon: Droplet, value: currentMacros.fat, target: f_goal, color: '#FFD93D', unit: 'g' }
  ];

  const handleAddFood = async (food) => {
    if (!activeSearchPeriod) return;
    const slotContext = getMealSlotContext(activeSearchPeriod, effectivePeriods);
    // Save to DB as a single-food log entry
    try {
      const now = new Date();
      await api.post('/nutrition', {
        meal_name: food.name,
        calories: food.cals,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        meal_period: slotContext.mealType,
        meal_period_id: slotContext.periodId,
        meal_period_label: slotContext.periodLabel,
        date: now,
        foods: [{ name: food.name, portion: food.portion || '', calories: food.cals }],
      });
    } catch (err) {
      console.error('Failed to save food to DB:', err);
    }
    setLoggedFoods(prev => ({
      ...prev,
      [activeSearchPeriod]: [...(prev[activeSearchPeriod] || []), food]
    }));
    setActiveSearchPeriod(null);
  };

  // Called from ManualFoodEntry "Describe" tab — saves full AI-parsed meal to DB + correct period
  const handleAddMeal = async (meal) => {
    if (!activeSearchPeriod) return;
    const slotContext = getMealSlotContext(activeSearchPeriod, effectivePeriods);
    try {
      const now = new Date();
      await api.post('/nutrition', buildMealLogPayload(meal, slotContext, now));
    } catch (err) {
      console.error('Failed to save meal to DB:', err);
    }
    setLoggedFoods(prev => ({
      ...prev,
      [activeSearchPeriod]: [...(prev[activeSearchPeriod] || []), {
        name: meal.meal_name,
        cals: meal.total_calories,
        protein: meal.total_protein || 0,
        carbs: meal.total_carbs || 0,
        fat: meal.total_fat || 0,
      }]
    }));
    setActiveSearchPeriod(null);
  };

  const removeFood = (periodId, index) => {
    setLoggedFoods(prev => {
      const updated = [...(prev[periodId] || [])];
      updated.splice(index, 1);
      return { ...prev, [periodId]: updated };
    });
  };

  const fetchAcceptedMealHistory = async () => {
    try {
      const res = await api.get('/nutrition/recent-saved', {
        params: { limit: 20, days: 45 },
      });
      const meals = Array.isArray(res?.data?.meals) ? res.data.meals : [];
      return meals.map((meal) => ({
        meal_name: String(meal?.meal_name || '').trim(),
        date: meal?.date || null,
        calories: Number(meal?.calories) || 0,
        protein: Number(meal?.protein) || 0,
        carbs: Number(meal?.carbs) || 0,
        fat: Number(meal?.fat) || 0,
        foods: Array.isArray(meal?.foods)
          ? meal.foods
            .map((food) => ({
              name: String(food?.name || '').trim(),
              portion: String(food?.portion || '').trim(),
              calories: Number(food?.calories) || 0,
            }))
            .filter((food) => food.name)
          : [],
      })).filter((meal) => meal.meal_name);
    } catch (err) {
      console.warn('Failed to load accepted meal history for AI context:', err?.message || err);
      return [];
    }
  };

  // ─── Meal Planner ────────────────────────────────────────
  const requestMealPlan = async (
    mealRequestNote = '',
    nutritionPreferencesOverride = null,
    nutritionPreferencesNoteOverride = '',
    options = {}
  ) => {
    const {
      autoLogToTodaysLog = false,
      openMealPlanCard = true,
      mealRequestPriority = 'normal',
      appendAlternative = false,
      targetOptions = 1,
      targetPeriodId,
    } = options;

    if (targetPeriodId !== undefined) {
      setMealPlanTargetPeriodId(targetPeriodId || null);
    }

    if (openMealPlanCard) {
      setShowMealPlan(true);
      setIsMealLoading(true);
      if (!appendAlternative) {
        setCurrentMeal(null);
        setMealOptions([]);
        setSelectedMealOptionIndex(null);
      }
    }

    const now = new Date();
    const mealsEaten = Object.values(loggedFoods).filter(arr => arr.length > 0).length;
    const fallbackTargetPeriodId =
      targetPeriodId ||
      mealPlanTargetPeriodId ||
      resolveVisiblePeriodId(now.getHours(), effectivePeriods);
    const slotContext = getMealSlotContext(fallbackTargetPeriodId, effectivePeriods);

    try {
      const acceptedMealHistory = await fetchAcceptedMealHistory();
      const payload = {
        current_calories_consumed: currentMacros.cals,
        protein_consumed: currentMacros.pro,
        carbs_consumed: currentMacros.carb,
        fat_consumed: currentMacros.fat,
        app_language: String(i18n?.language || '').toLowerCase().startsWith('he') ? 'he' : 'en',
        time_of_day: format(now, 'HH:mm'),
        meal_period: slotContext.mealType || getCurrentMealPeriod(now),
        meal_slot_id: slotContext.periodId || '',
        meal_slot_label: slotContext.periodLabel || '',
        day_of_week: format(now, 'EEEE').toLowerCase(),
        meals_eaten_today: mealsEaten,
        total_meals_planned: periods.length,
        workout_context: {
          goal: profile.goal || '',
          experience_level: profile.experience_level || '',
          workout_days_per_week: profile.workout_days_per_week ?? null,
          session_duration: profile.session_duration ?? null,
          environment: profile.environment || '',
          activity_level: profile.activity_level || '',
          injuries: profile.injuries || '',
          workout_plan_status: profile.workout_plan_status || '',
          workout_plan_source: profile.workout_plan_source || '',
          has_existing_plan: Boolean(profile.has_existing_plan),
          trainer_personality: profile.trainer_personality || '',
        },
      };
      if (acceptedMealHistory.length) {
        payload.accepted_meal_history = acceptedMealHistory;
      }

      const trimmedMealRequest = String(mealRequestNote || '').trim();
      const normalizedMealRequestPriority =
        String(mealRequestPriority || 'normal').toLowerCase() === 'high' ? 'high' : 'normal';
      if (trimmedMealRequest) {
        payload.meal_request_note = trimmedMealRequest;
        payload.meal_request_priority = normalizedMealRequestPriority;
      }
      const trimmedNutritionPreferences = String(nutritionPreferencesNoteOverride || nutritionPreferencesNote || '').trim();
      if (trimmedNutritionPreferences) {
        payload.nutrition_preferences_note = trimmedNutritionPreferences;
      }
      const effectiveStructuredPreferences =
        nutritionPreferencesOverride && typeof nutritionPreferencesOverride === 'object' && !Array.isArray(nutritionPreferencesOverride)
          ? nutritionPreferencesOverride
          : (structuredNutritionPreferences && typeof structuredNutritionPreferences === 'object' && !Array.isArray(structuredNutritionPreferences)
            ? structuredNutritionPreferences
            : null);
      if (effectiveStructuredPreferences) {
        payload.nutrition_preferences = effectiveStructuredPreferences;
      }

      const generateSingleMealCandidate = async (requestPayload) => {
        const res = await aiApi.post('/meal/next', requestPayload, { timeout: 25000 });
        const meal = res?.data || null;

        if (!meal || typeof meal !== 'object' || !meal.meal_name || !hasUsableMealContent(meal)) {
          throw new Error('Meal generator did not return a valid meal object');
        }

        return {
          meal,
          usedFallbackGenerator: meal?._provider === 'local-fallback',
          fallbackReason: String(meal?._fallback_reason || '').trim(),
        };
      };

      const {
        meal: primaryMeal,
        usedFallbackGenerator: usedFallbackPrimary,
        fallbackReason: primaryFallbackReason,
      } = await generateSingleMealCandidate(payload);
      const generatedMeals = [primaryMeal];
      let usedFallbackGenerator = usedFallbackPrimary;
      let fallbackReason = primaryFallbackReason;

      setLastMealRequestContext({
        text: trimmedMealRequest,
        priority: normalizedMealRequestPriority,
      });

      const shouldGenerateTwoOptions = !autoLogToTodaysLog && !appendAlternative && Number(targetOptions) >= 2;
      if (shouldGenerateTwoOptions) {
        try {
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            const existingNames = generatedMeals
              .map((meal) => String(meal?.meal_name || '').trim())
              .filter(Boolean);
            const alternativePrompt = trimmedMealRequest
              ? `${trimmedMealRequest}\nPlease provide a distinctly different meal option from the previous one.\nAvoid repeating these meal names: ${existingNames.join(', ') || 'none'}.\nAlternative option attempt ${attempt}.`
              : `Please provide a distinctly different meal option from the previous one.\nAvoid repeating these meal names: ${existingNames.join(', ') || 'none'}.\nAlternative option attempt ${attempt}.`;
            const secondPayload = {
              ...payload,
              meal_request_note: alternativePrompt,
              meal_request_priority: 'high',
              previous_generated_meals: generatedMeals.map((meal) => ({
                meal_name: String(meal?.meal_name || '').trim(),
                foods: Array.isArray(meal?.foods) ? meal.foods.map((food) => String(food?.name || '').trim()).filter(Boolean) : [],
              })),
            };

            const {
              meal: secondMeal,
              usedFallbackGenerator: usedFallbackSecond,
              fallbackReason: secondFallbackReason,
            } = await generateSingleMealCandidate(secondPayload);
            if (generatedMeals.some((existingMeal) => areMealsTooSimilar(existingMeal, secondMeal))) {
              continue;
            }

            usedFallbackGenerator = usedFallbackGenerator || usedFallbackSecond;
            fallbackReason = fallbackReason || secondFallbackReason;
            generatedMeals.push(secondMeal);
            break;
          }
        } catch (secondErr) {
          console.warn('Failed to generate second option. Continuing with one option.', secondErr?.message || secondErr);
        }
      }

      if (autoLogToTodaysLog) {
        const meal = primaryMeal;
        const now = new Date();
        const periodId =
          slotContext.periodId ||
          resolveVisiblePeriodId(now.getHours(), effectivePeriods) ||
          effectivePeriods?.[0]?.id ||
          periods?.[0]?.id ||
          'breakfast';
        const saveSlotContext = getMealSlotContext(periodId, effectivePeriods);

        try {
          await api.post('/nutrition', buildMealLogPayload(meal, saveSlotContext, now));
        } catch (saveErr) {
          console.error('Failed to save refreshed meal to DB:', saveErr);
        }

        setLoggedFoods((prev) => ({
          ...prev,
          [periodId]: [
            ...(prev[periodId] || []).filter((food) => !food._aiTime),
            buildLoggedMealEntry(meal, now),
          ],
        }));
        setShowMealPlan(false);
        setCurrentMeal(null);
        setMealOptions([]);
        setSelectedMealOptionIndex(null);
        window.alert(
          usedFallbackGenerator
            ? t(
              'nutrition.geminiMealFallbackLogged',
              `Gemini failed, so Today's Log was updated with a local fallback meal instead.${fallbackReason ? ` Reason: ${fallbackReason}` : ''}`
            )
            : t('nutrition.todaysLogUpdatedSuccess', "Today's Log was updated.")
        );
      } else {
        const firstMeal = generatedMeals[0] || null;
        setCurrentMeal(firstMeal);
        if (appendAlternative) {
          setMealOptions((prev) => {
            const base = Array.isArray(prev) ? prev : (firstMeal ? [firstMeal] : []);
            const next = [...base, ...(firstMeal ? [firstMeal] : [])].slice(-3);
            return next;
          });
          setSelectedMealOptionIndex(null);
        } else {
          const nextOptions = generatedMeals.slice(0, Math.max(1, Math.min(3, Number(targetOptions) || 1)));
          setMealOptions(nextOptions);
          setSelectedMealOptionIndex(nextOptions.length > 1 ? null : 0);
        }

        if (usedFallbackGenerator) {
          window.alert(
            t(
              'nutrition.geminiMealFallbackShown',
              `Gemini failed, so a local fallback meal is being shown instead.${fallbackReason ? ` Reason: ${fallbackReason}` : ''}`
            )
          );
        }
      }
    } catch (err) {
      const failureReason = String(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        t('nutrition.generateMealFailed', 'Failed to generate meal.')
      );
      console.error('Failed to generate meal plan:', err.response?.data || err.message);
      // Signal error state so MealPlanCard can show retry
      if (openMealPlanCard) {
        setCurrentMeal({ _error: true, error_message: failureReason });
        setMealOptions([]);
        setSelectedMealOptionIndex(null);
        window.alert(
          t(
            'nutrition.generateMealFailedDetailed',
            `Couldn't generate meal right now. ${failureReason}`
          )
        );
      } else {
        window.alert(t('nutrition.todaysLogUpdatedFailed', "Couldn't update Today's Log. Please try again."));
      }
    } finally {
      if (openMealPlanCard) {
        setIsMealLoading(false);
      }
    }
  };

  const getCurrentMealPeriod = (now) => {
    const hour = now.getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 13) return 'morning_snack';
    if (hour < 16) return 'lunch';
    if (hour < 19) return 'afternoon_snack';
    if (hour < 22) return 'dinner';
    return 'evening_snack';
  };

  const saveMealToTodaysLog = async (meal, options = {}) => {
    if (!meal || typeof meal !== 'object') return;
    const { periodId: explicitPeriodId = null, closeOverlays = true } = options;
    const now = new Date();
    const hour = now.getHours();
    const periodId =
      explicitPeriodId ||
      mealPlanTargetPeriodId ||
      resolveVisiblePeriodId(hour, effectivePeriods);
    const slotContext = getMealSlotContext(periodId, effectivePeriods);

    try {
      await api.post('/nutrition', buildMealLogPayload(meal, slotContext, now));
    } catch (err) {
      console.error('Failed to save meal to DB:', err);
    }

    // Add to the correct period slot in the daily log
    setLoggedFoods(prev => ({
      ...prev,
      [periodId]: [...(prev[periodId] || []), buildLoggedMealEntry(meal, now)]
    }));

    if (closeOverlays) {
      setShowMealPlan(false);
      setCurrentMeal(null);
      setMealOptions([]);
      setSelectedMealOptionIndex(null);
      setSelectedPlanMeal(null);
      setMealPlanTargetPeriodId(null);
      closeMealRecapDialog();
    }
  };

  const handleLogMeal = async (meal) => {
    await saveMealToTodaysLog(meal, { closeOverlays: true });
  };

  const handleSwipeGameClose = () => {
    setShowSwipeGame(false);
    // Reload preferences after swiping
    loadFoodPreferences();
  };

  const openMealRequestDialog = () => {
    setMealRequestText('');
    setShowMealRequestDialog(true);
  };

  const openNutritionPreferencesDialog = () => {
    setNutritionPreferencesDraft('');
    setNutritionPreferencesError('');
    setShowNutritionPreferencesDialog(true);
  };

  const closeMealPlanRefreshPrompt = () => {
    setShowMealPlanRefreshPrompt(false);
  };

  const handleMealPlanRefreshDecision = async (shouldUpdate) => {
    closeMealPlanRefreshPrompt();

    if (!shouldUpdate) return;

    setIsRefreshingMealPlan(true);
    try {
      const res = await api.post('/nutrition/menu/regenerate');
      if (res?.data?.activePlan) {
        setActiveMealPlan(res.data.activePlan);
      } else {
        await loadActiveMealPlan();
      }
      window.alert(
        t(
          'nutrition.todaysPlanRefreshedSuccess',
          "Today's meal plan was refreshed using your latest nutrition and training data."
        )
      );
    } catch (error) {
      console.error('Failed to regenerate active meal plan:', error?.response?.data || error?.message || error);
      window.alert(
        t(
          'nutrition.todaysPlanRefreshedFailed',
          "Couldn't refresh Today's meal plan. Please try again."
        )
      );
    } finally {
      setIsRefreshingMealPlan(false);
    }
  };

  const loadLikedRecapItems = async () => {
    setIsLikedRecapsLoading(true);
    try {
      const res = await api.get('/nutrition/liked-recaps');
      setLikedRecapItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (err) {
      console.error('Failed to load liked recapies:', err?.response?.data || err?.message || err);
      setLikedRecapItems([]);
    } finally {
      setIsLikedRecapsLoading(false);
    }
  };

  const handleSaveNutritionPreferences = async () => {
    const trimmed = nutritionPreferencesDraft.trim();
    setNutritionPreferencesError('');

    if (!trimmed) {
      setNutritionPreferencesNote('');
      setShowNutritionPreferencesDialog(false);
      return;
    }

    setIsSavingNutritionPreferences(true);
    try {
      const countryCode = detectCountryCodeFromBrowser();
      const runExtractorRequest = async (textValue, options = {}) => {
        const { confirmConflicts = false } = options;
        const legacyRes = await api.put('/users/nutrition-preferences/extract', {
          text: textValue,
          ...(countryCode ? { country_code: countryCode } : {}),
          ...(confirmConflicts ? { confirm_conflicts: true } : {}),
        });
        return legacyRes?.data || {};
      };

      let extractorPayload = await runExtractorRequest(trimmed);

      if (extractorPayload?.final_decision) {
        const decision = String(extractorPayload.final_decision || '').toUpperCase();

        if (decision === 'ASK_USER') {
          const clarificationQuestion = String(
            extractorPayload?.clarification_question ||
            t('nutrition.preferencesNeedClarification', 'Please clarify your preference so I can save it safely.')
          );
          const clarificationInput = window.prompt(clarificationQuestion, '');

          if (!clarificationInput || !clarificationInput.trim()) {
            setNutritionPreferencesError(
              t('nutrition.preferencesClarificationRequired', 'Clarification is required before saving preferences.')
            );
            return;
          }

          extractorPayload = await runExtractorRequest(`${trimmed} ${clarificationInput.trim()}`);
        }

        const finalDecision = String(extractorPayload?.final_decision || '').toUpperCase();
        if (finalDecision !== 'AUTO_SAVE') {
          setNutritionPreferencesError(
            String(
              extractorPayload?.reasons?.[0] ||
              t('nutrition.preferencesNotSaved', 'Preferences were not saved automatically. Please refine your text.')
            )
          );
          return;
        }
      }

      const clarificationQuestions = Array.isArray(extractorPayload?.clarification_questions)
        ? extractorPayload.clarification_questions
        : [];

      if (clarificationQuestions.length) {
        const confirmationStatements = [];

        clarificationQuestions.forEach((question) => {
          const item = String(question?.item || '').trim();
          if (!item) return;

          const promptText = String(
            question?.question ||
            `You gave conflicting preference for "${item}". Press OK for DISLIKE or Cancel for LIKE.`
          );

          const defaultResolved = String(question?.resolved_to || '').toLowerCase();
          const defaultToDislike = defaultResolved === 'dislike';

          const userChoseDislike = window.confirm(
            `${promptText}\n\nPress OK = DISLIKE\nPress Cancel = LIKE`
          );

          const finalPreference = userChoseDislike ? 'dislike' : 'like';
          if (defaultToDislike && !userChoseDislike) {
            confirmationStatements.push(`I like ${item}.`);
          } else if (!defaultToDislike && userChoseDislike) {
            confirmationStatements.push(`I dislike ${item}.`);
          } else {
            confirmationStatements.push(`I ${finalPreference} ${item}.`);
          }
        });

        if (confirmationStatements.length) {
          extractorPayload = await runExtractorRequest(
            confirmationStatements.join(' '),
            { confirmConflicts: true }
          );
        }
      }

      const updatedNutritionPreferences = extractorPayload?.nutrition_preferences;
      const validUpdatedPreferences =
        updatedNutritionPreferences &&
          typeof updatedNutritionPreferences === 'object' &&
          !Array.isArray(updatedNutritionPreferences)
          ? updatedNutritionPreferences
          : null;

      if (Array.isArray(extractorPayload?.liked_foods)) {
        setLikedFoods(extractorPayload.liked_foods);
      }
      if (Array.isArray(extractorPayload?.disliked_foods)) {
        setDislikedFoods(extractorPayload.disliked_foods);
      }

      if (validUpdatedPreferences) {
        setStructuredNutritionPreferences(validUpdatedPreferences);
      }
      setNutritionPreferencesNote(trimmed);
      setShowNutritionPreferencesDialog(false);
      setNutritionPreferencesDraft('');
      setShowMealPlanRefreshPrompt(true);
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      setNutritionPreferencesError(
        typeof backendMessage === 'string' && backendMessage
          ? backendMessage
          : t('nutrition.preferencesSaveFailed', 'Failed to save nutrition preferences. Please try again.')
      );
    } finally {
      setIsSavingNutritionPreferences(false);
    }
  };

  const handleMealRequestSubmit = () => {
    const requestText = mealRequestText;
    setShowMealRequestDialog(false);
    setMealRequestText('');
    requestMealPlan(requestText, null, '', { mealRequestPriority: 'normal', targetOptions: 2, targetPeriodId: null });
  };

  const normalizeIngredientRubric = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  };

  const resolveRecapGuideText = (recap) =>
    String(
      recap?.recipeGuide ??
      recap?.recipe_guide ??
      recap?.recipeText ??
      recap?.recipe_text ??
      ''
    ).trim();

  const resolveRecapIngredients = (recap) =>
    normalizeIngredientRubric(
      recap?.ingredientsRubric ??
      recap?.ingredients_rubric ??
      recap?.ingredients ??
      recap?.ingredient_list
    );

  const buildLocalMealRecapy = (meal) => {
    const normalizedMeal = {
      meal_name: meal?.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion'),
      total_calories: Number(meal?.total_calories ?? meal?.calories ?? 0) || 0,
      total_protein: Number(meal?.total_protein ?? meal?.protein ?? 0) || 0,
      total_carbs: Number(meal?.total_carbs ?? meal?.carbs ?? 0) || 0,
      total_fat: Number(meal?.total_fat ?? meal?.fat ?? 0) || 0,
      foods: Array.isArray(meal?.foods) ? meal.foods : [],
    };

    const consumedAfterMeal = {
      calories: currentMacros.cals + normalizedMeal.total_calories,
      protein: currentMacros.pro + normalizedMeal.total_protein,
      carbs: currentMacros.carb + normalizedMeal.total_carbs,
      fat: currentMacros.fat + normalizedMeal.total_fat,
    };

    const remainingAfterMeal = {
      calories: Math.max(0, tdee - consumedAfterMeal.calories),
      protein: Math.max(0, p_goal - consumedAfterMeal.protein),
      carbs: Math.max(0, c_goal - consumedAfterMeal.carbs),
      fat: Math.max(0, f_goal - consumedAfterMeal.fat),
    };

    const foods = normalizedMeal.foods
      .map((food) => ({
        name: String(food?.name || '').trim(),
        portion: String(food?.portion || '').trim(),
      }))
      .filter((food) => food.name)
      .slice(0, 6);
    const ingredientText = foods.length
      ? foods.map((food) => (food.portion ? `${food.portion} ${food.name}` : food.name)).join(', ')
      : t('nutrition.recipeIngredientFallback', 'Use the listed meal ingredients in practical portions.');
    const ingredientsRubric = foods.length
      ? foods.map((food) => (food.portion ? `${food.portion} ${food.name}` : food.name))
      : [t('nutrition.recipeIngredientFallback', 'Use the listed meal ingredients in practical portions.')];

    return {
      title: normalizedMeal.meal_name,
      recipeTitle: normalizedMeal.meal_name,
      ingredientsRubric,
      recipeGuide: foods.length
        ? `${t('nutrition.recipeGuideFallbackOpening', 'Gather the following ingredients before you start:')} ${ingredientText}. ${t('nutrition.recipeGuideFallbackBody', 'Wash the produce well, trim any tough stems, and cut everything into bite-size pieces. If any ingredient is dry, hard, or usually cooked from raw, start by soaking or simmering it until tender before combining it with the rest of the meal. Then cook or assemble the ingredients in the order that makes sense for texture and doneness, season them to match your diet rules, and finish by plating the meal immediately while it is fresh.')}`
        : t('nutrition.recipeGuideFallbackOnly', 'Build this meal from beginning to end using practical portions, clear preparation steps, and cooking or assembly instructions that respect your restrictions while staying generally close to the selected meal.'),
      recipeText: foods.length
        ? `${t('nutrition.recipeGuideFallbackOpening', 'Gather the following ingredients before you start:')} ${ingredientText}. ${t('nutrition.recipeGuideFallbackBody', 'Wash the produce well, trim any tough stems, and cut everything into bite-size pieces. If any ingredient is dry, hard, or usually cooked from raw, start by soaking or simmering it until tender before combining it with the rest of the meal. Then cook or assemble the ingredients in the order that makes sense for texture and doneness, season them to match your diet rules, and finish by plating the meal immediately while it is fresh.')}`
        : t('nutrition.recipeGuideFallbackOnly', 'Build this meal from beginning to end using practical portions, clear preparation steps, and cooking or assembly instructions that respect your restrictions while staying generally close to the selected meal.'),
      mealMacros: {
        calories: normalizedMeal.total_calories,
        protein: normalizedMeal.total_protein,
        carbs: normalizedMeal.total_carbs,
        fat: normalizedMeal.total_fat,
      },
      updatedMacros: {
        consumed_after_meal: consumedAfterMeal,
        remaining_after_meal: remainingAfterMeal,
      },
      source: {
        label: t('nutrition.recapSourceGenerated', 'Generated from your selected meal, profile, nutrition preferences, training context, and saved meals.'),
        url: '',
        provider: 'local-fallback',
      },
    };
  };

  const buildWorkoutContextPayload = () => ({
    goal: profile.goal || '',
    experience_level: profile.experience_level || '',
    workout_days_per_week: profile.workout_days_per_week ?? null,
    session_duration: profile.session_duration ?? null,
    environment: profile.environment || '',
    activity_level: profile.activity_level || '',
    injuries: profile.injuries || '',
    workout_plan_status: profile.workout_plan_status || '',
    workout_plan_source: profile.workout_plan_source || '',
    has_existing_plan: Boolean(profile.has_existing_plan),
    trainer_personality: profile.trainer_personality || '',
  });

  const buildCurrentLikedRecapPayload = () => {
    const meal = mealRecapContext?.meal;
    const ingredientsRubric = resolveRecapIngredients(mealRecapData);
    const recipeGuide = resolveRecapGuideText(mealRecapData);
    if (!meal || !recipeGuide) return null;

    return {
      meal: {
        meal_name: meal.meal_name || mealRecapData.title || t('nutrition.mealSuggestion', 'Meal suggestion'),
        meal_type: meal.meal_type || '',
        calories: Number(meal.total_calories ?? meal.calories ?? mealRecapData?.mealMacros?.calories ?? 0) || 0,
        protein: Number(meal.total_protein ?? meal.protein ?? mealRecapData?.mealMacros?.protein ?? 0) || 0,
        carbs: Number(meal.total_carbs ?? meal.carbs ?? mealRecapData?.mealMacros?.carbs ?? 0) || 0,
        fat: Number(meal.total_fat ?? meal.fat ?? mealRecapData?.mealMacros?.fat ?? 0) || 0,
        foods: Array.isArray(meal.foods) ? meal.foods : [],
      },
      recap: {
        title: mealRecapData.title || '',
        recipe_title: mealRecapData.recipeTitle || mealRecapData.title || '',
        ingredients_rubric: ingredientsRubric,
        recipe_guide: recipeGuide,
        recipe_text: recipeGuide,
        meal_macros: mealRecapData.mealMacros || {},
        updated_macros: mealRecapData.updatedMacros || {},
        source: mealRecapData.source || {},
      },
    };
  };

  const openMealRecapDialog = (payload, context = null) => {
    setMealRecapData(payload);
    if (context) {
      setMealRecapContext(context);
    }
    setMealRecapFeedback(payload?.likedRecapId ? 'liked' : null);
    setShowMealRecapDialog(true);
  };

  const requestMealRecap = async (meal, options = {}) => {
    if (!meal) return;
    const normalizedMeal = {
      meal_name: meal.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion'),
      foods: Array.isArray(meal.foods) ? meal.foods : [],
      total_calories: Number(meal.total_calories ?? meal.calories ?? 0) || 0,
      total_protein: Number(meal.total_protein ?? meal.protein ?? 0) || 0,
      total_carbs: Number(meal.total_carbs ?? meal.carbs ?? 0) || 0,
      total_fat: Number(meal.total_fat ?? meal.fat ?? 0) || 0,
      meal_type: meal.meal_type || '',
    };
    setIsMealRecapLoading(true);
    setShowMealRecapDialog(true);
    if (!options.keepExisting) {
      setMealRecapData(null);
    }

    try {
      const acceptedMealHistory = await fetchAcceptedMealHistory();
      const previousSummary = String(
        options.previousSummary ||
        [
          mealRecapData?.recipeTitle,
          resolveRecapIngredients(mealRecapData).join(', '),
          resolveRecapGuideText(mealRecapData),
        ].filter(Boolean).join('\n')
      ).trim();
      const recapFeedbackText =
        options.recapFeedback ||
        (mealRecapFeedback === 'liked'
          ? 'User liked the previous recipe but wants another preparation version.'
          : mealRecapFeedback === 'disliked'
            ? 'User disliked the previous recipe and wants a more practical way to make the meal.'
            : '');
      const res = await aiApi.post('/meal/recap', {
        meal: normalizedMeal,
        current_calories_consumed: currentMacros.cals,
        protein_consumed: currentMacros.pro,
        carbs_consumed: currentMacros.carb,
        fat_consumed: currentMacros.fat,
        app_language: String(i18n?.language || '').toLowerCase().startsWith('he') ? 'he' : 'en',
        time_of_day: format(new Date(), 'HH:mm'),
        meal_period: normalizedMeal.meal_type || getCurrentMealPeriod(new Date()),
        day_of_week: format(new Date(), 'EEEE').toLowerCase(),
        meal_request_note: lastMealRequestContext?.text || '',
        meal_request_priority: lastMealRequestContext?.priority || 'normal',
        nutrition_preferences: structuredNutritionPreferences || null,
        workout_context: buildWorkoutContextPayload(),
        accepted_meal_history: acceptedMealHistory,
        previous_recap: previousSummary,
        recap_feedback: recapFeedbackText,
        variation_request: options.variationRequest || '',
      }, { timeout: 20000 });

      const recap = res?.data || {};
      openMealRecapDialog({
        title: String(recap.recipe_title || normalizedMeal.meal_name || '').trim(),
        recipeTitle: String(recap.recipe_title || normalizedMeal.meal_name || '').trim(),
        ingredientsRubric: normalizeIngredientRubric(recap.ingredients_rubric),
        recipeGuide: String(recap.recipe_guide || recap.recipe_text || '').trim(),
        recipeText: String(recap.recipe_guide || recap.recipe_text || '').trim(),
        mealMacros: recap.meal_macros || {
          calories: normalizedMeal.total_calories,
          protein: normalizedMeal.total_protein,
          carbs: normalizedMeal.total_carbs,
          fat: normalizedMeal.total_fat,
        },
        updatedMacros: recap.updated_macros || {},
        source: recap.source || {
          label: t('nutrition.recapSourceGenerated', 'Generated from your selected meal, profile, nutrition preferences, training context, and saved meals.'),
          url: '',
          provider: recap._provider || '',
        },
      }, { meal: normalizedMeal });
    } catch (error) {
      const failureReason = String(
        error?.response?.data?.message ||
        error?.message ||
        t('nutrition.generateMealFailed', 'Failed to generate meal.')
      );
      console.error('Failed to generate meal recap:', error?.response?.data || error?.message || error);
      window.alert(
        t(
          'nutrition.geminiRecapFallbackShown',
          `Gemini failed while generating the recapy, so a local fallback recipe is being shown instead. ${failureReason}`
        )
      );
      openMealRecapDialog(buildLocalMealRecapy(normalizedMeal), { meal: normalizedMeal });
    } finally {
      setIsMealRecapLoading(false);
    }
  };

  const handleMealRecap = async (meal) => {
    setMealRecapFeedback(null);
    await requestMealRecap(meal, {
      keepExisting: false,
      previousSummary: '',
      recapFeedback: '',
      variationRequest: '',
    });
  };

  const handleSearchAnotherRecapy = async () => {
    if (!mealRecapContext?.meal) return;
    await requestMealRecap(mealRecapContext.meal, {
      keepExisting: true,
      variationRequest: 'Provide a noticeably different recipe version or preparation method for the same meal. Keep it practical and avoid repeating the previous wording.',
    });
  };

  const handleMealRecapFeedback = async (value) => {
    if (isLikedRecapMutating) return;

    const currentLikedRecapId =
      mealRecapData?.likedRecapId ||
      mealRecapContext?.likedRecapId ||
      null;

    if (value === 'liked') {
      if (currentLikedRecapId && mealRecapFeedback === 'liked') {
        setIsLikedRecapMutating(true);
        try {
          await api.delete(`/nutrition/liked-recaps/${currentLikedRecapId}`);
          setLikedRecapItems((prev) => prev.filter((item) => item.id !== currentLikedRecapId));
          setMealRecapData((prev) => prev ? { ...prev, likedRecapId: null } : prev);
          setMealRecapContext((prev) => prev ? { ...prev, likedRecapId: null } : prev);
          setMealRecapFeedback(null);
        } catch (err) {
          console.error('Failed to remove liked recapy:', err?.response?.data || err?.message || err);
        } finally {
          setIsLikedRecapMutating(false);
        }
        return;
      }

      const payload = buildCurrentLikedRecapPayload();
      if (!payload) return;

      setIsLikedRecapMutating(true);
      try {
        const res = await api.post('/nutrition/liked-recaps', payload);
        const savedItem = res?.data?.item || null;
        if (savedItem?.id) {
          setLikedRecapItems((prev) => {
            const rest = prev.filter((item) => item.id !== savedItem.id);
            return [savedItem, ...rest];
          });
          setMealRecapData((prev) => prev ? { ...prev, likedRecapId: savedItem.id } : prev);
          setMealRecapContext((prev) => prev ? { ...prev, likedRecapId: savedItem.id } : prev);
          setMealRecapFeedback('liked');
        }
      } catch (err) {
        console.error('Failed to save liked recapy:', err?.response?.data || err?.message || err);
      } finally {
        setIsLikedRecapMutating(false);
      }
      return;
    }

    if (value === 'disliked' && currentLikedRecapId) {
      setIsLikedRecapMutating(true);
      try {
        await api.delete(`/nutrition/liked-recaps/${currentLikedRecapId}`);
        setLikedRecapItems((prev) => prev.filter((item) => item.id !== currentLikedRecapId));
        setMealRecapData((prev) => prev ? { ...prev, likedRecapId: null } : prev);
        setMealRecapContext((prev) => prev ? { ...prev, likedRecapId: null } : prev);
      } catch (err) {
        console.error('Failed to remove liked recapy after dislike:', err?.response?.data || err?.message || err);
      } finally {
        setIsLikedRecapMutating(false);
      }
    }

    setMealRecapFeedback((prev) => (prev === value ? null : value));
  };

  const handleSaveLikedMealToTodaysLog = async () => {
    const meal = mealRecapContext?.meal;
    if (!meal) return;
    await saveMealToTodaysLog(meal, { closeOverlays: true });
  };

  const handleDeleteLikedRecap = async (recapId) => {
    if (!recapId || isLikedRecapMutating) return;

    setIsLikedRecapMutating(true);
    try {
      await api.delete(`/nutrition/liked-recaps/${recapId}`);
      setLikedRecapItems((prev) => prev.filter((item) => item.id !== recapId));
      if (mealRecapData?.likedRecapId === recapId) {
        setMealRecapData((prev) => prev ? { ...prev, likedRecapId: null } : prev);
        setMealRecapContext((prev) => prev ? { ...prev, likedRecapId: null } : prev);
        setMealRecapFeedback((prev) => (prev === 'liked' ? null : prev));
      }
    } catch (err) {
      console.error('Failed to delete liked recapy:', err?.response?.data || err?.message || err);
    } finally {
      setIsLikedRecapMutating(false);
    }
  };

  const closeMealRecapDialog = () => {
    setShowMealRecapDialog(false);
    setMealRecapData(null);
    setMealRecapContext(null);
    setMealRecapFeedback(null);
    setIsMealRecapLoading(false);
  };

  const openLikedRecapsDialog = async () => {
    setShowLikedRecapsDialog(true);
    await loadLikedRecapItems();
  };

  const handleGenerateMealFromAddFood = (requestText = '') => {
    const targetPeriodId = activeSearchPeriod;
    setActiveSearchPeriod(null);
    requestMealPlan(requestText, null, '', {
      mealRequestPriority: requestText.trim() ? 'high' : 'normal',
      targetOptions: 2,
      targetPeriodId,
    });
  };

  const handleSelectMealOption = (index) => {
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= mealOptions.length) return;
    setSelectedMealOptionIndex(idx);
    setCurrentMeal(mealOptions[idx] || null);
  };

  const openSomethingElseDialog = () => {
    // Close current meal card so the refine dialog is always visible above overlays
    setShowMealPlan(false);
    setMealRefineText('');
    setShowMealRefineDialog(true);
  };

  const handleSubmitSomethingElse = () => {
    const text = mealRefineText.trim();
    if (!text) {
      window.alert(t('nutrition.somethingElseValidation', 'Please write what you want to change in the meal.'));
      return;
    }

    setShowMealRefineDialog(false);
    setMealRefineText('');

    requestMealPlan(text, null, '', {
      mealRequestPriority: 'high',
      openMealPlanCard: true,
      appendAlternative: true,
    });
  };

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex justify-between items-end"
      >
        <div>
          <h1 className="text-2xl font-bold">{t('nutrition.title', 'Nutrition')}</h1>
          <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <div className="text-right">
          <p className="text-[#00F2FF] font-semibold text-sm capitalize">{String(t(`nutrition.dietTypes.${dietType}`, `${dietType} Diet`))}</p>
          <p className="text-gray-400 text-xs">{String(t(`nutrition.goals.${goal}`, GOAL_LABELS[goal]))}</p>
        </div>
      </motion.div>

      {/* ─── Action Buttons ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6"
      >
        <button
          onClick={() => setShowSwipeGame(true)}
          className="relative overflow-hidden rounded-xl p-4 border border-[#2A2A2A] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] hover:border-pink-500/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Heart className="w-5 h-5 text-pink-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('nutrition.rateFood', 'Rate Food')}</p>
              <p className="text-xs text-gray-500">{likedFoods.length} {t('nutrition.liked', 'liked')}</p>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">💘</div>
        </button>

        <button
          onClick={openNutritionPreferencesDialog}
          className="relative overflow-hidden rounded-xl p-4 border border-[#2A2A2A] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] hover:border-[#CCFF00]/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SlidersHorizontal className="w-5 h-5 text-[#CCFF00]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('nutrition.tellMeWhatYouLike', 'Tell Me What You Like')}</p>
              <p className="text-xs text-gray-500">
                {nutritionPreferencesNote
                  ? t('nutrition.preferencesSaved', 'Saved')
                  : t('nutrition.setNutritionPriorities', 'Set nutrition priorities')}
              </p>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">🥗</div>
        </button>

        <button
          onClick={openMealRequestDialog}
          className="relative overflow-hidden rounded-xl p-4 border bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] transition-all group border-[#2A2A2A] hover:border-[#00F2FF]/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F2FF]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Utensils className="w-5 h-5 text-[#00F2FF]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('nutrition.planMeal', 'Plan Meal')}</p>
              <p className="text-xs text-gray-500">
                {currentPeriodHasAIMeal
                  ? t('nutrition.mealWillReplaceCurrent', 'Will replace current AI meal')
                  : t('nutrition.aiPowered', 'AI Powered')}
              </p>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">🍽️</div>
        </button>

        <button
          onClick={openLikedRecapsDialog}
          className="relative overflow-hidden rounded-xl p-4 border border-[#2A2A2A] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] hover:border-[#FF8AC7]/35 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF8AC7]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Heart className="w-5 h-5 text-[#FF8AC7]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('nutrition.likedMealsAndRecapies', 'Liked meals and recapies')}</p>
              <p className="text-xs text-gray-500">{likedRecapItems.length} {t('nutrition.savedRecapies', 'saved recapies')}</p>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">♥</div>
        </button>
      </motion.div>

      {/* Macro Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-8"
      >
        {macroCards.map((macro, index) => {
          const percentage = Math.min(Math.round((macro.value / macro.target) * 100), 100);
          const Icon = macro.icon;

          return (
            <motion.div
              key={macro.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${macro.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: macro.color }} />
                </div>
                <span className="text-sm text-gray-400">{macro.label}</span>
              </div>

              <div className="mb-2">
                <span className="text-2xl font-bold" style={{ color: macro.color }}>
                  {macro.value}
                </span>
                <span className="text-sm text-gray-500"> / {macro.target}{macro.unit}</span>
              </div>

              <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: macro.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Diet Tip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 bg-[#00F2FF]/5 border border-[#00F2FF]/20 rounded-xl p-4 flex gap-3"
      >
        <div className="shrink-0 mt-0.5">
          <Target className="w-5 h-5 text-[#00F2FF]" />
        </div>
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-white">{t('nutrition.coachTip', 'Coach tip:')} </span> {String(t(`nutrition.dietTips.${dietType}`, DIET_TIPS[dietType]))}
        </p>
      </motion.div>

      {/* Dynamic Daily Tracker */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {t('nutrition.todaysLog', "Today's Log")} ({periods.length} {t('nutrition.mealsCount', 'Meals')})
          </h2>
        </div>

        <div className="space-y-4">
          {periods.map((period, index) => {
            const periodFoods = loggedFoods[period.id] || [];

            // Group plan meals by meal_type; fall back to grouping by sets of 4 (index-based)
            const allPlanMeals = activeMealPlan?.meals || [];
            // Collect all unique meal_types in order they appear
            const mealTypeOrder = [];
            allPlanMeals.forEach(m => {
              if (m.meal_type && !mealTypeOrder.includes(m.meal_type)) mealTypeOrder.push(m.meal_type);
            });
            // If meal_types are present, group by them; otherwise chunk by 4
            let planMealOptions = [];
            if (mealTypeOrder.length > 0) {
              const typeForThisSlot = mealTypeOrder[index];
              planMealOptions = typeForThisSlot
                ? allPlanMeals.filter(m => m.meal_type === typeForThisSlot)
                : [];
            } else if (allPlanMeals.length > 0) {
              // Fallback: each group of 4 maps to a period slot
              const chunk = allPlanMeals.slice(index * 4, index * 4 + 4);
              planMealOptions = chunk;
            }
            const hasPlanOptions = planMealOptions.length > 0;

            const pCals = periodFoods.reduce((sum, f) => sum + (f.cals || 0), 0);

            return (
              <motion.div
                key={period.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="rounded-xl p-4 border bg-[#1A1A1A] border-[#2A2A2A]"
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-[#00F2FF]">{period.label}</h3>
                  <span className="text-sm text-gray-400">{pCals} {t('common.kcal', 'kcal')}</span>
                </div>

                {/* Logged Foods */}
                {periodFoods.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {periodFoods.map((food, fIdx) => (
                      <div key={fIdx} className="flex justify-between items-center bg-[#2A2A2A] rounded-lg p-2 text-sm">
                        <div className="flex-1 truncate pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white block truncate">{String(t(`nutrition.foods.${food.name}`, food.name))}</span>
                            {food._aiTime && (
                              <span className="text-[#CCFF00]/60 text-xs shrink-0">✦ {food._aiTime}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{food.cals} {t('common.kcal', 'kcal')} - P:{food.protein} C:{food.carbs} F:{food.fat}</span>
                        </div>
                        <button
                          onClick={() => removeFood(period.id, fIdx)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Plan Options — scrollable carousel of 4 choices */}
                {periodFoods.length === 0 && hasPlanOptions && (
                  <div className="mb-3">
                    <p className="text-xs text-[#00F2FF]/70 mb-2">✦ Your plan — pick one:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                      {planMealOptions.map((meal, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => setSelectedPlanMeal(meal)}
                          className="snap-start shrink-0 w-48 text-left bg-[#2A2A2A] rounded-lg p-3 border border-[#00F2FF]/20 hover:border-[#00F2FF]/50 transition-all group"
                        >
                          <p className="text-white font-medium text-xs leading-tight line-clamp-2">{meal.meal_name}</p>
                          {meal.foods && meal.foods.length > 0 && (
                            <p className="text-gray-600 text-xs mt-1 truncate">
                              {meal.foods.map(f => f.name).join(' · ')}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs mt-1.5">
                            {meal.calories || 0} kcal · P:{meal.protein || 0}g
                          </p>
                          <p className="text-[#00F2FF]/50 text-xs mt-1 group-hover:text-[#00F2FF] transition-colors">
                            Tap for details →
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setActiveSearchPeriod(period.id)}
                  className="w-full py-2 flex items-center justify-center gap-2 border border-dashed border-[#3A3A3A] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#00F2FF]/50 transition-all"
                >
                  <Plus className="w-4 h-4" /> {t('nutrition.addFood', 'Add Food')}
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="mb-8"
      >
        <NutritionCalendar onDataChanged={loadTodaysLogs} />
      </motion.div>

      {/* Ask Coach Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-2xl p-5 border border-[#2A2A2A]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full gradient-cyan flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-semibold">{t('coach.askYourCoach', 'Ask Your Coach')}</h3>
            <p className="text-xs text-gray-500">{t('coach.personalizedNutrition', 'Get personalized nutrition advice')}</p>
          </div>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="w-full flex items-center justify-center p-3 rounded-xl gradient-cyan text-black font-semibold"
        >
          <span>{t('coach.chatWithCoach', 'Chat with Coach')}</span>
          <ChevronRight className="w-4 h-4 ml-2" />
        </button>
      </motion.div>

      {/* Demo Notice */}
      <p className="text-xs text-gray-600 text-center mt-6">
        📊 {t('nutrition.demoNotice', 'Demo data shown. In the full version, this syncs with your actual intake.')}
      </p>

      {/* Global Coach Chat */}
      <GlobalCoachChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context="Nutrition"
        coachStyle={coachStyle}
      />

      {/* Manual Food Entry Sheet */}
      <AnimatePresence>
        {activeSearchPeriod && (
          <ManualFoodEntry
            periodLabel={periods.find(p => p.id === activeSearchPeriod)?.label || ''}
            onAdd={handleAddFood}
            onAddMeal={handleAddMeal}
            onGenerateMeal={handleGenerateMealFromAddFood}
            onClose={() => setActiveSearchPeriod(null)}
          />
        )}
      </AnimatePresence>

      {/* Food Swipe Game Overlay */}
      <AnimatePresence>
        {showSwipeGame && (
          <FoodSwipeGame
            onClose={handleSwipeGameClose}
            existingLiked={likedFoods}
            existingDisliked={dislikedFoods}
          />
        )}
      </AnimatePresence>

      {/* Meal Plan Overlay */}
      <AnimatePresence>
        {showMealPlan && (
          <MealPlanCard
            meal={currentMeal}
            mealOptions={mealOptions}
            selectedOptionIndex={selectedMealOptionIndex}
            onSelectOption={handleSelectMealOption}
            isLoading={isMealLoading}
            onClose={() => {
              setShowMealPlan(false);
              setCurrentMeal(null);
              setMealOptions([]);
              setSelectedMealOptionIndex(null);
              setMealPlanTargetPeriodId(null);
            }}
            onRefresh={() => requestMealPlan(
              lastMealRequestContext?.text || '',
              null,
              '',
              { mealRequestPriority: lastMealRequestContext?.priority || 'normal' }
            )}
            onLogMeal={handleLogMeal}
            onRecap={handleMealRecap}
            onSomethingElse={openSomethingElseDialog}
          />
        )}
      </AnimatePresence>

      <Dialog open={showNutritionPreferencesDialog} onOpenChange={setShowNutritionPreferencesDialog}>
        <DialogContentAny className="bg-[#0A0A0A] border border-[#2A2A2A] text-white">
          <DialogHeaderAny>
            <DialogTitleAny>{t('nutrition.tellMeWhatYouLike', 'Tell Me What You Like')}</DialogTitleAny>
          </DialogHeaderAny>

          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {t('nutrition.tellMeWhatYouLikePrompt', 'Tell the coach what is important to you in nutrition (for example: high protein, low sugar, quick meals, budget-friendly).')}
            </p>
            <TextareaAny
              value={nutritionPreferencesDraft}
              onChange={(e) => setNutritionPreferencesDraft(e.target.value)}
              placeholder={t('nutrition.tellMeWhatYouLikePlaceholder', 'e.g., I want high-protein meals, low sugar, easy prep, and foods that keep me full for long.')}
              className="min-h-[120px] bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
            />

            {nutritionPreferencesError ? (
              <p className="text-sm text-red-400">{nutritionPreferencesError}</p>
            ) : null}

            <div className="flex gap-3">
              <button
                onClick={() => setShowNutritionPreferencesDialog(false)}
                className="flex-1 h-10 rounded-md border border-[#2A2A2A] text-white hover:bg-[#1A1A1A] transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSaveNutritionPreferences}
                disabled={isSavingNutritionPreferences}
                className="flex-1 h-10 rounded-md gradient-cyan text-black font-semibold disabled:opacity-60"
              >
                {isSavingNutritionPreferences
                  ? t('common.loading', 'Loading...')
                  : t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </DialogContentAny>
      </Dialog>

      <Dialog
        open={showMealPlanRefreshPrompt}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeMealPlanRefreshPrompt();
          } else {
            setShowMealPlanRefreshPrompt(true);
          }
        }}
      >
        <DialogContentAny className="bg-[#0A0A0A] border border-[#2A2A2A] text-white">
          <DialogHeaderAny>
            <DialogTitleAny>{t('nutrition.updateMealPlanTitle', 'Update Meal Plan')}</DialogTitleAny>
          </DialogHeaderAny>

          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {t('nutrition.updateMealPlanQuestion', 'Do you want to update your meal plan?')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleMealPlanRefreshDecision(false)}
                className="flex-1 h-10 rounded-md border border-[#2A2A2A] text-white hover:bg-[#1A1A1A] transition-colors"
              >
                {t('common.no', 'No')}
              </button>
              <button
                onClick={() => handleMealPlanRefreshDecision(true)}
                disabled={isRefreshingMealPlan}
                className="flex-1 h-10 rounded-md gradient-cyan text-black font-semibold"
              >
                {isRefreshingMealPlan
                  ? t('common.loading', 'Loading...')
                  : t('nutrition.updateTodaysLog', "Yes, update Today's Log")}
              </button>
            </div>
          </div>
        </DialogContentAny>
      </Dialog>

      <Dialog open={showMealRequestDialog} onOpenChange={setShowMealRequestDialog}>
        <DialogContentAny className="bg-[#0A0A0A] border border-[#2A2A2A] text-white">
          <DialogHeaderAny>
            <DialogTitleAny>{t('nutrition.planMeal', 'Plan Meal')}</DialogTitleAny>
          </DialogHeaderAny>

          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {t('nutrition.mealRequestPrompt', 'Describe what meal you want.')}
            </p>
            <TextareaAny
              value={mealRequestText}
              onChange={(e) => setMealRequestText(e.target.value)}
              placeholder={t('nutrition.mealRequestPlaceholder', 'e.g., Light savory meal with high protein, low carbs, and around 500 calories.')}
              className="min-h-[110px] bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowMealRequestDialog(false)}
                className="flex-1 h-10 rounded-md border border-[#2A2A2A] text-white hover:bg-[#1A1A1A] transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleMealRequestSubmit}
                className="flex-1 h-10 rounded-md gradient-cyan text-black font-semibold"
              >
                {t('nutrition.generateMeal', 'Generate Meal')}
              </button>
            </div>
          </div>
        </DialogContentAny>
      </Dialog>

      <Dialog open={showMealRefineDialog} onOpenChange={setShowMealRefineDialog}>
        <DialogContentAny className="bg-[#0A0A0A] border border-[#2A2A2A] text-white">
          <DialogHeaderAny>
            <DialogTitleAny>{t('nutrition.somethingElse', 'Something else')}</DialogTitleAny>
          </DialogHeaderAny>

          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {t('nutrition.somethingElsePrompt', 'Add more details about the meal you want. This request will be treated as high priority.')}
            </p>
            <TextareaAny
              value={mealRefineText}
              onChange={(e) => setMealRefineText(e.target.value)}
              placeholder={t('nutrition.somethingElsePlaceholder', 'e.g., I want something warm, savory, with tofu and very low fat.')}
              className="min-h-[110px] bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-gray-500"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowMealRefineDialog(false)}
                className="flex-1 h-10 rounded-md border border-[#2A2A2A] text-white hover:bg-[#1A1A1A] transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSubmitSomethingElse}
                className="flex-1 h-10 rounded-md gradient-cyan text-black font-semibold"
              >
                {t('nutrition.generateAlternativeMeal', 'Generate another meal')}
              </button>
            </div>
          </div>
        </DialogContentAny>
      </Dialog>

      <Dialog open={showLikedRecapsDialog} onOpenChange={setShowLikedRecapsDialog}>
        <DialogContentAny className="max-w-3xl border border-[#2A2A2A] bg-[#081018] text-white">
          <DialogHeaderAny>
            <DialogTitleAny>{t('nutrition.likedMealsAndRecapies', 'Liked meals and recapies')}</DialogTitleAny>
          </DialogHeaderAny>

          {isLikedRecapsLoading ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">{t('nutrition.loadingLikedRecapies', 'Loading your liked recapies...')}</p>
            </div>
          ) : likedRecapItems.length ? (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {likedRecapItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#2A2A2A] bg-[#111827]/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-[#00F2FF]">{item?.meal?.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion')}</p>
                      {item?.meal?.meal_type ? (
                        <p className="mt-1 text-xs capitalize text-gray-500">{String(item.meal.meal_type).replace(/_/g, ' ')}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-gray-500">{format(new Date(item.updatedAt || item.createdAt || Date.now()), 'MMM d, yyyy')}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteLikedRecap(item.id)}
                        disabled={isLikedRecapMutating}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-400 transition-colors hover:border-[#FF6B6B]/40 hover:text-[#FF8A8A] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('common.delete', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {(item?.recap?.recipe_title || item?.recap?.title) ? (
                    <p className="mt-4 text-base font-medium text-white">{item.recap.recipe_title || item.recap.title}</p>
                  ) : null}

                  {resolveRecapIngredients(item?.recap).length ? (
                    <div className="mt-4 rounded-xl border border-[#2A2A2A] bg-[#0B1220] p-3">
                      <p className="mb-3 text-xs uppercase tracking-wider text-gray-500">{t('nutrition.ingredientsRubric', 'Ingredients')}</p>
                      <ul className="space-y-2 text-sm text-gray-200">
                        {resolveRecapIngredients(item.recap).map((ingredient, index) => (
                          <li key={`${item.id}-ingredient-${index}`} className="rounded-lg bg-white/[0.03] px-3 py-2">
                            {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {resolveRecapGuideText(item?.recap) ? (
                    <div className="mt-4 rounded-xl border border-[#2A2A2A] bg-[#0B1220] p-3">
                      <p className="mb-3 text-xs uppercase tracking-wider text-gray-500">{t('nutrition.recipeGuide', 'Recipe guide')}</p>
                      <p className="text-sm leading-6 text-gray-200 whitespace-pre-line">{resolveRecapGuideText(item.recap)}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#2A2A2A] bg-[#0B1220] p-3">
                      <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">{t('nutrition.mealMacros', 'Meal macros')}</p>
                      <p dir="ltr" className="text-sm text-gray-200">{`${item?.recap?.meal_macros?.calories ?? 0} kcal | P:${item?.recap?.meal_macros?.protein ?? 0}g | C:${item?.recap?.meal_macros?.carbs ?? 0}g | F:${item?.recap?.meal_macros?.fat ?? 0}g`}</p>
                    </div>
                    <div className="rounded-xl border border-[#2A2A2A] bg-[#0B1220] p-3">
                      <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">{t('nutrition.updatedDailyMacros', 'Updated daily macros')}</p>
                      <p dir="ltr" className="text-sm text-gray-200">{`${item?.recap?.updated_macros?.consumed_after_meal?.calories ?? 0} kcal | P:${item?.recap?.updated_macros?.consumed_after_meal?.protein ?? 0}g | C:${item?.recap?.updated_macros?.consumed_after_meal?.carbs ?? 0}g | F:${item?.recap?.updated_macros?.consumed_after_meal?.fat ?? 0}g`}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#2A2A2A] bg-[#0B1220] p-3">
                    <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">{t('nutrition.recapSource', 'Recapy source')}</p>
                    {item?.recap?.source?.url ? (
                      <a
                        href={item.recap.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-[#00F2FF] hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('nutrition.openRecapSource', 'Open source link')}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-300">{item?.recap?.source?.label || t('nutrition.noRecapSourceLink', 'No external source link is available for this recapy.')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">{t('nutrition.noLikedRecapies', 'You have no liked meals or recapies yet.')}</p>
            </div>
          )}
        </DialogContentAny>
      </Dialog>

      <Dialog
        open={showMealRecapDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeMealRecapDialog();
            return;
          }
          setShowMealRecapDialog(true);
        }}
      >
        <DialogContentAny className="max-w-3xl overflow-hidden border border-[#2A2A2A] bg-[#050816] p-0 text-white">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,242,255,0.16),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(204,255,0,0.12),_transparent_32%)]" />
            <div className="relative border-b border-white/10 px-6 py-5">
              <DialogHeaderAny className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#00F2FF]/70">
                      {t('nutrition.recapTitle', 'Meal recapy')}
                    </p>
                    <DialogTitleAny className="mt-2 text-2xl font-semibold text-white">
                      {mealRecapData?.title || t('nutrition.mealSuggestion', 'Meal suggestion')}
                    </DialogTitleAny>
                  </div>
                  {mealRecapData?.source?.provider ? (
                    <div className="rounded-full border border-[#00F2FF]/25 bg-[#00F2FF]/10 px-3 py-1 text-xs text-[#B8FBFF]">
                      {mealRecapData.source.provider}
                    </div>
                  ) : null}
                </div>
              </DialogHeaderAny>
            </div>
          </div>

          {isMealRecapLoading ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00F2FF]/20 bg-[#00F2FF]/10">
                <RefreshCcw className="h-5 w-5 animate-spin text-[#00F2FF]" />
              </div>
              <p className="text-sm text-gray-300">{t('nutrition.loadingRecap', 'Building your recapy...')}</p>
              <p className="mt-2 text-xs text-gray-500">
                {t('nutrition.loadingRecapSubtext', 'Reviewing your meal, daily targets, and preference context.')}
              </p>
            </div>
          ) : mealRecapData ? (
            <>
              <div className="max-h-[68vh] space-y-4 overflow-y-auto px-6 py-5">
                <section className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(17,24,39,0.94),rgba(8,12,24,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#CCFF00]/80">
                    {t('nutrition.recipeTitle', 'Recipe')}
                  </p>
                  {(mealRecapData.recipeTitle || mealRecapData.title) ? (
                    <p className="mt-3 text-xl font-semibold text-white">
                      {mealRecapData.recipeTitle || mealRecapData.title}
                    </p>
                  ) : null}
                </section>

                {resolveRecapIngredients(mealRecapData).length ? (
                  <section className="rounded-3xl border border-white/10 bg-[#0A0F1D] p-5">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#00F2FF]/80">
                      {t('nutrition.ingredientsRubric', 'Ingredients')}
                    </p>
                    <ul className="mt-4 grid gap-3 md:grid-cols-2">
                      {resolveRecapIngredients(mealRecapData).map((ingredient, index) => (
                        <li
                          key={`current-recap-ingredient-${index}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-100"
                        >
                          {ingredient}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,32,0.96),rgba(7,11,20,0.98))] p-5 shadow-[0_16px_45px_rgba(0,0,0,0.28)]">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#CCFF00]/80">
                    {t('nutrition.recipeGuide', 'Recipe guide')}
                  </p>
                  <p className="mt-4 text-base leading-8 text-gray-100 whitespace-pre-line">
                    {resolveRecapGuideText(mealRecapData) || t('nutrition.recipeGuideFallbackOnly', 'Build this meal from beginning to end using practical portions, clear preparation steps, and cooking or assembly instructions that respect your restrictions while staying generally close to the selected meal.')}
                  </p>
                </section>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#2A2A2A] bg-[#121212] p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{t('nutrition.mealMacros', 'Meal macros')}</p>
                  <p dir="ltr" className="text-sm text-gray-200">{`${mealRecapData?.mealMacros?.calories ?? 0} kcal | P:${mealRecapData?.mealMacros?.protein ?? 0}g | C:${mealRecapData?.mealMacros?.carbs ?? 0}g | F:${mealRecapData?.mealMacros?.fat ?? 0}g`}</p>
                </div>
                <div className="rounded-xl border border-[#2A2A2A] bg-[#121212] p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{t('nutrition.updatedDailyMacros', 'Updated daily macros')}</p>
                  <p dir="ltr" className="text-sm text-gray-200">{`${mealRecapData?.updatedMacros?.consumed_after_meal?.calories ?? 0} kcal | P:${mealRecapData?.updatedMacros?.consumed_after_meal?.protein ?? 0}g | C:${mealRecapData?.updatedMacros?.consumed_after_meal?.carbs ?? 0}g | F:${mealRecapData?.updatedMacros?.consumed_after_meal?.fat ?? 0}g`}</p>
                </div>
              </div>

              {mealRecapData?.updatedMacros?.remaining_after_meal ? (
                <div className="rounded-xl border border-[#2A2A2A] bg-[#121212] p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{t('nutrition.remainingAfterMeal', 'Remaining after meal')}</p>
                  <p dir="ltr" className="text-sm text-gray-200">{`${mealRecapData.updatedMacros.remaining_after_meal.calories ?? 0} kcal | P:${mealRecapData.updatedMacros.remaining_after_meal.protein ?? 0}g | C:${mealRecapData.updatedMacros.remaining_after_meal.carbs ?? 0}g | F:${mealRecapData.updatedMacros.remaining_after_meal.fat ?? 0}g`}</p>
                </div>
              ) : null}

              {mealRecapData.source ? (
                <div className="rounded-xl border border-[#2A2A2A] bg-[#121212] p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-gray-500">{t('nutrition.recapSource', 'Recapy source')}</p>
                  {mealRecapData.source.label ? (
                    <p className="text-sm text-gray-200 leading-relaxed">{mealRecapData.source.label}</p>
                  ) : null}
                  {mealRecapData.source.provider ? (
                    <p className="text-xs text-gray-500">{`Provider: ${mealRecapData.source.provider}`}</p>
                  ) : null}
                  {mealRecapData.source.url ? (
                    <a
                      href={mealRecapData.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#00F2FF] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('nutrition.openRecapSource', 'Open source link')}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">{t('nutrition.noRecapSourceLink', 'No external source link is available for this recapy.')}</p>
                  )}
                </div>
              ) : null}
              </div>

              <div className="sticky bottom-0 flex flex-col gap-3 border-t border-white/10 bg-[#060A14]/95 px-1 pt-4 backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSearchAnotherRecapy}
                    disabled={isMealRecapLoading || isLikedRecapMutating || !mealRecapContext?.meal}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#00F2FF]/25 bg-[#00F2FF]/10 px-4 text-sm font-medium text-[#C4FCFF] transition-colors hover:border-[#00F2FF]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCcw className={`h-4 w-4 ${isMealRecapLoading ? 'animate-spin' : ''}`} />
                    {t('nutrition.searchAnotherRecap', 'Search another recapy')}
                  </button>
                  <button
                    onClick={() => handleMealRecapFeedback('liked')}
                    disabled={isLikedRecapMutating || !resolveRecapGuideText(mealRecapData)}
                    className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
                      mealRecapFeedback === 'liked'
                        ? 'border-[#CCFF00]/50 bg-[#CCFF00]/12 text-[#F1FFC0]'
                        : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white'
                    } ${isLikedRecapMutating || !resolveRecapGuideText(mealRecapData) ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {t('common.like', 'Like')}
                  </button>
                  <button
                    onClick={() => handleMealRecapFeedback('disliked')}
                    disabled={isLikedRecapMutating}
                    className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
                      mealRecapFeedback === 'disliked'
                        ? 'border-[#FF6B6B]/45 bg-[#FF6B6B]/12 text-[#FFD0D0]'
                        : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white'
                    } ${isLikedRecapMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {t('common.dislike', 'Dislike')}
                  </button>
                  {mealRecapFeedback === 'liked' && mealRecapContext?.meal ? (
                    <button
                      onClick={handleSaveLikedMealToTodaysLog}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#00F2FF] px-4 text-sm font-semibold text-black transition-colors hover:brightness-110"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t('nutrition.saveLikedMealToTodaysLog', "Save this meal to Today's Log")}
                    </button>
                  ) : null}
                </div>
                <button
                  onClick={closeMealRecapDialog}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 px-4 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">{t('nutrition.noRecapAvailable', 'No recapy is available yet.')}</p>
            </div>
          )}
        </DialogContentAny>
      </Dialog>
      {/* Plan Meal Detail Sheet */}
      <AnimatePresence>
        {selectedPlanMeal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlanMeal(null)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] rounded-t-2xl border-t border-[#2A2A2A] max-h-[80vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#3A3A3A]" />
              </div>

              <div className="px-5 pb-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-4 pt-2">
                  <div>
                    <p className="text-xs text-[#00F2FF]/70 mb-1">✦ Your plan</p>
                    <h3 className="text-xl font-bold text-white">{selectedPlanMeal.meal_name}</h3>
                    {selectedPlanMeal.meal_type && (
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{selectedPlanMeal.meal_type.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedPlanMeal(null)} className="p-2 text-gray-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Macro summary */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {[
                    { label: 'Calories', value: selectedPlanMeal.calories || 0, unit: '', color: '#00F2FF' },
                    { label: 'Protein', value: selectedPlanMeal.protein || 0, unit: 'g', color: '#CCFF00' },
                    { label: 'Carbs', value: selectedPlanMeal.carbs || 0, unit: 'g', color: '#FF6B6B' },
                    { label: 'Fat', value: selectedPlanMeal.fat || 0, unit: 'g', color: '#FFD93D' },
                  ].map(m => (
                    <div key={m.label} className="bg-[#1A1A1A] rounded-xl p-2 text-center border border-[#2A2A2A]">
                      <p className="text-base font-bold" style={{ color: m.color }}>{m.value}{m.unit}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Foods list */}
                {selectedPlanMeal.foods && selectedPlanMeal.foods.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Foods</p>
                    <div className="space-y-2">
                      {selectedPlanMeal.foods.map((food, i) => (
                        <div key={i} className="flex justify-between items-center bg-[#1A1A1A] rounded-lg px-3 py-2.5 border border-[#2A2A2A]">
                          <div>
                            <p className="text-sm text-white font-medium">{food.name}</p>
                            {food.portion && <p className="text-xs text-gray-500">{food.portion}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-300">{food.calories || 0} kcal</p>
                            <p className="text-xs text-gray-600">P:{food.protein || 0} C:{food.carbs || 0} F:{food.fat || 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleMealRecap(selectedPlanMeal)}
                  className="w-full mt-5 h-11 rounded-xl border border-[#2A2A2A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#1A1A1A] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t('nutrition.giveMeRecap', 'Give me recapy')}
                </button>

                {/* Log this meal button */}
                <button
                  onClick={() => {
                    const periodId = getPeriodId(new Date().getHours());
                    setLoggedFoods(prev => ({
                      ...prev,
                      [periodId]: [...(prev[periodId] || []), {
                        name: selectedPlanMeal.meal_name,
                        cals: selectedPlanMeal.calories || 0,
                        protein: selectedPlanMeal.protein || 0,
                        carbs: selectedPlanMeal.carbs || 0,
                        fat: selectedPlanMeal.fat || 0,
                      }]
                    }));
                    api.post('/nutrition', {
                      meal_name: selectedPlanMeal.meal_name,
                      calories: selectedPlanMeal.calories || 0,
                      protein: selectedPlanMeal.protein || 0,
                      carbs: selectedPlanMeal.carbs || 0,
                      fat: selectedPlanMeal.fat || 0,
                      date: new Date(),
                      foods: (selectedPlanMeal.foods || []).map(f => ({ name: f.name, portion: f.portion || '', calories: f.calories || 0 })),
                    }).catch(() => { });
                    setSelectedPlanMeal(null);
                  }}
                  className="w-full mt-5 h-12 gradient-cyan text-black font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Log This Meal
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

