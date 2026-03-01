import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Plus, Flame, Beef, Wheat, Droplet, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MealPlanCard({ meal, onClose, onRefresh, onLogMeal, isLoading }) {
    const { t } = useTranslation();

    return (
        <motion.div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="w-full max-w-md bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] overflow-hidden shadow-2xl"
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
                {/* Header */}
                <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg gradient-cyan flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-black" />
                        </div>
                        <h3 className="font-bold text-white">{t('nutrition.mealSuggestion', 'Meal Suggestion')}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[#2A2A2A] text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-3">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        >
                            <Sparkles className="w-8 h-8 text-[#00F2FF]" />
                        </motion.div>
                        <p className="text-gray-400 text-sm">{t('nutrition.planningMeal', 'Planning your perfect meal...')}</p>
                    </div>
                ) : meal ? (
                    <>
                        {/* Meal Name */}
                        <div className="px-4 pt-4 pb-2">
                            <h2 className="text-xl font-bold text-[#00F2FF]">{meal.meal_name}</h2>
                            {meal.coach_note && (
                                <p className="text-sm text-gray-400 mt-1">{meal.coach_note}</p>
                            )}
                        </div>

                        {/* Macro Summary */}
                        <div className="px-4 pb-3">
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { icon: Flame, label: 'Cal', value: meal.total_calories, color: '#00F2FF', unit: '' },
                                    { icon: Beef, label: 'Pro', value: meal.total_protein, color: '#CCFF00', unit: 'g' },
                                    { icon: Wheat, label: 'Carb', value: meal.total_carbs, color: '#FF6B6B', unit: 'g' },
                                    { icon: Droplet, label: 'Fat', value: meal.total_fat, color: '#FFD93D', unit: 'g' },
                                ].map((m, i) => (
                                    <div key={i} className="rounded-lg p-2 text-center" style={{ backgroundColor: `${m.color}10` }}>
                                        <m.icon className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color: m.color }} />
                                        <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}{m.unit}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Food List */}
                        <div className="px-4 pb-4 space-y-2">
                            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                                {t('nutrition.foods', 'Foods')}
                            </p>
                            {meal.foods.map((food, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center justify-between bg-[#2A2A2A] rounded-lg p-3"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-white">{food.name}</p>
                                        <p className="text-xs text-gray-500">{food.portion}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-[#00F2FF]">{food.calories} kcal</p>
                                        <p className="text-xs text-gray-500">
                                            P:{food.protein} C:{food.carbs} F:{food.fat}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t border-[#2A2A2A] flex gap-3">
                            <button
                                onClick={onRefresh}
                                className="flex-1 py-3 rounded-xl border border-[#3A3A3A] text-gray-300 font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('nutrition.anotherOne', 'Another One')}
                            </button>
                            <button
                                onClick={() => onLogMeal(meal)}
                                className="flex-1 py-3 rounded-xl gradient-cyan text-black font-semibold flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {t('nutrition.logThis', 'Log This!')}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-gray-400">{t('nutrition.noMealGenerated', 'Could not generate a meal plan. Try again!')}</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
