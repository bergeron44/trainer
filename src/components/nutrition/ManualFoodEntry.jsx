import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Sparkles, Search, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import aiApi from '@/api/aiAxios';

// Quick-pick foods with known values
const QUICK_FOODS = [
    { name: 'Chicken Breast', portion: '150g', calories: 248, protein: 46, carbs: 0, fat: 5 },
    { name: 'Brown Rice', portion: '150g', calories: 185, protein: 4, carbs: 39, fat: 1.5 },
    { name: 'Eggs (2)', portion: '120g', calories: 156, protein: 12, carbs: 1, fat: 11 },
    { name: 'Greek Yogurt', portion: '200g', calories: 118, protein: 20, carbs: 8, fat: 1 },
    { name: 'Banana', portion: '1 medium', calories: 105, protein: 1, carbs: 27, fat: 0 },
    { name: 'Oatmeal', portion: '80g dry', calories: 300, protein: 10, carbs: 54, fat: 5 },
    { name: 'Salmon', portion: '150g', calories: 280, protein: 39, carbs: 0, fat: 13 },
    { name: 'Sweet Potato', portion: '200g', calories: 172, protein: 3, carbs: 40, fat: 0 },
    { name: 'Almonds', portion: '30g', calories: 174, protein: 6, carbs: 6, fat: 15 },
    { name: 'Cottage Cheese', portion: '200g', calories: 166, protein: 24, carbs: 6, fat: 4 },
    { name: 'Avocado', portion: '100g', calories: 160, protein: 2, carbs: 9, fat: 15 },
    { name: 'Tuna (canned)', portion: '120g', calories: 132, protein: 29, carbs: 0, fat: 1 },
];

const MacroPill = ({ label, value, color }) => (
    <div className="rounded-lg py-1.5 text-center" style={{ backgroundColor: `${color}10` }}>
        <p className="text-xs font-bold" style={{ color }}>{value}g</p>
        <p className="text-[10px] text-gray-600">{label}</p>
    </div>
);

