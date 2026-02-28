import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import CoachStyleSelector from '@/components/coach/CoachStyleSelector';
import CoachSummary from '@/components/onboarding/CoachSummary';
import BodyFatSelector from '@/components/onboarding/BodyFatSelector';
import PlanChoice from '@/components/onboarding/PlanChoice.jsx';
import { Loader2 } from 'lucide-react';

const QUESTIONS = [
  {
    key: 'age',
    question: "How old are you?",
    type: 'number',
    unit: 'years',
    placeholder: '25'
  },
  {
    key: 'gender',
    question: "What's your gender?",
    type: 'select',
    options: [
      { value: 'male', label: 'Male', icon: '👨' },
      { value: 'female', label: 'Female', icon: '👩' },
      { value: 'other', label: 'Prefer not to say', icon: '🙂' }
    ]
  },
  {
    key: 'height',
    question: "What's your height?",
    type: 'number',
    unit: 'cm',
    placeholder: '175'
  },
  {
    key: 'weight',
    question: "What's your current weight?",
    type: 'number',
    unit: 'kg',
    placeholder: '70'
  },
  {
    key: 'goal',
    question: "What's your primary fitness goal?",
    type: 'select',
    options: [
      { value: 'weight_loss', label: 'Weight Loss', description: 'Burn fat and get lean', icon: '🔥' },
      { value: 'muscle_gain', label: 'Muscle Gain', description: 'Build size and strength', icon: '💪' },
      { value: 'recomp', label: 'Body Recomposition', description: 'Lose fat, gain muscle', icon: '⚡' },
      { value: 'athletic_performance', label: 'Athletic Performance', description: 'Improve speed, power, endurance', icon: '🏃' }
    ]
  },
  {
    key: 'body_fat_percentage',
    question: "Estimate your body fat percentage",
    type: 'body_fat',
    options: { min: 8, max: 35, step: 1 },
    unit: '%'
  },
  {
    key: 'sleep_per_night',
    question: "How many hours do you sleep on average?",
    type: 'select',
    options: [
      { value: 'less_than_6', label: 'Less than 6 hours', description: 'Sleep deprived', icon: '😴' },
      { value: '6_to_7', label: '6-7 hours', description: 'Below optimal', icon: '🌙' },
      { value: '7_to_8', label: '7-8 hours', description: 'Optimal range', icon: '✨' },
      { value: 'more_than_8', label: '8+ hours', description: 'Well rested', icon: '💪' }
    ]
  },
  {
    key: 'current_training_frequency',
    question: "How many times per week do you currently train?",
    type: 'slider',
    options: { min: 0, max: 7, step: 1 },
    unit: 'times/week'
  },
  {
    key: 'nutrition_status',
    question: "How is your nutrition right now?",
    type: 'select',
    options: [
      { value: 'structured', label: 'Well structured', description: 'I track macros and meal prep', icon: '🎯' },
      { value: 'somewhat', label: 'Somewhat structured', description: 'I try to eat healthy most days', icon: '👍' },
      { value: 'not_structured', label: 'Not structured', description: 'I eat whatever is convenient', icon: '🍕' },
      { value: 'not_sure', label: 'Not sure', description: "I don't really pay attention", icon: '🤷' }
    ]
  },
  {
    key: 'injuries',
    question: "Any injuries or limitations we should know about?",
    type: 'textarea',
    placeholder: 'E.g., bad knee, shoulder issues, lower back pain... (or type "none")'
  },
  {
    key: 'experience_level',
    question: "What's your training experience?",
    type: 'select',
    options: [
      { value: 'beginner', label: 'Beginner', description: '0-1 year of training', icon: '🌱' },
      { value: 'intermediate', label: 'Intermediate', description: '1-3 years of training', icon: '🌿' },
      { value: 'advanced', label: 'Advanced', description: '3+ years of training', icon: '🌳' }
    ]
  },
  {
    key: 'workout_days_per_week',
    question: "How many days per week can you train?",
    type: 'slider',
    options: { min: 1, max: 7, step: 1 },
    unit: 'days'
  },
  {
    key: 'session_duration',
    question: "How long are your workout sessions?",
    type: 'select',
    options: [
      { value: 30, label: '30 minutes', description: 'Quick & efficient', icon: '⚡' },
      { value: 60, label: '60 minutes', description: 'Standard session', icon: '⏱️' },
      { value: 90, label: '90 minutes', description: 'Extended training', icon: '🏋️' }
    ]
  },
  {
    key: 'environment',
    question: "Where do you usually train?",
    type: 'select',
    options: [
      { value: 'commercial_gym', label: 'Commercial Gym', description: 'Full equipment access', icon: '🏢' },
      { value: 'home_gym', label: 'Home Gym', description: 'Limited equipment', icon: '🏠' },
      { value: 'bodyweight_park', label: 'Bodyweight/Park', description: 'Minimal equipment', icon: '🌳' }
    ]
  },
  {
    key: 'activity_level',
    question: "How active is your daily life outside workouts?",
    type: 'select',
    options: [
      { value: 'sedentary', label: 'Sedentary', description: 'Desk job, minimal movement', icon: '💺' },
      { value: 'lightly_active', label: 'Lightly Active', description: 'Some walking, light activity', icon: '🚶' },
      { value: 'moderately_active', label: 'Moderately Active', description: 'Active job, regular movement', icon: '🏃' },
      { value: 'very_active', label: 'Very Active', description: 'Physical job, always moving', icon: '🔥' }
    ]
  },
  {
    key: 'motivation_source',
    question: "What motivates you most to train?",
    type: 'textarea',
    placeholder: 'E.g., health, appearance, energy, confidence, strength...'
  }
];

