import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Flame, Beef, Wheat, Droplet, Target, MessageCircle, ChevronRight, Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';
import FoodSearch from '@/components/nutrition/FoodSearch';
import { useAuth } from '@/lib/AuthContext';

// --- Coach Logic: Dynamic Meal Periods ---
const generateCoachPeriods = (goal, dietType, t = null) => {
  // Determine number of meals (2 to 7) based on goal and diet
  let numMeals = 4; // default

  if (goal === 'muscle_gain') numMeals = 6; // Bulking needs more meals
  if (goal === 'weight_loss') numMeals = 3; // Cutting might mean fewer larger meals
  if (dietType === 'keto') numMeals = Math.max(2, numMeals - 1); // Keto users often eat less frequently

  // Ensure bounds
  numMeals = Math.max(2, Math.min(7, numMeals));

  // Generate labels based on count
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

export default function NutritionDemo() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [chatOpen, setChatOpen] = useState(false);
  const [coachStyle, setCoachStyle] = useState('motivational');

  const profile = user?.profile || {};
  const dietType = profile.diet_type || 'everything';
  const goal = profile.goal || 'recomp';

  const [activeSearchPeriod, setActiveSearchPeriod] = useState(null);
  const [loggedFoods, setLoggedFoods] = useState({});
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    setPeriods(generateCoachPeriods(goal, dietType, t));
  }, [goal, dietType, t]);

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

  const macroCards = [
    { key: 'calories', label: t('common.calories', 'Calories'), icon: Flame, value: currentMacros.cals, target: tdee, color: '#00F2FF', unit: '' },
    { key: 'protein', label: t('common.protein', 'Protein'), icon: Beef, value: currentMacros.pro, target: p_goal, color: '#CCFF00', unit: 'g' },
    { key: 'carbs', label: t('common.carbs', 'Carbs'), icon: Wheat, value: currentMacros.carb, target: c_goal, color: '#FF6B6B', unit: 'g' },
    { key: 'fat', label: t('common.fat', 'Fat'), icon: Droplet, value: currentMacros.fat, target: f_goal, color: '#FFD93D', unit: 'g' }
  ];

  const handleAddFood = (food) => {
    if (!activeSearchPeriod) return;
    setLoggedFoods(prev => ({
      ...prev,
      [activeSearchPeriod]: [...(prev[activeSearchPeriod] || []), food]
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
          <p className="text-[#00F2FF] font-semibold text-sm capitalize">{t(`nutrition.dietTypes.${dietType}`, `${dietType} Diet`)}</p>
          <p className="text-gray-400 text-xs">{t(`nutrition.goals.${goal}`, GOAL_LABELS[goal])}</p>
        </div>
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
          <span className="font-semibold text-white">{t('nutrition.coachTip', 'Coach tip:')} </span> {t(`nutrition.dietTips.${dietType}`, DIET_TIPS[dietType])}
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
            const inspirations = getInspirationsForPeriod(dietType);

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
                          <span className="text-white block truncate">{t(`nutrition.foods.${food.name}`, food.name)}</span>
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

                {/* Inspirations Carousel */}
                {periodFoods.length === 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-2">{t('nutrition.ideasToHitMacros', 'Ideas to hit your macros:')}</p>
                    <div className="flex overflow-x-auto snap-x gap-2 pb-2 scrollbar-none">
                      {inspirations.map((insp, i) => (
                        <div key={i} className="snap-start shrink-0 w-48 bg-[#2A2A2A] rounded-lg p-2 text-xs border border-transparent hover:border-[#00F2FF]/30 transition-all cursor-pointer">
                          <p className="text-gray-300 font-medium truncate">{t(`nutrition.inspirations.${insp.name}`, insp.name)}</p>
                          <p className="text-gray-500 mt-1">{insp.cals} {t('common.kcal', 'kcal')} • {insp.protein}g {t('common.protein', 'Protein')}</p>
                        </div>
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
      />

      {/* Food Search Modal / Drawer */}
      <Dialog.Root open={!!activeSearchPeriod} onOpenChange={(open) => !open && setActiveSearchPeriod(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm" />
          <Dialog.Content className="fixed bottom-0 left-0 right-0 top-16 sm:inset-x-4 sm:top-[10%] sm:bottom-[10%] max-w-2xl mx-auto z-50 focus:outline-none">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full w-full"
            >
              <FoodSearch
                onAddFood={handleAddFood}
                onClose={() => setActiveSearchPeriod(null)}
              />
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}