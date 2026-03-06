import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, FileText, LineChart, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NutritionPlanChoice({ onSelect, onBack }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex flex-col justify-center px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 mb-6 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common.back', 'Back')}
        </button>

        <h2 className="text-2xl font-bold mb-2">
          {t('onboarding.nutritionPlanChoice.title', 'How do you want to handle nutrition?')}
        </h2>
        <p className="text-gray-500 mb-8">
          {t('onboarding.nutritionPlanChoice.subtitle', 'Pick how you want to set up your menu in the app')}
        </p>

        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('ai')}
            className="w-full p-6 rounded-2xl border-2 border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#00F2FF] transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00F2FF]/10 flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-6 h-6 text-[#00F2FF]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  {t('onboarding.nutritionPlanChoice.aiMenu', 'Generate AI Menu')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('onboarding.nutritionPlanChoice.aiMenuDesc', 'Let Nexus AI suggest meals based on your goals and macros')}
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('existing')}
            className="w-full p-6 rounded-2xl border-2 border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#CCFF00] transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-[#CCFF00]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  {t('onboarding.nutritionPlanChoice.existingMenu', 'Use My Existing Menu')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('onboarding.nutritionPlanChoice.existingMenuDesc', 'I already have a menu and only want to track it')}
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('tracking_only')}
            className="w-full p-6 rounded-2xl border-2 border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#FF8A00] transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FF8A00]/10 flex items-center justify-center flex-shrink-0">
                <LineChart className="w-6 h-6 text-[#FF8A00]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  {t('onboarding.nutritionPlanChoice.trackingOnly', 'Tracking Only')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('onboarding.nutritionPlanChoice.trackingOnlyDesc', 'Skip meal planning and just use nutrition tracking tools')}
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        <p className="text-xs text-gray-600 text-center mt-8">
          {t('onboarding.nutritionPlanChoice.changeLater', 'You can always change this later in settings')}
        </p>
      </motion.div>
    </motion.div>
  );
}