import { useTranslation } from 'react-i18next';

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, user, updateProfile } = useAuth();
  const [phase, setPhase] = useState('welcome'); // welcome, questions, plan_choice, plan_import, coach_selection, summary, account_setup
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [coachStyle, setCoachStyle] = useState(null);
  const [planChoice, setPlanChoice] = useState(null); // 'ai' or 'existing'
  const [customPlan, setCustomPlan] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved progress
  useEffect(() => {
    const savedAnswers = localStorage.getItem('nexus_onboarding_answers');
    const savedStep = localStorage.getItem('nexus_onboarding_step');

    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
      if (savedStep) setCurrentStep(parseInt(savedStep));
    }
  }, []);

  // Save progress
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem('nexus_onboarding_answers', JSON.stringify(answers));
      localStorage.setItem('nexus_onboarding_step', currentStep.toString());
    }
  }, [answers, currentStep]);

  const calculateTDEE = (data) => {
    const { weight, height, age, gender, activity_level } = data;

    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725
    };

    const tdee = bmr * (activityMultipliers[activity_level] || 1.375);
    return Math.round(tdee);
  };

  const calculateMacros = (tdee, goal, weight) => {
    let targetCalories = tdee;

    switch (goal) {
      case 'weight_loss':
        targetCalories = tdee - 500;
        break;
      case 'muscle_gain':
        targetCalories = tdee + 300;
        break;
      case 'recomp':
        targetCalories = tdee;
        break;
      case 'athletic_performance':
        targetCalories = tdee + 200;
        break;
    }

    const protein = Math.round(weight * 2);
    const fat = Math.round((targetCalories * 0.25) / 9);
    const carbs = Math.round((targetCalories - (protein * 4) - (fat * 9)) / 4);

    return {
      target_calories: targetCalories,
      protein_goal: protein,
      fat_goal: fat,
      carbs_goal: carbs
    };
  };

  const handleCoachSelect = (style) => {
    setCoachStyle(style);
    localStorage.setItem('nexus_coach_style', style);
    setPhase('summary');
  };

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Show plan choice for intermediate/advanced users
      if (answers.experience_level === 'intermediate' || answers.experience_level === 'advanced') {
        setPhase('plan_choice');
      } else {
        setPhase('coach_selection');
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleChange = (value) => {
    setAnswers(prev => ({
      ...prev,
      [QUESTIONS[currentStep].key]: value
    }));
  };

  const handleComplete = () => {
    if (user) {
      handleFinalSubmit();
    } else {
      setPhase('account_setup');
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);

    const tdee = calculateTDEE(answers);
    const macros = calculateMacros(tdee, answers.goal, answers.weight);

    // Convert sleep option to hours
    const sleepHoursMap = {
      'less_than_6': 5,
      '6_to_7': 6.5,
      '7_to_8': 7.5,
      'more_than_8': 8.5
    };

    const profileData = {
      ...answers,
      sleep_hours: sleepHoursMap[answers.sleep_per_night] || 7,
      tdee,
      ...macros,
      coach_style: coachStyle,
      plan_choice: planChoice || 'ai',
      custom_plan: customPlan,
      onboarding_completed: true,
      onboarding_date: new Date().toISOString()
    };

    try {
      if (user) {
        await updateProfile(profileData);
      } else if (answers.name && answers.email && answers.password) {
        await register({
          name: answers.name,
          email: answers.email,
          password: answers.password,
          profile: profileData
        });
      }
    } catch (error) {
      console.error('Failed to save profile', error);
      setIsSubmitting(false);
      return;
    }

    // Save to localStorage
    localStorage.setItem('nexus_user_profile', JSON.stringify(profileData));
    localStorage.removeItem('nexus_onboarding_answers');
    localStorage.removeItem('nexus_onboarding_step');

    setTimeout(() => {
      navigate(createPageUrl('Dashboard'));
    }, 1000);
  };

  // Welcome Phase
  if (phase === 'welcome') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-24 h-24 rounded-full gradient-cyan flex items-center justify-center mb-8"
        >
          <span className="text-5xl">💪</span>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold mb-3"
        >
          {t('onboarding.letsBuilt')}<br />{t('onboarding.perfectWorkout')}
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 mb-8 max-w-xs"
        >
          {t('onboarding.answerQuestions')}
        </motion.p>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setPhase('questions')}
          className="w-full max-w-xs h-14 gradient-cyan text-black font-semibold rounded-xl"
        >
          {t('onboarding.getStarted')}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-gray-600 mt-6 mb-4"
        >
          {t('onboarding.takesAbout')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 text-sm text-gray-400"
        >
          {t('onboarding.alreadyAccount')}{' '}
          <button
            onClick={() => navigate(createPageUrl('Login'))}
            className="text-[#00F2FF] hover:underline font-medium"
          >
            {t('login.logIn')}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // Plan Choice Phase (for experienced users)
  if (phase === 'plan_choice') {
    return (
      <PlanChoice
        onSelect={(choice) => {
          setPlanChoice(choice);
          if (choice === 'existing') {
            setPhase('plan_import');
          } else {
            setPhase('coach_selection');
          }
        }}
        onBack={() => setPhase('questions')}
      />
    );
  }

  // Plan Import Phase
  if (phase === 'plan_import') {
    const PlanImportComponent = React.lazy(() => import('@/components/onboarding/PlanImport.jsx'));
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00F2FF]" /></div>}>
        <PlanImportComponent
          onComplete={(plan) => {
            setCustomPlan(plan);
            setPhase('coach_selection');
          }}
          onBack={() => setPhase('plan_choice')}
        />
      </React.Suspense>
    );
  }

  // Coach Selection Phase (now after questions)
  if (phase === 'coach_selection') {
    return (
      <CoachStyleSelector
        onSelect={handleCoachSelect}
        initialStyle={coachStyle}
      />
    );
  }

  // Summary Phase
  if (phase === 'summary') {
    return (
      <CoachSummary
        data={answers}
        coachStyle={coachStyle}
        onComplete={handleComplete}
      />
    );
  }

  // Account Setup Phase
  if (phase === 'account_setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto bg-[#1A1A1A] p-8 rounded-2xl border border-[#2A2A2A]"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">{t('onboarding.createYourAccount')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('onboarding.name')}</label>
              <input
                type="text"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-white focus:border-[#00F2FF] outline-none"
                placeholder={t('onboarding.yourName')}
                value={answers.name || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('onboarding.email')}</label>
              <input
                type="email"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-white focus:border-[#00F2FF] outline-none"
                placeholder="you@example.com"
                value={answers.email || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('login.password')}</label>
              <input
                type="password"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-white focus:border-[#00F2FF] outline-none"
                placeholder="••••••••"
                value={answers.password || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <div className="pt-4">
              <button
                onClick={handleFinalSubmit}
                disabled={!answers.name || !answers.email || !answers.password}
                className={`w-full h-12 rounded-xl font-semibold transition-all ${answers.name && answers.email && answers.password
                  ? 'gradient-cyan text-black'
                  : 'bg-[#2A2A2A] text-gray-500 cursor-not-allowed'
                  }`}
              >
                {t('register.createAccount')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Submitting Phase
  if (isSubmitting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full gradient-cyan flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-black animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('onboarding.creatingPlan')}</h2>
          <p className="text-gray-500">{t('onboarding.analyzingData')}</p>
        </motion.div>
      </div>
    );
  }

  // Questions Phase
  const currentQuestion = QUESTIONS[currentStep];

  // Special rendering for body fat selector
  if (currentQuestion.type === 'body_fat') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="min-h-screen flex flex-col px-6 py-8"
      >
        {/* Progress bar */}
        <div className="mb-8 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">{t('onboarding.step')} {currentStep + 1} {t('onboarding.of')} {QUESTIONS.length}</span>
            <span className="text-xs text-[#00F2FF]">{Math.round(((currentStep + 1) / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
              className="h-full bg-gradient-to-r from-[#00F2FF] to-[#CCFF00] rounded-full"
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 max-w-lg mx-auto w-full">{t(`onboarding.questions.${currentQuestion.key}`, currentQuestion.question)}</h2>

        <div className="flex-1 max-w-lg mx-auto w-full">
          <BodyFatSelector
            value={answers.body_fat_percentage}
            onChange={(val) => setAnswers(prev => ({ ...prev, body_fat_percentage: val }))}
            gender={answers.gender}
          />
        </div>

        <div className="flex gap-3 mt-8 max-w-lg mx-auto w-full">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 h-14 bg-transparent border border-[#2A2A2A] rounded-xl text-white font-semibold hover:bg-[#1A1A1A] transition-colors"
            >
              {t('common.back')}
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!answers.body_fat_percentage}
            className={`flex-1 h-14 rounded-xl font-semibold transition-all ${answers.body_fat_percentage
              ? 'gradient-cyan text-black'
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
              }`}
          >
            {t('common.continue')}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <OnboardingStep
        key={currentStep}
        question={t(`onboarding.questions.${currentQuestion.key}`, currentQuestion.question)}
        type={currentQuestion.type}
        options={Array.isArray(currentQuestion.options) ? currentQuestion.options.map(opt => {
          const camelKey = opt.value.toString().replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^\d+/, '');
          return {
            ...opt,
            label: t(`onboarding.options.${camelKey}`, opt.label),
            ...(opt.description && { description: t(`onboarding.options.${camelKey}Desc`, opt.description) }),
          };
        }) : currentQuestion.options}
        value={answers[currentQuestion.key]}
        onChange={handleChange}
        onNext={handleNext}
        onBack={handleBack}
        stepNumber={currentStep + 1}
        totalSteps={QUESTIONS.length}
        unit={t(`common.${currentQuestion.unit}`) || currentQuestion.unit}
        placeholder={t(`onboarding.options.${currentQuestion.key}Placeholder`)}
      />
    </AnimatePresence>
  );
}