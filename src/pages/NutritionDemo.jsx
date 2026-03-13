import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Flame, Beef, Wheat, Droplet, Target, MessageCircle, ChevronRight, Plus, X, Heart, Utensils, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';
import FoodSwipeGame from '@/components/nutrition/FoodSwipeGame';
import MealPlanCard from '@/components/nutrition/MealPlanCard';
import ManualFoodEntry from '@/components/nutrition/ManualFoodEntry';
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

export default function NutritionDemo() {
  const { user } = useAuth();
  const { t } = useTranslation();
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
  const [pendingNutritionPreferences, setPendingNutritionPreferences] = useState(null);
  const [pendingNutritionPreferencesNote, setPendingNutritionPreferencesNote] = useState('');
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
  useEffect(() => {
    loadFoodPreferences();
    api.get('/nutrition/menu/active')
      .then(res => { if (res.data) setActiveMealPlan(res.data); })
      .catch(() => { });
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    api.get(`/nutrition/date/${todayStr}`)
      .then(res => {
        const logs = res.data || [];
        if (logs.length === 0) return;
        // Map each saved log into the correct period slot by its save time
        setLoggedFoods(prev => {
          const updated = { ...prev };
          logs.forEach(log => {
            const hour = new Date(log.createdAt || log.date).getHours();
            const pid = resolveVisiblePeriodId(hour, generateCoachPeriods(goal, dietType, t));
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
      })
      .catch(() => { });
  }, []);

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
    // Save to DB as a single-food log entry
    try {
      const now = new Date();
      await api.post('/nutrition', {
        meal_name: food.name,
        calories: food.cals,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
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
    try {
      const now = new Date();
      await api.post('/nutrition', {
        meal_name: meal.meal_name,
        calories: meal.total_calories,
        protein: meal.total_protein || 0,
        carbs: meal.total_carbs || 0,
        fat: meal.total_fat || 0,
        date: now,
        foods: (meal.foods || []).map(f => ({ name: f.name, portion: f.portion || '', calories: f.calories })),
      });
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
    } = options;

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

    try {
      const acceptedMealHistory = await fetchAcceptedMealHistory();
      const payload = {
        current_calories_consumed: currentMacros.cals,
        protein_consumed: currentMacros.pro,
        carbs_consumed: currentMacros.carb,
        fat_consumed: currentMacros.fat,
        time_of_day: format(now, 'HH:mm'),
        meal_period: getCurrentMealPeriod(now),
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
        let meal = null;
        let usedFallbackGenerator = false;
        let aiFailureReason = '';

        try {
          const res = await aiApi.post('/meal/next', requestPayload, { timeout: 20000 });
          meal = res?.data || null;
          if (!hasUsableMealContent(meal)) {
            throw new Error('AI returned an empty meal (0 macros / no valid foods)');
          }
        } catch (aiErr) {
          aiFailureReason = String(
            aiErr?.response?.data?.message ||
            aiErr?.response?.data?.error ||
            aiErr?.message ||
            'unknown AI error'
          );
          console.error('Primary AI meal generator failed, trying backend fallback:', aiErr?.response?.data || aiErr?.message);

          const fallbackPayload = {
            ...requestPayload,
            liked_foods: likedFoods || [],
            disliked_foods: (dislikedFoods || []).map((food) => food?.name || '').filter(Boolean),
            target_calories: profile?.target_calories || 2000,
            protein_goal: profile?.protein_goal || 150,
            carbs_goal: profile?.carbs_goal || 200,
            fat_goal: profile?.fat_goal || 65,
            diet_type: dietType,
            goal,
          };

          try {
            const fallbackRes = await api.post('/nutrition/meal-plan', fallbackPayload);
            meal = fallbackRes?.data || null;
            usedFallbackGenerator = true;
          } catch (fallbackErr) {
            const fallbackReason = String(
              fallbackErr?.response?.data?.message ||
              fallbackErr?.response?.data?.error ||
              fallbackErr?.message ||
              'unknown fallback error'
            );
            throw new Error(`AI failed: ${aiFailureReason}. Fallback failed: ${fallbackReason}`);
          }
        }

        if (!meal || typeof meal !== 'object' || !meal.meal_name || !hasUsableMealContent(meal)) {
          throw new Error('Meal generator did not return a valid meal object');
        }

        return { meal, usedFallbackGenerator };
      };

      const { meal: primaryMeal, usedFallbackGenerator: usedFallbackPrimary } = await generateSingleMealCandidate(payload);
      const generatedMeals = [primaryMeal];
      let usedFallbackGenerator = usedFallbackPrimary;

      setLastMealRequestContext({
        text: trimmedMealRequest,
        priority: normalizedMealRequestPriority,
      });

      const shouldGenerateTwoOptions = !autoLogToTodaysLog && !appendAlternative && Number(targetOptions) >= 2;
      if (shouldGenerateTwoOptions) {
        const alternativePrompt = trimmedMealRequest
          ? `${trimmedMealRequest}\nPlease provide a distinctly different meal option from the previous one.`
          : 'Please provide a distinctly different meal option from the previous one.';
        const secondPayload = {
          ...payload,
          meal_request_note: alternativePrompt,
          meal_request_priority: 'high',
        };

        try {
          const { meal: secondMeal, usedFallbackGenerator: usedFallbackSecond } = await generateSingleMealCandidate(secondPayload);
          usedFallbackGenerator = usedFallbackGenerator || usedFallbackSecond;
          generatedMeals.push(secondMeal);
        } catch (secondErr) {
          console.warn('Failed to generate second option. Continuing with one option.', secondErr?.message || secondErr);
        }
      }

      if (autoLogToTodaysLog) {
        const meal = primaryMeal;
        const now = new Date();
        const periodId =
          resolveVisiblePeriodId(now.getHours(), effectivePeriods) ||
          effectivePeriods?.[0]?.id ||
          periods?.[0]?.id ||
          'breakfast';

        try {
          await api.post('/nutrition', {
            meal_name: meal.meal_name,
            calories: meal.total_calories,
            protein: meal.total_protein || 0,
            carbs: meal.total_carbs || 0,
            fat: meal.total_fat || 0,
            date: now,
            foods: (meal.foods || []).map((food) => ({
              name: food.name,
              portion: food.portion || '',
              calories: food.calories,
            })),
          });
        } catch (saveErr) {
          console.error('Failed to save refreshed meal to DB:', saveErr);
        }

        setLoggedFoods((prev) => ({
          ...prev,
          [periodId]: [
            ...(prev[periodId] || []).filter((food) => !food._aiTime),
            {
              name: meal.meal_name,
              cals: meal.total_calories,
              protein: meal.total_protein || 0,
              carbs: meal.total_carbs || 0,
              fat: meal.total_fat || 0,
              _aiTime: now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }));
        setShowMealPlan(false);
        setCurrentMeal(null);
        setMealOptions([]);
        setSelectedMealOptionIndex(null);
        window.alert(
          usedFallbackGenerator
            ? t('nutrition.todaysLogUpdatedFallbackSuccess', "Today's Log was updated (fallback generator).")
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
    if (hour < 10) return 'Breakfast';
    if (hour < 13) return 'Lunch';
    if (hour < 16) return 'Afternoon Snack';
    if (hour < 20) return 'Dinner';
    return 'Evening Snack';
  };

  const handleLogMeal = async (meal) => {
    const now = new Date();
    const hour = now.getHours();
    const periodId = resolveVisiblePeriodId(hour, effectivePeriods);
    console.log(`[LogMeal] time=${now.toLocaleTimeString()} hour=${hour} → periodId=${periodId}`);

    // Save to DB
    try {
      await api.post('/nutrition', {
        meal_name: meal.meal_name,
        calories: meal.total_calories,
        protein: meal.total_protein,
        carbs: meal.total_carbs,
        fat: meal.total_fat,
        date: now,
        foods: (Array.isArray(meal.foods) ? meal.foods : []).map(f => ({ name: f.name, portion: f.portion, calories: f.calories })),
      });
    } catch (err) {
      console.error('Failed to save meal to DB:', err);
    }

    // Add to the correct period slot in the daily log
    setLoggedFoods(prev => ({
      ...prev,
      [periodId]: [...(prev[periodId] || []), {
        name: meal.meal_name,
        cals: meal.total_calories,
        protein: meal.total_protein,
        carbs: meal.total_carbs,
        fat: meal.total_fat,
        _aiTime: now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
      }]
    }));

    setShowMealPlan(false);
    setCurrentMeal(null);
    setMealOptions([]);
    setSelectedMealOptionIndex(null);
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
    setPendingNutritionPreferences(null);
    setPendingNutritionPreferencesNote('');
  };

  const handleMealPlanRefreshDecision = (shouldUpdate) => {
    const nextPreferences = pendingNutritionPreferences;
    const nextNote = pendingNutritionPreferencesNote;
    closeMealPlanRefreshPrompt();

    if (!shouldUpdate) return;

    requestMealPlan('', nextPreferences, nextNote, {
      autoLogToTodaysLog: true,
      openMealPlanCard: false,
    });
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
        const legacyRes = await aiApi.put('/users/nutrition-preferences/extract', {
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
      setPendingNutritionPreferences(validUpdatedPreferences);
      setPendingNutritionPreferencesNote(trimmed);
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
    requestMealPlan(requestText, null, '', { mealRequestPriority: 'normal', targetOptions: 2 });
  };

  const handleMealRecap = (meal) => {
    if (!meal) return;

    const foods = (Array.isArray(meal.foods) ? meal.foods : [])
      .map((food) => String(food?.name || '').trim())
      .filter(Boolean)
      .slice(0, 5);

    const recapLines = [
      `${t('nutrition.recapTitle', 'Meal recap')}: ${meal.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion')}`,
      `${t('common.calories', 'Calories')}: ${meal.total_calories || 0} | ${t('common.protein', 'Protein')}: ${meal.total_protein || 0}g | ${t('common.carbs', 'Carbs')}: ${meal.total_carbs || 0}g | ${t('common.fat', 'Fat')}: ${meal.total_fat || 0}g`,
      foods.length ? `${t('nutrition.foodsList', 'Foods')}: ${foods.join(', ')}` : '',
      lastMealRequestContext?.text
        ? `${t('nutrition.yourRequest', 'Your request')}: ${lastMealRequestContext.text}`
        : '',
      lastMealRequestContext?.priority === 'high'
        ? t('nutrition.highPriorityApplied', 'High-priority request was applied for this generation.')
        : '',
    ].filter(Boolean);

    window.alert(recapLines.join('\n'));
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
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
                          <span className="text-xs text-gray-500">{food.cals} {t('common.kcal', 'kcal')} • P:{food.protein} C:{food.carbs} F:{food.fat}</span>
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
        onPrefillConsumed={() => {}}
      />

      {/* Manual Food Entry Sheet */}
      <AnimatePresence>
        {activeSearchPeriod && (
          <ManualFoodEntry
            periodLabel={periods.find(p => p.id === activeSearchPeriod)?.label || ''}
            onAdd={handleAddFood}
            onAddMeal={handleAddMeal}
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
                className="flex-1 h-10 rounded-md gradient-cyan text-black font-semibold"
              >
                {t('nutrition.updateTodaysLog', "Yes, update Today's Log")}
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
