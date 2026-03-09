import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/axios';
import aiApi from '@/api/aiAxios';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { X, Trophy, Clock, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CoachTicker from '@/components/session/CoachTicker';
import FeedbackButton from '@/components/session/FeedbackButton';
import BonusChallenge from '@/components/session/BonusChallenge';
import LiveExerciseCard from '@/components/session/LiveExerciseCard';

const COACH_MESSAGES = {
  start: [
    "Let's crush this workout! I'm here with you every rep. 💪",
    "Focus mode activated. Show me what you've got!",
    "Your session begins now. Let's make it count!"
  ],
  easy: [
    "Too easy? Let's turn up the heat! 🔥",
    "I see you! Ready for a challenge?",
    "Feeling strong today - let's push those limits!"
  ],
  hard: [
    "You've got this! Take a breath, reset, dominate.",
    "It's okay to struggle - that's where growth happens.",
    "Drop the weight if needed. Form over ego, always."
  ],
  heartrate: [
    "Heart rate's up - take 30 extra seconds rest.",
    "Slow your breathing. Box breaths: 4 in, 4 hold, 4 out.",
    "Recovery is part of the workout. Don't rush it."
  ],
  setComplete: [
    "Solid set! Keep that energy!",
    "Clean work! Next set when you're ready.",
    "That's how it's done! 🔥"
  ],
  bonus: [
    "Add 2 more reps this set!",
    "Try adding 2.5kg this set!",
    "Slow the eccentric - 3 seconds down!",
    "No rest between next 2 sets - superset time!"
  ]
};

const getRandomMessage = (category) => {
  const messages = COACH_MESSAGES[category] || COACH_MESSAGES.start;
  return messages[Math.floor(Math.random() * messages.length)];
};

export default function LiveSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState({});

  const getTranslatedMessage = useCallback((category) => {
    // Dynamic keys based on category
    const count = Object.keys(t(`coach.messages.${category}`, { returnObjects: true }) || {}).length;
    if (count > 0) {
      const index = Math.floor(Math.random() * count);
      return t(`coach.messages.${category}.${index}`, getRandomMessage(category));
    }
    return getRandomMessage(category);
  }, [t]);

  const [coachMessage, setCoachMessage] = useState('');
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [bonusChallenge, setBonusChallenge] = useState('');
  const [adjustments, setAdjustments] = useState({});
  const [sessionStats, setSessionStats] = useState({ duration: 0, volume: 0, setsCompleted: 0 });
  const [pulsePhase, setPulsePhase] = useState('idle');
  const [sessionStartTime] = useState(Date.now());
  const [sessionDbId, setSessionDbId] = useState(null);

  useEffect(() => {
    setCoachMessage(getTranslatedMessage('start'));
  }, [getTranslatedMessage]);

  // Load workout + start DB session
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const savedWorkouts = localStorage.getItem('nexus_live_workouts');
    let loadedWorkout = null;
    if (savedWorkouts) {
      const workouts = JSON.parse(savedWorkouts);
      loadedWorkout = workouts.find(w => format(new Date(w.date), 'yyyy-MM-dd') === today) || null;
      if (loadedWorkout) setWorkout(loadedWorkout);
    }

    // Load completed sets
    const savedSets = localStorage.getItem(`nexus_completed_sets_${today}`);
    if (savedSets) {
      setCompletedSets(JSON.parse(savedSets));
    }

    // Start or resume a DB session
    const initSession = async () => {
      try {
        // Check for existing active session first
        const activeRes = await api.get('/workouts/session/active');
        if (activeRes.data?._id) {
          setSessionDbId(activeRes.data._id);
          return;
        }
      } catch (_) { /* no active session */ }

      if (!loadedWorkout?._id) return;
      try {
        const res = await api.post('/workouts/session', { workout_id: loadedWorkout._id });
        if (res.data?._id) setSessionDbId(res.data._id);
      } catch (err) {
        console.error('Failed to start workout session:', err);
      }
    };

    initSession();
  }, []);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionStats(prev => ({
        ...prev,
        duration: Math.floor((Date.now() - sessionStartTime) / 1000)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const handleSetComplete = useCallback((exerciseId, setNumber) => {
    const newCompletedSets = { ...completedSets, [exerciseId]: setNumber };
    setCompletedSets(newCompletedSets);

    // Save to localStorage
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem(`nexus_completed_sets_${today}`, JSON.stringify(newCompletedSets));

    // Update stats
    const exercise = workout?.exercises.find(e => e.id === exerciseId);
    const addedVolume = exercise ? (exercise.weight || 0) * (parseInt(exercise.reps) || 0) : 0;
    if (exercise) {
      setSessionStats(prev => ({
        ...prev,
        volume: prev.volume + addedVolume,
        setsCompleted: prev.setsCompleted + 1
      }));
    }

    // Log set to DB (fire and forget)
    if (sessionDbId && exercise) {
      api.post(`/workouts/session/${sessionDbId}/log`, {
        exercise_name: exercise.name,
        set_number: setNumber,
        reps_completed: parseInt(exercise.reps) || 0,
        weight_used: exercise.weight || 0,
      }).catch(err => console.error('Failed to log set:', err));
    }

    // Coach feedback
    setIsCoachTyping(true);
    setTimeout(() => {
      setCoachMessage(getTranslatedMessage('setComplete'));
      setIsCoachTyping(false);
    }, 800);
  }, [completedSets, workout, sessionDbId, getTranslatedMessage]);

  const handleFeedback = useCallback(async (feedback) => {
    setIsCoachTyping(true);

    // Simulate AI processing
    setTimeout(async () => {
      if (feedback.energy === 'high') {
        // Trigger bonus challenge
        setBonusChallenge(getTranslatedMessage('bonus'));
        setShowBonus(true);
        setCoachMessage(getTranslatedMessage('easy'));
      } else if (feedback.energy === 'low') {
        setCoachMessage(getTranslatedMessage('hard'));
        // Suggest adjustment for next exercise
        const nextExercise = workout?.exercises[currentExerciseIndex];
        if (nextExercise) {
          setAdjustments(prev => ({
            ...prev,
            [nextExercise.id]: {
              weight: Math.max(0, (nextExercise.weight || 0) - 5),
              reason: t('session.reducedWeight', 'Reduced weight based on your feedback')
            }
          }));
        }
      } else if (feedback.energy === 'recovery') {
        setCoachMessage(getTranslatedMessage('heartrate'));

      } else if (feedback.energy === 'custom') {
        // Use custom backend API for mock LLM response
        try {
          const { data } = await aiApi.post('/chat/response', {
            prompt: `You are a fitness coach. The user just said: "${feedback.label}". Give a brief, encouraging response (1-2 sentences max). Be motivational but practical.`
          });
          setCoachMessage(data.response);
        } catch (err) {
          setCoachMessage(t('session.keepPushing', "Keep pushing! You're doing great!"));
        }
      }
      setIsCoachTyping(false);
    }, 1000);
  }, [workout, currentExerciseIndex, getTranslatedMessage, t]);

  const handleBonusAccept = () => {
    setShowBonus(false);
    const currentExercise = workout?.exercises[currentExerciseIndex];
    if (currentExercise) {
      setAdjustments(prev => ({
        ...prev,
        [currentExercise.id]: {
          reps: `${parseInt(currentExercise.reps) + 2}`,
          reason: t('session.bonusAccepted', 'Bonus challenge accepted! +2 reps')
        }
      }));
    }
    setCoachMessage(t('session.bonusAccMsg', "BONUS ACCEPTED! Let's see what you're made of! 💪"));
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishSession = useCallback(async () => {
    if (sessionDbId) {
      try {
        await api.put(`/workouts/session/${sessionDbId}/complete`, {
          completed_exercises: Object.keys(completedSets).map(exerciseId => ({
            exercise_id: exerciseId,
            sets_completed: completedSets[exerciseId] || 0,
          })),
          total_volume: sessionStats.volume,
        });
      } catch (err) {
        console.error('Failed to complete session:', err);
      }
    }
    navigate(createPageUrl('Dashboard'));
  }, [sessionDbId, completedSets, sessionStats.volume, navigate]);

  const currentExercise = workout?.exercises[currentExerciseIndex];
  const totalExercises = workout?.exercises?.length || 0;

  if (!workout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('session.loading', 'Loading session...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient pulse background */}
      <motion.div
        animate={{ opacity: [0.02, 0.08, 0.02] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-radial from-[#00F2FF]/10 via-transparent to-transparent"
      />

      {/* Header */}
      <div className="relative z-10 sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#2A2A2A]">
        {/* Coach Ticker */}
        <CoachTicker message={coachMessage} isTyping={isCoachTyping} />

        {/* Session stats bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleFinishSession}
            className="p-2 hover:bg-[#1A1A1A] rounded-full"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#00F2FF]" />
              <span className="font-mono font-bold">{formatDuration(sessionStats.duration)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-[#FF6B6B]" />
              <span className="font-bold">{sessionStats.setsCompleted} {t('common.sets', 'sets')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-[#CCFF00]" />
              <span className="font-bold">{sessionStats.volume} {t('common.kg')}</span>
            </div>
          </div>

          <div className="w-10" /> {/* Spacer for symmetry */}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 px-4 py-6 pb-32">
        {/* Exercise navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentExerciseIndex(prev => Math.max(0, prev - 1))}
            disabled={currentExerciseIndex === 0}
            className="p-3 rounded-full bg-[#1A1A1A] disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">{t('session.exercise', 'Exercise')}</p>
            <p className="text-lg font-bold">
              <span className="text-[#00F2FF]">{currentExerciseIndex + 1}</span>
              <span className="text-gray-500"> / {totalExercises}</span>
            </p>
          </div>

          <button
            onClick={() => setCurrentExerciseIndex(prev => Math.min(totalExercises - 1, prev + 1))}
            disabled={currentExerciseIndex === totalExercises - 1}
            className="p-3 rounded-full bg-[#1A1A1A] disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Current exercise card */}
        <AnimatePresence mode="wait">
          {currentExercise && (
            <motion.div
              key={currentExercise.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <LiveExerciseCard
                exercise={currentExercise}
                isActive={true}
                completedSets={completedSets[currentExercise.id] || 0}
                onSetComplete={handleSetComplete}
                adjustment={adjustments[currentExercise.id]}
                pulsePhase={pulsePhase}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exercise queue preview */}
        <div className="mt-6">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">{t('session.upNext', 'Up Next')}</p>
          <div className="space-y-2">
            {workout.exercises.slice(currentExerciseIndex + 1, currentExerciseIndex + 3).map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#1A1A1A]/50 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-sm font-bold text-gray-400">
                    {currentExerciseIndex + 2 + i}
                  </div>
                  <span className="text-gray-300">{ex.name}</span>
                </div>
                <span className="text-xs text-gray-500">{ex.sets}×{ex.reps}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback FAB */}
      <FeedbackButton onFeedback={handleFeedback} disabled={isCoachTyping} />

      {/* Bonus Challenge Popup */}
      <BonusChallenge
        isVisible={showBonus}
        challenge={bonusChallenge}
        onAccept={handleBonusAccept}
        onDismiss={() => setShowBonus(false)}
      />
    </div>
  );
}