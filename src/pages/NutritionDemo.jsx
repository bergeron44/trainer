import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Utensils, Flame, Beef, Wheat, Droplet, Target,
  Check, MessageCircle, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlobalCoachFAB from '@/components/coach/GlobalCoachFAB';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';
import { useAuth } from '@/lib/AuthContext';


const NUTRITION_GOALS = [
  {
    id: 'cut',
    label: 'Cut / Fat Loss',
    description: 'Calorie deficit for losing body fat',
    color: '#FF6B6B',
    icon: '🔥'
  },
  {
    id: 'maintain',
    label: 'Maintenance',
    description: 'Maintain current weight and body composition',
    color: '#00F2FF',
    icon: '⚖️'
  },
  {
    id: 'bulk',
    label: 'Bulk / Muscle Gain',
    description: 'Calorie surplus for building muscle',
    color: '#CCFF00',
    icon: '💪'
  }
];

const RECOMMENDATIONS = {
  cut: [
    {
      title: 'Prioritize Protein',
      description: 'Aim for 2g per kg bodyweight to preserve muscle mass while cutting.',
      tips: ['Lean meats', 'Greek yogurt', 'Egg whites', 'Protein shakes']
    },
    {
      title: 'High Volume, Low Calorie Foods',
      description: 'Fill up on vegetables and lean proteins to stay satiated.',
      tips: ['Leafy greens', 'Cucumber', 'Zucchini', 'Watermelon']
    },
    {
      title: 'Timing Your Carbs',
      description: 'Focus carbs around your workouts for energy and recovery.',
      tips: ['Pre-workout: 1-2 hours before', 'Post-workout: Within 2 hours']
    }
  ],
  maintain: [
    {
      title: 'Balanced Macros',
      description: 'Keep a balanced ratio of protein, carbs, and fats.',
      tips: ['40% carbs', '30% protein', '30% fats']
    },
    {
      title: 'Consistent Meal Timing',
      description: 'Eat at regular intervals to maintain energy levels.',
      tips: ['3 main meals', '2 snacks', 'Dont skip breakfast']
    },
    {
      title: 'Hydration',
      description: 'Drink plenty of water throughout the day.',
      tips: ['2-3 liters daily', 'More during workouts', 'Limit sugary drinks']
    }
  ],
  bulk: [
    {
      title: 'Caloric Surplus',
      description: 'Eat 200-500 calories above maintenance for lean gains.',
      tips: ['Track your intake', 'Weigh weekly', 'Adjust as needed']
    },
    {
      title: 'Quality Carbs for Energy',
      description: 'Fuel your workouts with complex carbohydrates.',
      tips: ['Oats', 'Rice', 'Sweet potatoes', 'Whole grain bread']
    },
    {
      title: 'Frequent Meals',
      description: 'Eat 5-6 smaller meals to hit your calorie goals.',
      tips: ['Meal prep helps', 'Keep snacks handy', 'Shakes for extra calories']
    }
  ]
};
export default function NutritionDemo() {
  const { user, updateProfile } = useAuth();
  const [nutritionGoal, setNutritionGoal] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [coachStyle, setCoachStyle] = useState('motivational');

  // Map profile goal to nutrition goal
  useEffect(() => {
    if (user?.profile?.goal) {
      const goalMap = {
        'weight_loss': 'cut',
        'muscle_gain': 'bulk',
        'recomp': 'maintain',
        'athletic_performance': 'maintain' // fallback
      };
      setNutritionGoal(goalMap[user.profile.goal] || 'maintain');
    }
  }, [user]);

  const handleGoalChange = async (newGoalId) => {
    setNutritionGoal(newGoalId);
    // Map back to profile goal
    const profileGoalMap = {
      'cut': 'weight_loss',
      'bulk': 'muscle_gain',
      'maintain': 'recomp'
    };

    try {
      await updateProfile({ goal: profileGoalMap[newGoalId] });
    } catch (error) {
      console.error('Failed to update nutrition goal:', error);
    }
  };

  const recommendations = RECOMMENDATIONS[nutritionGoal] || [];

  const macroCards = [
    { key: 'calories', label: 'Calories', icon: Flame, value: 2200, target: 2500, color: '#00F2FF', unit: '' },
    { key: 'protein', label: 'Protein', icon: Beef, value: 120, target: 150, color: '#CCFF00', unit: 'g' },
    { key: 'carbs', label: 'Carbs', icon: Wheat, value: 180, target: 250, color: '#FF6B6B', unit: 'g' },
    { key: 'fat', label: 'Fat', icon: Droplet, value: 55, target: 70, color: '#FFD93D', unit: 'g' }
  ];

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
      </motion.div>

      {/* Goal Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Your Goal
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {NUTRITION_GOALS.map((goal) => (
            <motion.button
              key={goal.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNutritionGoal(goal.id)}
              className={`p-4 rounded-xl border-2 transition-all ${nutritionGoal === goal.id
                ? 'border-[#00F2FF] bg-[#00F2FF]/10'
                : 'border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]'
                }`}
            >
              <div className="text-2xl mb-2">{goal.icon}</div>
              <p className="font-semibold text-sm">{goal.label.split(' / ')[0]}</p>
              {nutritionGoal === goal.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-[#00F2FF] flex items-center justify-center mx-auto mt-2"
                >
                  <Check className="w-3 h-3 text-black" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Macro Overview - Demo Data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        {macroCards.map((macro, index) => {
          const percentage = Math.min(Math.round((macro.value / macro.target) * 100), 100);
          const Icon = macro.icon;

          return (
            <motion.div
              key={macro.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${macro.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: macro.color }} />
                </div>
                <span className="text-sm text-gray-400">{macro.label}</span>
              </div>

              <div className="mb-2">
                <span className="text-2xl font-bold" style={{ color: macro.color }}>
                  {macro.value}
                </span>
                <span className="text-sm text-gray-500"> / {macro.target}{macro.unit}</span>
              </div>

              <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: macro.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Recommendations */}
      <AnimatePresence mode="wait">
        {nutritionGoal && (
          <motion.div
            key={nutritionGoal}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Recommendations for {NUTRITION_GOALS.find(g => g.id === nutritionGoal)?.label}
            </h2>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <motion.div
                  key={rec.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-cyan flex items-center justify-center shrink-0">
                      <Target className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{rec.title}</h3>
                      <p className="text-sm text-gray-400 mb-3">{rec.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {rec.tips.map((tip, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-[#2A2A2A] rounded-full text-gray-300"
                          >
                            {tip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ask Coach Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-2xl p-5 border border-[#2A2A2A]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full gradient-cyan flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-semibold">Ask Your Coach</h3>
            <p className="text-xs text-gray-500">Get personalized nutrition advice</p>
          </div>
        </div>
        <Button
          onClick={() => setChatOpen(true)}
          className="w-full gradient-cyan text-black font-semibold"
        >
          Chat with Coach
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>

      {/* Demo Notice */}
      <p className="text-xs text-gray-600 text-center mt-6">
        📊 Demo data shown. In the full version, this syncs with your actual intake.
      </p>

      {/* Global Coach Chat */}
      <GlobalCoachChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context="Nutrition"
        coachStyle={coachStyle}
      />
    </div>
  );
}