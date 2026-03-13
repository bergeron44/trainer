import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, UtensilsCrossed, BarChart2, ChevronLeft } from 'lucide-react';

export default function MenuChoice({ onSelect, onBack }) {
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
          Back
        </button>

        <h2 className="text-2xl font-bold mb-2">What about nutrition?</h2>
        <p className="text-gray-500 mb-8">
          Choose how you want to handle your meal planning
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
                <h3 className="font-semibold text-lg mb-1">AI Generate My Menu</h3>
                <p className="text-sm text-gray-500">
                  Let Nexus AI build a personalized meal plan based on your goals and food preferences
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('manual')}
            className="w-full p-6 rounded-2xl border-2 border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#CCFF00] transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-6 h-6 text-[#CCFF00]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Insert My Menu</h3>
                <p className="text-sm text-gray-500">
                  Manually enter your own meals and foods (no AI generation)
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('tracking_only')}
            className="w-full p-6 rounded-2xl border-2 border-[#2A2A2A] bg-[#1A1A1A] hover:border-gray-500 transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Track Only</h3>
                <p className="text-sm text-gray-500">
                  Skip menu planning — use the app for workout and nutrition logging only
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        <p className="text-xs text-gray-600 text-center mt-8">
          💡 You can always set up or change your menu later in settings
        </p>
      </motion.div>
    </motion.div>
  );
}
