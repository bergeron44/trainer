import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Skull, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COACH_STYLES = [
  {
    id: 'motivational',
    name: 'Motivational',
    icon: Flame,
    color: '#CCFF00',
    description: 'Encouraging, positive reinforcement, celebrates wins',
    sample: '"You\'ve got this! Every rep counts. Let\'s crush today\'s workout together!"'
  },
  {
    id: 'spicy',
    name: 'Spicy',
    icon: Zap,
    color: '#00F2FF',
    description: 'Bold, direct, challenges you with tough love',
    sample: '"Nice try, but we both know you can do better. Time to step up!"'
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    icon: Skull,
    color: '#FF6B6B',
    description: 'No excuses, military-style, maximum intensity',
    sample: '"DROP THE EXCUSES! Pain is temporary. Weakness is a choice. MOVE!"'
  }
];

export default function CoachStyleSelector({ onSelect, initialStyle }) {
  const [selected, setSelected] = useState(initialStyle || null);

  const handleContinue = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col px-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-10"
      >
        <div className="w-20 h-20 rounded-full gradient-cyan flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🏋️</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Choose Your Coach</h1>
        <p className="text-gray-500">Pick the coaching style that motivates you most</p>
      </motion.div>

      {/* Coach Options */}
      <div className="flex-1 space-y-4">
        {COACH_STYLES.map((style, index) => {
          const Icon = style.icon;
          const isSelected = selected === style.id;
          
          return (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={() => setSelected(style.id)}
              className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                isSelected
                  ? 'border-[#00F2FF] bg-[#00F2FF]/10'
                  : 'border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]'
              }`}
            >
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${style.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg">{style.name}</h3>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-[#00F2FF] flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-black" />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{style.description}</p>
                  <p className="text-xs text-gray-500 italic">{style.sample}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Continue Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8"
      >
        <Button
          onClick={handleContinue}
          disabled={!selected}
          className={`w-full h-14 font-semibold text-lg transition-all duration-300 ${
            selected
              ? 'gradient-cyan text-black hover:opacity-90'
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}