import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Sparkles, Search } from 'lucide-react';
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

export default function ManualFoodEntry({ periodLabel, onAdd, onClose }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('list'); // 'list' | 'manual'
    const [foodName, setFoodName] = useState('');
    const [portion, setPortion] = useState('');
    const [estimated, setEstimated] = useState(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimateError, setEstimateError] = useState(false);

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

    return (
        <motion.div
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end pb-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-lg mx-auto bg-[#1A1A1A] rounded-t-2xl border-t border-x border-[#2A2A2A] flex flex-col max-h-[75vh]"
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
                <div className="flex mx-4 mb-2 rounded-lg bg-[#111] p-0.5 shrink-0">
                    <button
                        onClick={() => setTab('list')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === 'list' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                    >
                        {t('nutrition.quickPick', 'Quick Pick')}
                    </button>
                    <button
                        onClick={() => setTab('manual')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${tab === 'manual' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                    >
                        <Sparkles className="w-3 h-3" />
                        {t('nutrition.aiEstimate', 'AI Estimate')}
                    </button>
                </div>

                <div className="mx-4 h-px bg-[#2A2A2A] shrink-0" />

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {tab === 'list' ? (
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
                    ) : (
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
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        {[
                                            { label: 'Protein', value: estimated.protein, color: '#CCFF00' },
                                            { label: 'Carbs', value: estimated.carbs, color: '#FF6B6B' },
                                            { label: 'Fat', value: estimated.fat, color: '#FFD93D' },
                                        ].map(m => (
                                            <div key={m.label} className="rounded-lg py-1.5" style={{ backgroundColor: `${m.color}10` }}>
                                                <p className="text-xs font-bold" style={{ color: m.color }}>{m.value}g</p>
                                                <p className="text-[10px] text-gray-600">{m.label}</p>
                                            </div>
                                        ))}
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
                </div>
            </motion.div>
        </motion.div>
    );
}
