import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, FileText, ChevronLeft } from 'lucide-react';

export default function PlanChoice({ onSelect, onBack }) {
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

        <h2 className="text-2xl font-bold mb-2">You're Experienced!</h2>
        <p className="text-gray-500 mb-8">
          Would you like to build a new plan or import your existing routine?
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
                <h3 className="font-semibold text-lg mb-1">Build New AI Plan</h3>
                <p className="text-sm text-gray-500">
                  Let Nexus AI create a personalized program based on your goals
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
                <h3 className="font-semibold text-lg mb-1">Use My Current Routine</h3>
                <p className="text-sm text-gray-500">
                  Continue with your existing workout routine (you can adjust later)
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        <p className="text-xs text-gray-600 text-center mt-8">
          💡 You can always change this later in settings
        </p>
      </motion.div>
    </motion.div>
  );
}