export default function ManualFoodEntry({ periodLabel, onAdd, onAddMeal, onClose }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('list'); // 'list' | 'single' | 'describe'

    // Single food estimate state
    const [foodName, setFoodName] = useState('');
    const [portion, setPortion] = useState('');
    const [estimated, setEstimated] = useState(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimateError, setEstimateError] = useState(false);

    // Describe-meal state
    const [mealText, setMealText] = useState('');
    const [generatedMeal, setGeneratedMeal] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState(false);

    // --- Single food estimate ---
    const handleEstimate = async () => {
        if (!foodName.trim()) return;
        setIsEstimating(true);
        setEstimated(null);
        setEstimateError(false);
        try {
            const res = await aiApi.post('/food/lookup', {
                food_name: foodName.trim(),
                portion: portion.trim() || '100g',
            });
            setEstimated(res.data);
        } catch {
            setEstimateError(true);
        } finally {
            setIsEstimating(false);
        }
    };

    const handleAddEstimated = () => {
        if (!estimated) return;
        onAdd({
            name: estimated.name,
            portion: estimated.portion,
            cals: estimated.calories,
            protein: estimated.protein,
            carbs: estimated.carbs,
            fat: estimated.fat,
        });
    };

    // --- Quick pick ---
    const handleAddQuick = (food) => {
        onAdd({
            name: food.name,
            portion: food.portion,
            cals: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
        });
    };

    // --- Describe full meal ---
    const handleGenerateMeal = async () => {
        if (!mealText.trim()) return;
        setIsGenerating(true);
        setGeneratedMeal(null);
        setGenerateError(false);
        try {
            const res = await aiApi.post('/meal/from-text', {
                meal_description: mealText.trim(),
            });
            setGeneratedMeal(res.data);
        } catch {
            setGenerateError(true);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddGeneratedMeal = () => {
        if (!generatedMeal) return;
        if (onAddMeal) {
            onAddMeal(generatedMeal);
        } else {
            // Fallback: add as single combined entry
            onAdd({
                name: generatedMeal.meal_name,
                cals: generatedMeal.total_calories,
                protein: generatedMeal.total_protein,
                carbs: generatedMeal.total_carbs,
                fat: generatedMeal.total_fat,
                foods: generatedMeal.foods,
            });
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end pb-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-lg mx-auto bg-[#1A1A1A] rounded-t-2xl border-t border-x border-[#2A2A2A] flex flex-col max-h-[78vh]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                    <div>
                        <h3 className="font-bold text-white text-sm">{t('nutrition.addFood', 'Add Food')}</h3>
                        <p className="text-xs text-gray-500">{periodLabel}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex mx-4 mb-2 rounded-lg bg-[#111] p-0.5 shrink-0 gap-0.5">
                    <button
                        onClick={() => setTab('list')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === 'list' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                    >
                        {t('nutrition.quickPick', 'Quick Pick')}
                    </button>
                    <button
                        onClick={() => setTab('single')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${tab === 'single' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                    >
                        <Sparkles className="w-3 h-3" />
                        {t('nutrition.aiEstimate', 'AI')}
                    </button>
                    <button
                        onClick={() => setTab('describe')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${tab === 'describe' ? 'bg-[#CCFF00]/20 text-[#CCFF00]' : 'text-gray-500'}`}
                    >
                        <PenLine className="w-3 h-3" />
                        {t('nutrition.describeMeal', 'Describe')}
                    </button>
                </div>

                <div className="mx-4 h-px bg-[#2A2A2A] shrink-0" />

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3">

                    {/* ── Quick Pick ── */}
                    {tab === 'list' && (
                        <div className="space-y-1">
                            {QUICK_FOODS.map((food, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAddQuick(food)}
                                    className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[#2A2A2A] transition-colors group"
                                >
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-white">{food.name}</p>
                                        <p className="text-xs text-gray-500">{food.portion} · {food.calories} kcal</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs text-gray-600">P:{food.protein} C:{food.carbs} F:{food.fat}</p>
                                        <div className="w-6 h-6 rounded-full bg-[#00F2FF]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus className="w-3 h-3 text-[#00F2FF]" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Single Food AI Estimate ── */}
                    {tab === 'single' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{t('nutrition.foodName', 'Food name')}</label>
                                <input
                                    type="text"
                                    value={foodName}
                                    onChange={e => setFoodName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleEstimate()}
                                    placeholder={t('nutrition.foodNamePlaceholder', 'e.g. Schnitzel, Hummus, Quinoa')}
                                    className="w-full bg-[#111] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00F2FF]/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{t('nutrition.portion', 'Portion')} ({t('nutrition.optional', 'optional')})</label>
                                <input
                                    type="text"
                                    value={portion}
                                    onChange={e => setPortion(e.target.value)}
                                    placeholder="100g"
                                    className="w-full bg-[#111] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00F2FF]/50"
                                />
                            </div>
                            <button
                                onClick={handleEstimate}
                                disabled={!foodName.trim() || isEstimating}
                                className="w-full py-2.5 rounded-xl gradient-cyan text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isEstimating ? (
                                    <>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                                            <Sparkles className="w-4 h-4" />
                                        </motion.div>
                                        {t('nutrition.estimating', 'Estimating...')}
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-4 h-4" />
                                        {t('nutrition.estimateValues', 'Estimate Values')}
                                    </>
                                )}
                            </button>
                            {estimateError && (
                                <p className="text-xs text-red-400 text-center">{t('nutrition.estimateError', 'Could not reach AI. Try again.')}</p>
                            )}
                            {estimated && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#111] border border-[#00F2FF]/20 rounded-xl p-3 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{estimated.name}</p>
                                            <p className="text-xs text-gray-500">{estimated.portion}</p>
                                        </div>
                                        <p className="text-base font-bold text-[#00F2FF]">{estimated.calories} kcal</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <MacroPill label="Protein" value={estimated.protein} color="#CCFF00" />
                                        <MacroPill label="Carbs" value={estimated.carbs} color="#FF6B6B" />
                                        <MacroPill label="Fat" value={estimated.fat} color="#FFD93D" />
                                    </div>
                                    <button
                                        onClick={handleAddEstimated}
                                        className="w-full py-2 rounded-xl gradient-cyan text-black text-sm font-semibold flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('nutrition.addToMeal', 'Add to Meal')}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* ── Describe Full Meal ── */}
                    {tab === 'describe' && (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-500">
                                {t('nutrition.describeHint', 'Write your full meal — AI will calculate the macros and add it to this slot.')}
                            </p>
                            <textarea
                                value={mealText}
                                onChange={e => setMealText(e.target.value)}
                                placeholder={t('nutrition.describeplaceholder', 'e.g. 200g chicken breast with brown rice, salad with olive oil')}
                                rows={4}
                                className="w-full bg-[#111] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CCFF00]/50 resize-none"
                            />
                            <button
                                onClick={handleGenerateMeal}
                                disabled={!mealText.trim() || isGenerating}
                                className="w-full py-2.5 rounded-xl text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: !mealText.trim() || isGenerating ? '#333' : 'linear-gradient(135deg, #CCFF00, #99CC00)' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                                            <Sparkles className="w-4 h-4" />
                                        </motion.div>
                                        {t('nutrition.analyzing', 'Analyzing...')}
                                    </>
                                ) : (
                                    <>
                                        <PenLine className="w-4 h-4" />
                                        {t('nutrition.analyzeMeal', 'Analyze Meal')}
                                    </>
                                )}
                            </button>

                            {generateError && (
                                <p className="text-xs text-red-400 text-center">{t('nutrition.estimateError', 'Could not reach AI. Try again.')}</p>
                            )}

                            {generatedMeal && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#111] border border-[#CCFF00]/20 rounded-xl p-3 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-white">{generatedMeal.meal_name}</p>
                                        <p className="text-base font-bold text-[#CCFF00]">{generatedMeal.total_calories} kcal</p>
                                    </div>
                                    {/* Foods breakdown */}
                                    <div className="space-y-1">
                                        {(generatedMeal.foods || []).map((f, i) => (
                                            <div key={i} className="flex justify-between text-xs text-gray-400">
                                                <span>{f.name} <span className="text-gray-600">({f.portion})</span></span>
                                                <span>{f.calories} kcal</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <MacroPill label="Protein" value={generatedMeal.total_protein} color="#CCFF00" />
                                        <MacroPill label="Carbs" value={generatedMeal.total_carbs} color="#FF6B6B" />
                                        <MacroPill label="Fat" value={generatedMeal.total_fat} color="#FFD93D" />
                                    </div>
                                    {generatedMeal.coach_note && (
                                        <p className="text-xs text-gray-500 italic">{generatedMeal.coach_note}</p>
                                    )}
                                    <button
                                        onClick={handleAddGeneratedMeal}
                                        className="w-full py-2 rounded-xl text-black text-sm font-semibold flex items-center justify-center gap-2"
                                        style={{ background: 'linear-gradient(135deg, #CCFF00, #99CC00)' }}
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('nutrition.addMeal', 'Add Meal')}
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
