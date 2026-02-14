import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target, Dumbbell, Utensils, Moon, Activity, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const getCoachMessage = (coachStyle, data) => {
  const goalText = {
    weight_loss: 'lose weight and get lean',
    muscle_gain: 'build muscle and get stronger',
    recomp: 'transform your body composition',
    athletic_performance: 'boost your athletic performance'
  }[data.goal] || 'reach your fitness goals';

  const messages = {
    motivational: `Amazing! 🌟 I'm SO excited to work with you! You want to ${goalText}, and I know you can absolutely do it! With ${data.workout_days_per_week} training days per week and your ${data.experience_level} experience, we're going to make incredible progress together!`,
    spicy: `Alright, let's get real. 💥 You want to ${goalText}? Good. With ${data.workout_days_per_week} days of training and your ${data.experience_level} background, I expect you to show up and DELIVER. No half-measures.`,
    hardcore: `LISTEN UP! 💀 You came here to ${goalText}. ${data.workout_days_per_week} days a week, ${data.experience_level} level - I don't care about excuses. You WILL put in the work or you WILL fail. Choose wisely!`
  };

  return messages[coachStyle] || messages.motivational;
};

export default function CoachSummary({ data, coachStyle, onComplete }) {
  const goalLabels = {
    weight_loss: 'Weight Loss',
    muscle_gain: 'Muscle Gain',
    recomp: 'Body Recomposition',
    athletic_performance: 'Athletic Performance'
  };

  const nutritionLabels = {
    structured: 'Well structured',
    somewhat: 'Somewhat structured',
    not_structured: 'Not structured',
    not_sure: 'Not sure'
  };

  const summaryItems = [
    { icon: Target, label: 'Goal', value: goalLabels[data.goal] || data.goal, color: '#00F2FF' },
    { icon: Dumbbell, label: 'Training', value: `${data.workout_days_per_week} days/week`, color: '#CCFF00' },
    { icon: Moon, label: 'Sleep', value: `${data.sleep_per_night || data.sleep_hours} hours/night`, color: '#9B59B6' },
    { icon: Activity, label: 'Current Training', value: `${data.current_training_frequency} times/week`, color: '#FF6B6B' },
    { icon: Utensils, label: 'Nutrition', value: nutritionLabels[data.nutrition_status] || 'Not specified', color: '#FFD93D' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col px-6 py-8"
    >
      {/* Coach Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-6"
      >
        <div className="w-20 h-20 rounded-full gradient-cyan flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-10 h-10 text-black" />
        </div>
        <h2 className="text-xl font-bold text-[#00F2FF]">Your Coach Says...</h2>
      </motion.div>

      {/* Coach Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] mb-6"
      >
        <p className="text-lg leading-relaxed">{getCoachMessage(coachStyle, data)}</p>
      </motion.div>

      {/* Summary Title */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4"
      >
        Here's what I understood about you:
      </motion.h3>

      {/* Summary Cards */}
      <div className="flex-1 space-y-3">
        {summaryItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] flex items-center gap-4"
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-semibold">{item.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Continue Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="mt-8"
      >
        <Button
          onClick={onComplete}
          className="w-full h-14 gradient-cyan text-black font-semibold text-lg"
        >
          Let's Build My Plan
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>
    </motion.div>
  );
}