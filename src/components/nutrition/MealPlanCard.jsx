import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, Flame, Beef, Wheat, Droplet, Sparkles, MessageSquareMore, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MealPlanCard({
    meal,
    mealOptions = [],
    selectedOptionIndex = null,
    onSelectOption,
    onClose,
    onRefresh,
    onLogMeal,
    onRecap,
    onSomethingElse,
    isLoading,
}) {
    const { t } = useTranslation();

    const optionList = Array.isArray(mealOptions) && mealOptions.length
        ? mealOptions
        : (meal ? [meal] : []);
    const hasMultipleOptions = optionList.length > 1;
    const hasSelectedOption = Number.isInteger(selectedOptionIndex)
        && selectedOptionIndex >= 0
        && selectedOptionIndex < optionList.length;
    const activeMeal = hasMultipleOptions
        ? (hasSelectedOption ? optionList[selectedOptionIndex] : null)
        : (optionList[0] || null);
    const errorMeal = meal?._error ? meal : null;
    const requiresOptionSelection = hasMultipleOptions && !hasSelectedOption;
    const canAddAlternative = optionList.length < 3;
    const recapDisabled = !activeMeal;
    const saveDisabled = !activeMeal;
    const activeOptionNumber = hasMultipleOptions && hasSelectedOption ? selectedOptionIndex + 1 : 1;
    const buildMealDescription = (mealData) => {
        if (!mealData || typeof mealData !== 'object') return '';
        const explicit = String(mealData?.meal_description || '').trim();
        if (explicit) return explicit;

        const foods = (Array.isArray(mealData.foods) ? mealData.foods : [])
            .map((food) => {
                const name = String(food?.name || '').trim();
                if (!name) return '';
                const portion = String(food?.portion || '').trim();
                return portion ? `${portion} ${name}` : name;
            })
            .filter(Boolean)
            .slice(0, 4);

        if (!foods.length) return t('nutrition.mealDescriptionFallback', 'A complete meal tailored to your preferences and current macro targets.');
        return `${t('nutrition.mealDescriptionPrefix', 'Meal idea')}: ${foods.join(', ')}.`;
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
                className="w-full max-w-lg mx-auto bg-[#1A1A1A] rounded-t-2xl border-t border-x border-[#2A2A2A] flex flex-col max-h-[70vh]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
            >
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

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {!isLoading && !errorMeal && hasMultipleOptions && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-400">
                                {t('nutrition.chooseOptionFirst', 'Choose one option before recap/save.')}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {optionList.map((option, idx) => {
                                    const selected = hasSelectedOption && selectedOptionIndex === idx;
                                    return (
                                        <button
                                            key={`${option?.meal_name || 'meal'}-${idx}`}
                                            onClick={() => onSelectOption?.(idx)}
                                            className={`rounded-lg border px-2 py-2 text-left transition-colors ${selected ? 'border-[#00F2FF] bg-[#00F2FF]/10' : 'border-[#2A2A2A] hover:border-[#00F2FF]/40'}`}
                                        >
                                            <p className="text-xs text-white font-semibold truncate">{`Option ${idx + 1}`}</p>
                                            <p className="text-[11px] text-gray-400 truncate">{option?.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion')}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                                <Sparkles className="w-6 h-6 text-[#00F2FF]" />
                            </motion.div>
                            <p className="text-gray-400 text-sm">{t('nutrition.planningMeal', 'Planning your perfect meal...')}</p>
                            <p className="text-gray-600 text-xs text-center">{t('nutrition.wakeUp', 'First request may take ~30s while AI service wakes up')}</p>
                        </div>
                    ) : errorMeal ? (
                        <div className="text-center py-8 space-y-3">
                            <p className="text-gray-400 text-sm">
                                {errorMeal?.error_message || t('nutrition.noMealGenerated', 'Could not reach AI service. Try again!')}
                            </p>
                            <button
                                onClick={onRefresh}
                                className="px-5 py-1.5 rounded-xl border border-[#2A2A2A] text-gray-400 text-sm hover:text-white hover:border-[#00F2FF]/40 transition-colors"
                            >
                                {t('common.tryAgain', 'Try Again')}
                            </button>
                        </div>
                    ) : activeMeal ? (
                        <>
                            <div className="rounded-lg border border-[#2A2A2A] bg-[#121212] px-3 py-2">
                                <p className="text-xs text-gray-400">
                                    {hasMultipleOptions
                                        ? t('nutrition.optionSummary', `You are viewing meal option ${activeOptionNumber} of ${optionList.length}.`, { index: activeOptionNumber, total: optionList.length })
                                        : t('nutrition.singleOptionSummary', 'This is one full meal option.')}
                                </p>
                            </div>

                            <div>
                                <h2 className="text-base font-bold text-[#00F2FF]">{activeMeal.meal_name}</h2>
                                {activeMeal.coach_note && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{activeMeal.coach_note}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { icon: Flame, value: activeMeal.total_calories, color: '#00F2FF', unit: '' },
                                    { icon: Beef, value: activeMeal.total_protein, color: '#CCFF00', unit: 'g' },
                                    { icon: Wheat, value: activeMeal.total_carbs, color: '#FF6B6B', unit: 'g' },
                                    { icon: Droplet, value: activeMeal.total_fat, color: '#FFD93D', unit: 'g' },
                                ].map((m, i) => (
                                    <div key={i} className="rounded-lg p-2 text-center" style={{ backgroundColor: `${m.color}10` }}>
                                        <m.icon className="w-3 h-3 mx-auto mb-0.5" style={{ color: m.color }} />
                                        <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}{m.unit}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-lg border border-[#2A2A2A] bg-[#101010] px-3 py-3">
                                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t('nutrition.mealDescription', 'Meal description')}</p>
                                <p className="text-sm text-gray-200 leading-relaxed">{buildMealDescription(activeMeal)}</p>
                            </div>
                        </>
                    ) : requiresOptionSelection ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-gray-400">{t('nutrition.selectOptionToContinue', 'Select one of the options above to continue.')}</p>
                        </div>
                    ) : null}
                </div>

                {!isLoading && !errorMeal && optionList.length > 0 && (
                    <div className="px-4 py-3 border-t border-[#2A2A2A] space-y-2 shrink-0">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => onRecap?.(activeMeal)}
                                disabled={recapDisabled}
                                className={`py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${recapDisabled ? 'border-[#2A2A2A] text-gray-600 cursor-not-allowed' : 'border-[#3A3A3A] text-gray-300 hover:bg-[#2A2A2A]'}`}
                            >
                                <MessageSquareMore className="w-4 h-4" />
                                {t('nutrition.giveMeRecap', 'Give me recapy')}
                            </button>
                            <button
                                onClick={onSomethingElse}
                                disabled={!canAddAlternative}
                                className={`py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${!canAddAlternative ? 'border-[#2A2A2A] text-gray-600 cursor-not-allowed' : 'border-[#3A3A3A] text-gray-300 hover:bg-[#2A2A2A]'}`}
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('nutrition.somethingElse', 'Something else')}
                            </button>
                        </div>

                        {!canAddAlternative && (
                            <p className="text-[11px] text-gray-500 text-center">{t('nutrition.maxThreeOptions', 'You can compare up to 3 options. Select one and save.')}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-[#3A3A3A] text-gray-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
                            >
                                <X className="w-4 h-4" />
                                {t('common.no', 'No')}
                            </button>
                            <button
                                onClick={() => onLogMeal(activeMeal)}
                                disabled={saveDisabled}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${saveDisabled ? 'bg-[#2A2A2A] text-gray-500 cursor-not-allowed' : 'gradient-cyan text-black'}`}
                            >
                                <Check className="w-4 h-4" />
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
