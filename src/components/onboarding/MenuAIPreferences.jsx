import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Wand2 } from 'lucide-react';

export default function MenuAIPreferences({ onComplete, onBack }) {
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');

  const canContinue = likes.trim().length > 0;

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
        className="max-w-lg mx-auto w-full"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 mb-6 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#00F2FF]/10 flex items-center justify-center flex-shrink-0">
            <Wand2 className="w-5 h-5 text-[#00F2FF]" />
          </div>
          <h2 className="text-2xl font-bold">Your food preferences</h2>
        </div>
        <p className="text-gray-500 mb-8">
          Tell us what you like and dislike so the AI can build a menu you'll actually enjoy
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Foods you love <span className="text-[#00F2FF]">*</span>
            </label>
            <textarea
              rows={4}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-white placeholder-gray-600 focus:border-[#00F2FF] outline-none resize-none transition-colors"
              placeholder="e.g., chicken breast, rice, broccoli, eggs, oats, greek yogurt, sweet potato..."
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Foods you dislike or avoid{' '}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={4}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-white placeholder-gray-600 focus:border-[#00F2FF] outline-none resize-none transition-colors"
              placeholder="e.g., fish, dairy, spicy food, mushrooms, shellfish..."
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
          </div>
        </div>

        <motion.button
          whileHover={canContinue ? { scale: 1.02 } : {}}
          whileTap={canContinue ? { scale: 0.98 } : {}}
          onClick={() => canContinue && onComplete({ likes: likes.trim(), dislikes: dislikes.trim() })}
          disabled={!canContinue}
          className={`w-full h-14 rounded-xl font-semibold mt-8 transition-all ${
            canContinue
              ? 'gradient-cyan text-black'
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>

        <p className="text-xs text-gray-600 text-center mt-4">
          The AI will use these preferences when generating your meal plan
        </p>
      </motion.div>
    </motion.div>
  );
}
