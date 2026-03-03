import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Plus, Flame, Beef, Wheat, Droplet, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MealPlanCard({ meal, onClose, onRefresh, onLogMeal, isLoading }) {
    const { t } = useTranslation();

    return (
        <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-lg mx-auto bg-[#1A1A1A] rounded-t-2xl border-t border-x border-[#2A2A2A] flex flex-col max-h-[70vh]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header — sticky */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00F2FF]" />
                        <h3 className="font-bold text-white text-sm">{t('nutrition.mealSuggestion', 'Meal Suggestion')}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="mx-4 h-px bg-[#2A2A2A] shrink-0" />

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                                <Sparkles className="w-6 h-6 text-[#00F2FF]" />
                            </motion.div>
                            <p className="text-gray-400 text-sm">{t('nutrition.planningMeal', 'Planning your perfect meal...')}</p>
                            <p className="text-gray-600 text-xs text-center">{t('nutrition.wakeUp', 'First request may take ~30s while AI service wakes up')}</p>
                        </div>
                    ) : meal?._error ? (
                        <div className="text-center py-8 space-y-3">
                            <p className="text-gray-400 text-sm">{t('nutrition.noMealGenerated', 'Could not reach AI service. Try again!')}</p>
                            <button
                                onClick={onRefresh}
                                className="px-5 py-1.5 rounded-xl border border-[#2A2A2A] text-gray-400 text-sm hover:text-white hover:border-[#00F2FF]/40 transition-colors inline-flex items-center gap-2"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                {t('common.tryAgain', 'Try Again')}
                            </button>
                        </div>
                    ) : meal ? (
                        <>
                            {/* Meal name + note */}
                            <div>
                                <h2 className="text-base font-bold text-[#00F2FF]">{meal.meal_name}</h2>
                                {meal.coach_note && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{meal.coach_note}</p>
                                )}
                            </div>

                            {/* Macro Summary */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { icon: Flame, value: meal.total_calories, color: '#00F2FF', unit: '' },
                                    { icon: Beef, value: meal.total_protein, color: '#CCFF00', unit: 'g' },
                                    { icon: Wheat, value: meal.total_carbs, color: '#FF6B6B', unit: 'g' },
                                    { icon: Droplet, value: meal.total_fat, color: '#FFD93D', unit: 'g' },
                                ].map((m, i) => (
                                    <div key={i} className="rounded-lg p-2 text-center" style={{ backgroundColor: `${m.color}10` }}>
                                        <m.icon className="w-3 h-3 mx-auto mb-0.5" style={{ color: m.color }} />
                                        <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}{m.unit}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Food List — compact rows */}
                            <div className="divide-y divide-[#2A2A2A]">
                                {meal.foods.map((food, i) => (
                                    <div key={i} className="flex items-center justify-between py-2">
                                        <div>
                                            <p className="text-sm font-medium text-white">{food.name}</p>
                                            <p className="text-xs text-gray-500">{food.portion}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-[#00F2FF]">{food.calories} kcal</p>
                                            <p className="text-xs text-gray-500">P:{food.protein} C:{food.carbs} F:{food.fat}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Action Buttons — sticky at bottom, only when meal loaded */}
                {!isLoading && meal && !meal._error && (
                    <div className="px-4 py-3 border-t border-[#2A2A2A] flex gap-3 shrink-0">
                        <button
                            onClick={onRefresh}
                            className="flex-1 py-2.5 rounded-xl border border-[#3A3A3A] text-gray-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t('nutrition.anotherOne', 'Another One')}
                        </button>
                        <button
                            onClick={() => onLogMeal(meal)}
                            className="flex-1 py-2.5 rounded-xl gradient-cyan text-black text-sm font-semibold flex items-center justify-center gap-2"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('nutrition.logThis', 'Log This!')}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
