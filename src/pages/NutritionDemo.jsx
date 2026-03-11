import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Flame, Beef, Wheat, Droplet, Target, MessageCircle, ChevronRight, Plus, X, Heart, Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';
import FoodSwipeGame from '@/components/nutrition/FoodSwipeGame';
import MealPlanCard from '@/components/nutrition/MealPlanCard';
import ManualFoodEntry from '@/components/nutrition/ManualFoodEntry';
import { useAuth } from '@/lib/AuthContext';
import {
  getCanonicalMealPeriods,
  resolvePeriodFromValue,
  resolvePeriodIdForDate,
  resolvePeriodLabelForDate,
} from '@/lib/nutritionMealPeriods';
import api from '@/api/axios';
import aiApi from '@/api/aiAxios';

// --- Coach Logic: Dynamic Meal Periods ---
const generateCoachPeriods = (goal, dietType, mealFrequency, t = null) => {
  const explicitMealFrequency = Number.parseInt(mealFrequency, 10);
  let numMeals = Number.isFinite(explicitMealFrequency) ? explicitMealFrequency : 5;
  if (!Number.isFinite(explicitMealFrequency)) {
    if (goal === 'muscle_gain') numMeals = 6;
    if (goal === 'weight_loss') numMeals = 3;
    if (dietType === 'keto') numMeals = Math.max(2, numMeals - 1);
  }
  numMeals = Math.max(2, Math.min(6, numMeals));

  const translatePeriodLabel = (label) => {
    switch (label) {
      case 'First Meal':
        return t ? t('nutrition.meals.firstMeal', 'First Meal') : label;
      case 'Final Feast':
        return t ? t('nutrition.meals.finalFeast', 'Final Feast') : label;
      case 'Morning Fuel':
        return t ? t('nutrition.meals.morningFuel', 'Morning Fuel') : label;
      case 'Midday Recharger':
        return t ? t('nutrition.meals.middayRecharger', 'Midday Recharger') : label;
      case 'Evening Recovery':
        return t ? t('nutrition.meals.eveningRecovery', 'Evening Recovery') : label;
      case 'Breakfast':
        return t ? t('nutrition.breakfast', 'Breakfast') : label;
      case 'Lunch':
        return t ? t('nutrition.lunch', 'Lunch') : label;
      case 'Pre-Workout Snack':
        return t ? t('nutrition.meals.preWorkoutSnack', 'Pre-Workout Snack') : label;
      case 'Dinner':
        return t ? t('nutrition.dinner', 'Dinner') : label;
      case 'Early Kickoff':
        return t ? t('nutrition.meals.earlyKickoff', 'Early Kickoff') : label;
      case 'Mid-Morning Snack':
        return t ? t('nutrition.meals.midMorningSnack', 'Mid-Morning Snack') : label;
      case 'Afternoon Fuel':
        return t ? t('nutrition.meals.afternoonFuel', 'Afternoon Fuel') : label;
      case 'Evening Snack':
        return t ? t('nutrition.meals.eveningSnack', 'Evening Snack') : label;
      default:
        return label;
    }
  };

  return getCanonicalMealPeriods(numMeals).map((label, index) => ({
    id: `m${index + 1}`,
    label: translatePeriodLabel(label),
  }));
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

export default function NutritionDemo() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [chatOpen, setChatOpen] = useState(false);
  const [coachStyle] = useState('motivational');

  // Swipe game & meal planner state
  const [showSwipeGame, setShowSwipeGame] = useState(false);
  const [showMealPlan, setShowMealPlan] = useState(false);
  const [currentMeal, setCurrentMeal] = useState(null);
  const [isMealLoading, setIsMealLoading] = useState(false);
  const [likedFoods, setLikedFoods] = useState([]);
  const [dislikedFoods, setDislikedFoods] = useState([]);

  const profile = user?.profile || {};
  const dietType = profile.diet_type || 'everything';
  const goal = profile.goal || 'recomp';
  const mealFrequency = profile.meal_frequency;
  const nutritionPlanChoice = profile.nutrition_plan_choice;
  const isTrackingOnlyMode = nutritionPlanChoice === 'tracking_only';

  const [activeSearchPeriod, setActiveSearchPeriod] = useState(null);
  const [loggedFoods, setLoggedFoods] = useState({});
  const [savedMenuEntries, setSavedMenuEntries] = useState([]);
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    setPeriods(generateCoachPeriods(goal, dietType, mealFrequency, t));
  }, [goal, dietType, mealFrequency, t]);

  const resolvePeriodForLog = (log) => {
    const resolvedPeriod = resolvePeriodFromValue(log?.meal_period, periods);
    if (resolvedPeriod) {
      return resolvedPeriod.id;
    }

    if (String(log?.meal_period || '').trim()) {
      const byId = periods.find((p) => p.id === String(log.meal_period).trim());
      if (byId) return byId.id;
    }

    return resolvePeriodIdForDate(periods, log?.date || log?.createdAt || Date.now());
  };

  const resolvePeriodForMenuEntry = (entry) => {
    return resolvePeriodFromValue(entry?.meal_period, periods)?.id || null;
  };

  const loadTodaysLogs = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      const res = await api.get(`/nutrition/date/${todayStr}`);
      const logs = Array.isArray(res.data) ? res.data : [];
      const mapped = {};

      logs.forEach((log) => {
        const periodId = resolvePeriodForLog(log);
        if (!mapped[periodId]) mapped[periodId] = [];
        mapped[periodId].push({
          _logId: log._id,
          source: log.source || 'manual',
          name: log.meal_name,
          cals: log.calories || 0,
          protein: log.protein || 0,
          carbs: log.carbs || 0,
          fat: log.fat || 0,
          _aiTime: (log.source === 'ai')
            ? format(new Date(log.createdAt || log.date), 'HH:mm')
            : undefined,
        });
      });

      setLoggedFoods(mapped);
    } catch (error) {
      console.error('Failed to load nutrition logs:', error);
    }
  };

  const loadSavedMenu = async () => {
    try {
      const res = await api.get('/nutrition/menu');
      const entries = Array.isArray(res.data) ? res.data : [];
      setSavedMenuEntries(entries);
    } catch (error) {
      console.error('Failed to load saved menu:', error);
    }
  };

  const saveTrackingEntry = async ({
    mealName,
    mealPeriod,
    source = 'manual',
    calories,
    protein = 0,
    carbs = 0,
    fat = 0,
    foods = [],
  }) => {
    const payload = {
      meal_name: mealName,
      meal_period: mealPeriod,
      source,
      calories,
      protein,
      carbs,
      fat,
      date: new Date().toISOString(),
      foods,
    };
    const { data } = await api.post('/nutrition', payload);
    return data;
  };

  // Load food preferences and today's saved meals on mount/periods update
  useEffect(() => {
    loadFoodPreferences();
    loadSavedMenu();
  }, []);

  useEffect(() => {
    if (!periods.length) return;
    loadTodaysLogs();
  }, [periods]);

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
  const currentPeriodId = resolvePeriodIdForDate(periods, new Date());
  const currentPeriodHasAIMeal = (loggedFoods[currentPeriodId] || []).some((f) => f.source === 'ai');

  const macroCards = [
    { key: 'calories', label: t('common.calories', 'Calories'), icon: Flame, value: currentMacros.cals, target: tdee, color: '#00F2FF', unit: '' },
    { key: 'protein', label: t('common.protein', 'Protein'), icon: Beef, value: currentMacros.pro, target: p_goal, color: '#CCFF00', unit: 'g' },
    { key: 'carbs', label: t('common.carbs', 'Carbs'), icon: Wheat, value: currentMacros.carb, target: c_goal, color: '#FF6B6B', unit: 'g' },
    { key: 'fat', label: t('common.fat', 'Fat'), icon: Droplet, value: currentMacros.fat, target: f_goal, color: '#FFD93D', unit: 'g' }
  ];

  const handleAddFood = async (food) => {
    if (!activeSearchPeriod) return;
    let createdLog = null;
    try {
      createdLog = await saveTrackingEntry({
        mealName: food.name,
        mealPeriod: activeSearchPeriod,
        source: 'manual',
        calories: food.cals,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        foods: [{
          name: food.name,
          portion: food.portion || '',
          calories: food.cals,
          protein: food.protein || 0,
          carbs: food.carbs || 0,
          fat: food.fat || 0,
        }],
      });
    } catch (err) {
      console.error('Failed to save food to DB:', err);
      return;
    }
    setLoggedFoods(prev => ({
      ...prev,
      [activeSearchPeriod]: [...(prev[activeSearchPeriod] || []), {
        ...food,
        _logId: createdLog?._id,
        source: 'manual',
      }],
    }));
    setActiveSearchPeriod(null);
  };

  // Called from ManualFoodEntry "Describe" tab — saves full AI-parsed meal to tracking DB
  const handleAddMeal = async (meal) => {
    if (!activeSearchPeriod) return;
    let createdLog = null;
    try {
      createdLog = await saveTrackingEntry({
        mealName: meal.meal_name,
        mealPeriod: activeSearchPeriod,
        source: 'manual',
        calories: meal.total_calories,
        protein: meal.total_protein || 0,
        carbs: meal.total_carbs || 0,
        fat: meal.total_fat || 0,
        foods: (meal.foods || []).map((f) => ({
          name: f.name,
          portion: f.portion || '',
          calories: f.calories || 0,
          protein: f.protein || 0,
          carbs: f.carbs || 0,
          fat: f.fat || 0,
        })),
      });
    } catch (err) {
      console.error('Failed to save meal to DB:', err);
      return;
    }
    setLoggedFoods(prev => ({
      ...prev,
      [activeSearchPeriod]: [...(prev[activeSearchPeriod] || []), {
        _logId: createdLog?._id,
        source: 'manual',
        name: meal.meal_name,
        cals: meal.total_calories,
        protein: meal.total_protein || 0,
        carbs: meal.total_carbs || 0,
        fat: meal.total_fat || 0,
      }]
    }));
    setActiveSearchPeriod(null);
  };

  const removeFood = async (periodId, index) => {
    const target = loggedFoods[periodId]?.[index];
    if (target?._logId) {
      try {
        await api.delete(`/nutrition/entry/${target._logId}`);
      } catch (error) {
        console.error('Failed to remove meal log:', error);
        return;
      }
    }

    setLoggedFoods((prev) => {
      const updated = [...(prev[periodId] || [])];
      updated.splice(index, 1);
      return { ...prev, [periodId]: updated };
    });
  };

  // ─── Meal Planner ────────────────────────────────────────
  const requestMealPlan = async () => {
    setShowMealPlan(true);
    setIsMealLoading(true);
    setCurrentMeal(null);

    const now = new Date();
    const mealsEaten = Object.values(loggedFoods).filter(arr => arr.length > 0).length;

    try {
      const res = await aiApi.post('/meal/next', {
        current_calories_consumed: currentMacros.cals,
        protein_consumed: currentMacros.pro,
        carbs_consumed: currentMacros.carb,
        fat_consumed: currentMacros.fat,
        time_of_day: format(now, 'HH:mm'),
        meal_period: resolvePeriodLabelForDate(periods, now),
        meals_eaten_today: mealsEaten,
        total_meals_planned: periods.length,
      });
      setCurrentMeal(res.data);
    } catch (err) {
      console.error('Failed to generate meal plan:', err.response?.data || err.message);
      // Signal error state so MealPlanCard can show retry
      setCurrentMeal({ _error: true });
    } finally {
      setIsMealLoading(false);
    }
  };

  const handleLogMeal = async (meal) => {
    const now = new Date();
    const periodId = resolvePeriodIdForDate(periods, now);
    let createdLog = null;
    try {
      createdLog = await saveTrackingEntry({
        mealName: meal.meal_name,
        mealPeriod: periodId,
        source: 'ai',
        calories: meal.total_calories,
        protein: meal.total_protein || 0,
        carbs: meal.total_carbs || 0,
        fat: meal.total_fat || 0,
        foods: (meal.foods || []).map((f) => ({
          name: f.name,
          portion: f.portion || '',
          calories: f.calories || 0,
          protein: f.protein || 0,
          carbs: f.carbs || 0,
          fat: f.fat || 0,
        })),
      });
    } catch (err) {
      console.error('Failed to save meal to DB:', err);
      return;
    }

    // Add to the correct period slot in the daily log
    setLoggedFoods(prev => ({
      ...prev,
      [periodId]: [...(prev[periodId] || []), {
        _logId: createdLog?._id,
        source: 'ai',
        name: meal.meal_name,
        cals: meal.total_calories,
        protein: meal.total_protein,
        carbs: meal.total_carbs,
        fat: meal.total_fat,
        _aiTime: format(now, 'HH:mm'),
      }]
    }));

    setShowMealPlan(false);
    setCurrentMeal(null);
  };

  const handleSwipeGameClose = () => {
    setShowSwipeGame(false);
    // Reload preferences after swiping
    loadFoodPreferences();
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
      {savedMenuEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {t('nutrition.savedMenu', 'Saved Menu')}
            </h3>
            <span className="text-xs text-gray-500">
              {savedMenuEntries.length} {t('nutrition.mealsCount', 'meals')}
            </span>
          </div>

          <div className="space-y-2">
            {savedMenuEntries.slice(0, 6).map((entry) => (
              <div
                key={entry._id}
                className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-white">{entry.meal_name}</p>
                  <p className="text-xs text-gray-500">
                    {entry.meal_period || t('nutrition.unspecifiedPeriod', 'Unspecified period')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#00F2FF] font-semibold">{entry.total_calories || 0} {t('common.kcal', 'kcal')}</p>
                  <p className="text-xs text-gray-500 uppercase">{entry.source || 'manual'}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-3 mb-6"
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
          onClick={requestMealPlan}
          disabled={isTrackingOnlyMode || currentPeriodHasAIMeal}
          className={`relative overflow-hidden rounded-xl p-4 border border-[#2A2A2A] bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] transition-all group ${(isTrackingOnlyMode || currentPeriodHasAIMeal)
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-[#00F2FF]/30'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F2FF]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Utensils className="w-5 h-5 text-[#00F2FF]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{t('nutrition.planMeal', 'Plan Meal')}</p>
              <p className="text-xs text-gray-500">
                {isTrackingOnlyMode
                  ? t('nutrition.trackingOnlyModeTitle', 'Tracking-only mode is active')
                  : currentPeriodHasAIMeal
                    ? t('nutrition.aiMealAlreadySaved', 'AI meal already saved for this meal period')
                    : t('nutrition.aiPowered', 'AI Powered')}
              </p>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">🍽️</div>
        </button>
      </motion.div>

      {isTrackingOnlyMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-[#FF8A00]/30 bg-[#FF8A00]/5 px-4 py-3"
        >
          <p className="text-sm text-[#FFB55C] font-semibold">
            {t('nutrition.trackingOnlyModeTitle', 'Tracking-only mode is active')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t('nutrition.trackingOnlyModeDesc', 'AI meal planning is disabled for your account settings. You can still track all meals here.')}
          </p>
        </motion.div>
      )}

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
            const plannedMeals = savedMenuEntries.filter((entry) => resolvePeriodForMenuEntry(entry) === period.id);

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

                {/* Saved plan for this period */}
                {periodFoods.length === 0 && plannedMeals.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2">
                      {t('nutrition.savedPlanForPeriod', 'Saved plan for this meal period:')}
                    </p>
                    <div className="space-y-2">
                      {plannedMeals.map((meal) => (
                        <div
                          key={meal._id}
                          className="rounded-lg border border-[#2A2A2A] bg-[#111] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">{meal.meal_name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {meal.total_calories || 0} {t('common.kcal', 'kcal')} • P:{meal.total_protein || 0} C:{meal.total_carbs || 0} F:{meal.total_fat || 0}
                              </p>
                              {Array.isArray(meal.foods) && meal.foods.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {meal.foods.map((food, foodIndex) => (
                                    <p key={`${meal._id}-food-${foodIndex}`} className="text-xs text-gray-400">
                                      {food.name}
                                      {food.portion ? ` • ${food.portion}` : ''}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-gray-500">
                              {meal.source || 'manual'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {periodFoods.length === 0 && plannedMeals.length === 0 && (
                  <div className="mb-3 rounded-lg border border-dashed border-[#2A2A2A] bg-[#111]/60 px-3 py-3">
                    <p className="text-sm text-gray-400">
                      {t('nutrition.noMealLoggedForPeriod', 'No food logged for this meal period yet.')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {isTrackingOnlyMode
                        ? t('nutrition.addFoodToStartTracking', 'Add food manually to start tracking.')
                        : t('nutrition.useAiOrManualToStart', 'Use Plan Meal or Add Food to create this meal.')}
                    </p>
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
        📊 {t('nutrition.demoNotice', 'Meals and saved menus on this page are tied to your account data.')}
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
            isLoading={isMealLoading}
            onClose={() => { setShowMealPlan(false); setCurrentMeal(null); }}
            onRefresh={requestMealPlan}
            onLogMeal={handleLogMeal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
