import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getImportMealPeriodOptions } from '@/lib/nutritionMealPeriods';

const PERIODS = getImportMealPeriodOptions();

function createEmptyEntry(defaultPeriod = 'Breakfast') {
  return {
    meal_period: defaultPeriod,
    meal_name: '',
    total_calories: '',
    total_protein: '',
    total_carbs: '',
    total_fat: '',
    note: '',
  };
}

export default function NutritionMenuImport({ onComplete, onBack }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([createEmptyEntry()]);

  const updateEntry = (index, field, value) => {
    setEntries((prev) => prev.map((entry, i) => (
      i === index ? { ...entry, [field]: value } : entry
    )));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry()]);
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const cleanedEntries = entries
    .map((entry) => ({
      ...entry,
      meal_name: entry.meal_name.trim(),
      total_calories: Number(entry.total_calories || 0),
      total_protein: Number(entry.total_protein || 0),
      total_carbs: Number(entry.total_carbs || 0),
      total_fat: Number(entry.total_fat || 0),
      note: entry.note.trim(),
    }))
    .filter((entry) => entry.meal_name && entry.total_calories > 0);

  const hasValidMenu = cleanedEntries.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col px-4 py-6"
    >
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 mb-4 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common.back', 'Back')}
        </button>
        <h1 className="text-2xl font-bold mb-1">
          {t('onboarding.nutritionMenuImport.title', 'Add Your Menu')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('onboarding.nutritionMenuImport.subtitle', 'Add meals you already use so we can save them to your account')}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <AnimatePresence>
          {entries.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] space-y-3"
            >
              <div className="flex items-center gap-2">
                <select
                  value={entry.meal_period}
                  onChange={(e) => updateEntry(index, 'meal_period', e.target.value)}
                  className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm"
                >
                  {PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
                <Input
                  value={entry.meal_name}
                  onChange={(e) => updateEntry(index, 'meal_name', e.target.value)}
                  placeholder={t('onboarding.nutritionMenuImport.mealName', 'Meal name')}
                  className="flex-1 bg-[#0A0A0A] border-[#2A2A2A]"
                />
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(index)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  value={entry.total_calories}
                  onChange={(e) => updateEntry(index, 'total_calories', e.target.value)}
                  placeholder={t('onboarding.nutritionMenuImport.calories', 'Calories')}
                  className="bg-[#0A0A0A] border-[#2A2A2A]"
                />
                <Input
                  type="number"
                  min="0"
                  value={entry.total_protein}
                  onChange={(e) => updateEntry(index, 'total_protein', e.target.value)}
                  placeholder={t('common.protein', 'Protein')}
                  className="bg-[#0A0A0A] border-[#2A2A2A]"
                />
                <Input
                  type="number"
                  min="0"
                  value={entry.total_carbs}
                  onChange={(e) => updateEntry(index, 'total_carbs', e.target.value)}
                  placeholder={t('common.carbs', 'Carbs')}
                  className="bg-[#0A0A0A] border-[#2A2A2A]"
                />
                <Input
                  type="number"
                  min="0"
                  value={entry.total_fat}
                  onChange={(e) => updateEntry(index, 'total_fat', e.target.value)}
                  placeholder={t('common.fat', 'Fat')}
                  className="bg-[#0A0A0A] border-[#2A2A2A]"
                />
              </div>

              <Input
                value={entry.note}
                onChange={(e) => updateEntry(index, 'note', e.target.value)}
                placeholder={t('onboarding.nutritionMenuImport.note', 'Optional note')}
                className="bg-[#0A0A0A] border-[#2A2A2A]"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={addEntry}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('onboarding.nutritionMenuImport.addMeal', 'Add Meal')}
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
        <Button
          onClick={() => onComplete(cleanedEntries)}
          disabled={!hasValidMenu}
          className={`w-full h-12 font-semibold ${hasValidMenu
            ? 'gradient-cyan text-black'
            : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
            }`}
        >
          <Check className="w-4 h-4 mr-2" />
          {t('onboarding.nutritionMenuImport.saveMenu', 'Save My Menu')}
        </Button>
      </div>
    </motion.div>
  );
}
