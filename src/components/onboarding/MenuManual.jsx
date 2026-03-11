import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Minus, X, UtensilsCrossed } from 'lucide-react';

const DEFAULT_MEAL_NAMES = [
  'Breakfast',
  'Morning Snack',
  'Lunch',
  'Afternoon Snack',
  'Dinner',
  'Evening Snack',
  'Post-Workout',
];

function buildDefaultMeals(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: DEFAULT_MEAL_NAMES[i] ?? `Meal ${i + 1}`,
    foods: '',
  }));
}

export default function MenuManual({ onComplete, onBack }) {
  const [meals, setMeals] = useState(buildDefaultMeals(3));

  const mealCount = meals.length;

  const setCount = (next) => {
    const clamped = Math.max(1, Math.min(7, next));
    if (clamped === mealCount) return;

    if (clamped > mealCount) {
      const added = Array.from({ length: clamped - mealCount }, (_, i) => ({
        id: Date.now() + i,
        name: DEFAULT_MEAL_NAMES[mealCount + i] ?? `Meal ${mealCount + i + 1}`,
        foods: '',
      }));
      setMeals((prev) => [...prev, ...added]);
    } else {
      setMeals((prev) => prev.slice(0, clamped));
    }
  };

  const updateMeal = (id, field, value) => {
    setMeals((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMeal = (id) => {
    if (meals.length <= 1) return;
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const canContinue = meals.some((m) => m.foods.trim().length > 0);

  const handleComplete = () => {
    if (!canContinue) return;
    onComplete(
      meals.map((m) => ({
        name: m.name.trim() || `Meal`,
        foods: m.foods.trim(),
      }))
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex flex-col px-6 py-8"
    >
      <div className="max-w-lg mx-auto w-full flex flex-col flex-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 mb-6 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-[#CCFF00]" />
          </div>
          <h2 className="text-2xl font-bold">Build your menu</h2>
        </div>
        <p className="text-gray-500 mb-6">
          Set how many meals you eat per day and fill in the foods for each
        </p>

        {/* Meal count control */}
        <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 mb-6">
          <span className="font-medium">Meals per day</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCount(mealCount - 1)}
              disabled={mealCount <= 1}
              className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center disabled:opacity-30 hover:bg-[#3A3A3A] transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xl font-bold w-4 text-center">{mealCount}</span>
            <button
              onClick={() => setCount(mealCount + 1)}
              disabled={mealCount >= 7}
              className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center disabled:opacity-30 hover:bg-[#3A3A3A] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meal cards */}
        <div className="space-y-4 flex-1">
          <AnimatePresence initial={false}>
            {meals.map((meal, index) => (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 overflow-hidden"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#CCFF00]/20 text-[#CCFF00] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <input
                    className="flex-1 bg-transparent text-white font-medium placeholder-gray-600 outline-none border-b border-transparent focus:border-[#2A2A2A] transition-colors pb-0.5"
                    placeholder="Meal name"
                    value={meal.name}
                    onChange={(e) => updateMeal(meal.id, 'name', e.target.value)}
                  />
                  {meals.length > 1 && (
                    <button
                      onClick={() => removeMeal(meal.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:border-[#CCFF00] outline-none resize-none transition-colors"
                  placeholder="e.g., oatmeal, banana, black coffee..."
                  value={meal.foods}
                  onChange={(e) => updateMeal(meal.id, 'foods', e.target.value)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.button
          whileHover={canContinue ? { scale: 1.02 } : {}}
          whileTap={canContinue ? { scale: 0.98 } : {}}
          onClick={handleComplete}
          disabled={!canContinue}
          className={`w-full h-14 rounded-xl font-semibold mt-6 transition-all ${
            canContinue
              ? 'gradient-cyan text-black'
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>
      </div>
    </motion.div>
  );
}
