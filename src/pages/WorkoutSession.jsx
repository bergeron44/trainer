import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Check, X, ChevronDown, Sparkles, Timer, Dumbbell, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import AICoachChat from '@/components/dashboard/AICoachChat';
import Confetti from 'react-confetti';
import { getExerciseVideoUrl } from '@/data/exerciseVideos';

// ──────────────────────────────────────────────
//  Single Exercise "Reel" Slide
// ──────────────────────────────────────────────
function ExerciseReelSlide({
  exercise,
  index,
  totalExercises,
  slideRef,
  videoRef,
  exerciseData,
  completedSets,
  onCompleteSet,
  isVisible,
  isLast,
  onFinishWorkout,
}) {
  const { t } = useTranslation();
  const [restMode, setRestMode] = useState(false);
  const [restTime, setRestTime] = useState(0);

  const setsCompleted = completedSets || 0;
  const allDone = setsCompleted >= exercise.sets;

  // Rest timer
  useEffect(() => {
    if (!restMode || restTime <= 0) return;
    const interval = setInterval(() => {
      setRestTime(prev => {
        if (prev <= 1) {
          setRestMode(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restMode, restTime]);

  const handleCompleteSet = () => {
    onCompleteSet(exercise.id);
    const nextCompleted = setsCompleted + 1;
    if (nextCompleted < exercise.sets) {
      setRestMode(true);
      setRestTime(exercise.rest_seconds || 60);
    }
  };

  const skipRest = () => {
    setRestMode(false);
    setRestTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLoading = exerciseData === 'loading';
  const videoUrl = exerciseData?.video_url ?? null;
  const gifUrl = exerciseData?.gif_url ?? null;
  const instructions = exerciseData?.instructions ?? [];
  const difficulty = exerciseData?.difficulty ?? '';

  const DIFFICULTY_COLOR = {
    beginner: '#22c55e',
    intermediate: '#f59e0b',
    advanced: '#ef4444',
  };

  return (
    <div
      ref={slideRef}
      className="relative w-full flex-shrink-0"
      style={{ height: '100dvh', scrollSnapAlign: 'start' }}
    >
      {/* ── Background Media ── */}
      {isLoading ? (
        <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-[#00F2FF]/30 border-t-[#00F2FF] rounded-full animate-spin" />
        </div>
      ) : videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          loop
          playsInline
          preload={isVisible ? 'auto' : 'none'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : gifUrl ? (
        <img
          src={gifUrl}
          alt={exercise.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[#0d0d0d] flex flex-col items-center justify-center px-6">
          <Dumbbell className="w-20 h-20 text-[#00F2FF]/15 mb-4" />
          {instructions.length > 0 && (
            <div className="space-y-3 overflow-y-auto max-h-[30vh]">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00F2FF]/15 border border-[#00F2FF]/30 flex items-center justify-center text-[#00F2FF] text-xs font-bold">
                    {i + 1}
                  </span>
                  <p className="text-white/60 text-sm leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 pointer-events-none" />

      {/* ── Top bar: exercise counter ── */}
      <div
        className="absolute left-0 right-0 z-20 px-5 flex items-center justify-between"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
      >
        <p className="text-white/50 text-xs uppercase tracking-widest">
          {t('session.exercise', 'Exercise')} {index + 1} / {totalExercises}
        </p>
        {difficulty && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full border"
            style={{
              color: DIFFICULTY_COLOR[difficulty] ?? '#fff',
              borderColor: DIFFICULTY_COLOR[difficulty] ?? '#fff',
              backgroundColor: (DIFFICULTY_COLOR[difficulty] ?? '#fff') + '22',
            }}
          >
            {difficulty}
          </span>
        )}
      </div>

      {/* ── Bottom content ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
      >
        {/* Exercise name */}
        <h2 className="text-white text-3xl font-bold leading-tight mb-1">
          {exercise.name}
        </h2>

        {/* Sets & reps info */}
        <p className="text-[#00F2FF] text-lg font-semibold mb-4">
          {exercise.sets} {t('common.sets', 'sets')} × {exercise.reps} {t('session.reps', 'reps')}
          {exercise.weight > 0 ? ` · ${exercise.weight} ${t('common.kg', 'kg')}` : ''}
        </p>

        {/* ── Set progress dots ── */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: exercise.sets }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i === setsCompleted && !allDone ? [1, 1.3, 1] : 1,
                backgroundColor:
                  i < setsCompleted
                    ? '#CCFF00'
                    : i === setsCompleted && !allDone
                      ? '#00F2FF'
                      : '#333333',
              }}
              transition={{
                scale: { duration: 1, repeat: i === setsCompleted && !allDone ? Infinity : 0 },
                backgroundColor: { duration: 0.3 },
              }}
              className="w-4 h-4 rounded-full"
            />
          ))}
          <span className="text-white/40 text-sm ml-2">
            {setsCompleted}/{exercise.sets}
          </span>
        </div>

        {/* ── Action Area ── */}
        {allDone ? (
          // All sets completed for this exercise
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Check className="w-6 h-6 text-[#CCFF00]" />
              <span className="text-[#CCFF00] text-xl font-bold">
                {t('session.exerciseDone', 'Exercise Complete!')}
              </span>
            </div>

            {isLast ? (
              <Button
                onClick={onFinishWorkout}
                className="w-full h-14 rounded-2xl gradient-green text-black font-bold text-lg"
              >
                {t('session.finishWorkout', 'Finish Workout')} 🔥
              </Button>
            ) : (
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex flex-col items-center gap-1 text-white/40"
              >
                <ChevronDown className="w-6 h-6" />
                <span className="text-sm">{t('session.swipeNext', 'Swipe down for next exercise')}</span>
              </motion.div>
            )}
          </motion.div>
        ) : restMode ? (
          // Rest period
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-[#CCFF00] text-sm uppercase tracking-wider mb-2">
              {t('session.restPeriod', 'Rest Period')}
            </p>
            <motion.p
              className="text-5xl font-bold text-[#CCFF00] mb-4"
              animate={{ scale: restTime <= 5 ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 1, repeat: restTime <= 5 ? Infinity : 0 }}
            >
              {formatTime(restTime)}
            </motion.p>
            <Button
              onClick={skipRest}
              className="w-full h-14 rounded-2xl bg-[#1A1A1A] border-2 border-[#CCFF00] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-all font-semibold text-lg"
            >
              {t('session.skipRest', 'Skip Rest')}
            </Button>
          </motion.div>
        ) : (
          // Ready to do a set
          <Button
            onClick={handleCompleteSet}
            className="w-full h-14 rounded-2xl gradient-cyan text-black font-bold text-lg"
          >
            <Check className="w-5 h-5 mr-2" />
            {t('session.completeSet', 'Complete Set')} {setsCompleted + 1}
          </Button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Main Workout Session (Reels-style)
// ──────────────────────────────────────────────
export default function WorkoutSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get('id');

  const [completedSets, setCompletedSets] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState(null);
  const [sessionStartTime] = useState(Date.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionDbId, setSessionDbId] = useState(null);

  // Exercise media data
  const [exerciseMap, setExerciseMap] = useState({});
  const slideRefs = useRef([]);
  const videoRefs = useRef([]);

  // ── Fetch workout ──
  const { data: workout, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async () => {
      const { data } = await api.get(`/workouts/${workoutId}`);
      return data;
    },
    enabled: !!workoutId
  });

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data;
    }
  });

  const updateWorkoutMutation = useMutation({
    mutationFn: async ({ exercises }) => {
      return api.put(`/workouts/${workoutId}`, { exercises });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', workoutId] });
    }
  });

  // ── Fetch exercise media from DB, with Cloudinary fallback ──
  const gender = profile?.gender || 'male';
  const fetchExercise = useCallback(async (name) => {
    setExerciseMap(prev => ({ ...prev, [name]: 'loading' }));
    try {
      const { data } = await api.get(`/exercises/lookup?name=${encodeURIComponent(name)}`);
      if (data && !data.video_url) {
        data.video_url = getExerciseVideoUrl(name, gender);
      }
      setExerciseMap(prev => ({ ...prev, [name]: data ?? { video_url: getExerciseVideoUrl(name, gender) } }));
    } catch {
      setExerciseMap(prev => ({ ...prev, [name]: { video_url: getExerciseVideoUrl(name, gender) } }));
    }
  }, [gender]);

  useEffect(() => {
    if (!workout?.exercises?.length) return;
    workout.exercises.forEach(ex => fetchExercise(ex.name));
  }, [workout?.exercises?.length, gender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start or resume DB session when workout loads ──
  useEffect(() => {
    if (!workoutId) return;
    const initSession = async () => {
      try {
        const activeRes = await api.get('/workouts/session/active');
        if (activeRes.data?._id) { setSessionDbId(activeRes.data._id); return; }
      } catch (_) { /* none active */ }
      try {
        const res = await api.post('/workouts/session', { workout_id: workoutId });
        if (res.data?._id) setSessionDbId(res.data._id);
      } catch (err) {
        console.error('Failed to start session:', err);
      }
    };
    initSession();
  }, [workoutId]);

  // ── IntersectionObserver: track visible slide, play/pause videos ──
  useEffect(() => {
    if (!workout?.exercises?.length) return;
    const observers = slideRefs.current.map((slide, index) => {
      if (!slide) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setCurrentIndex(index);
            videoRefs.current[index]?.play().catch(() => { });
          } else {
            const v = videoRefs.current[index];
            if (v) { v.pause(); v.currentTime = 0; }
          }
        },
        { threshold: 0.5 },
      );
      obs.observe(slide);
      return obs;
    });
    return () => observers.forEach(obs => obs?.disconnect());
  }, [workout?.exercises?.length]);

  // ── Handlers ──
  const handleCompleteSet = (exerciseId) => {
    const newCount = (completedSets[exerciseId] || 0) + 1;
    setCompletedSets(prev => ({ ...prev, [exerciseId]: newCount }));

    // Log set to DB (fire and forget)
    if (sessionDbId && workout) {
      const exercise = workout.exercises.find(ex => ex.id === exerciseId);
      if (exercise) {
        api.post(`/workouts/session/${sessionDbId}/log`, {
          exercise_name: exercise.name,
          set_number: newCount,
          reps_completed: parseInt(exercise.reps) || 0,
          weight_used: exercise.weight || 0,
        }).catch(err => console.error('Failed to log set:', err));
      }
    }
  };

  const handleFinishWorkout = async () => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);
    const totalSetsCompleted = Object.values(completedSets).reduce((a, b) => a + b, 0);
    const xpEarned = totalSetsCompleted * 10;

    const stats = {
      duration: sessionDuration,
      setsCompleted: totalSetsCompleted,
      exercisesCompleted: workout.exercises.length,
      xpEarned
    };

    setSessionStats(stats);
    setShowSummary(true);

    try {
      await api.put(`/workouts/${workoutId}`, {
        status: 'completed',
        duration_minutes: sessionDuration
      });

      if (sessionDbId) {
        await api.put(`/workouts/session/${sessionDbId}/complete`, {
          completed_exercises: workout.exercises
            .filter(ex => (completedSets[ex.id] || 0) > 0)
            .map(ex => ({
              exercise_id: ex.id,
              sets_completed: completedSets[ex.id] || 0,
            })),
          total_volume: workout.exercises.reduce((sum, ex) =>
            sum + (ex.weight || 0) * (completedSets[ex.id] || 0) * (parseInt(ex.reps) || 0), 0),
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const handleQuit = () => {
    if (window.confirm(t('session.confirmQuit', 'Are you sure you want to quit? Your progress will not be saved.'))) {
      navigate(createPageUrl('Dashboard'));
    }
  };

  const handleSummaryClose = () => {
    navigate(createPageUrl('Dashboard'));
  };

  const handleWorkoutUpdate = (newExercises) => {
    updateWorkoutMutation.mutate({ exercises: newExercises });
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Timer className="w-8 h-8 animate-spin text-[#00F2FF]" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] px-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">{t('session.workoutNotFound', 'Workout Not Found')}</h2>
        <Button onClick={() => navigate(createPageUrl('Dashboard'))}>
          {t('session.goHome', 'Go Home')}
        </Button>
      </div>
    );
  }

  // ── Summary screen ──
  if (showSummary && sessionStats) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6 relative overflow-hidden">
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="w-24 h-24 rounded-full gradient-green flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-12 h-12 text-black" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold mb-2"
          >
            {t('session.workoutComplete', 'Workout Complete! 💪')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-gray-500 mb-8"
          >
            {t('session.outstandingWork', 'Outstanding work today!')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#00F2FF] mb-2">{sessionStats.duration}</p>
              <p className="text-sm text-gray-500">{t('common.min', 'min')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#CCFF00] mb-2">{sessionStats.setsCompleted}</p>
              <p className="text-sm text-gray-500">{t('common.sets', 'Sets')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#FF6B6B] mb-2">{sessionStats.exercisesCompleted}</p>
              <p className="text-sm text-gray-500">{t('workouts.exercises.title', 'Exercises')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#FFD93D] mb-2">+{sessionStats.xpEarned}</p>
              <p className="text-sm text-gray-500">XP</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              onClick={handleSummaryClose}
              className="w-full h-14 gradient-cyan text-black font-semibold text-lg"
            >
              {t('session.backToDashboard', 'Back to Dashboard')}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  //  Main Reels-style workout view
  // ──────────────────────────────────────────────
  const exercises = workout.exercises || [];

  return (
    <div className="fixed inset-0 z-[90] bg-black">
      {/* ── Close / Quit button ── */}
      <button
        onClick={handleQuit}
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
        className="absolute left-4 z-[110] w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ── Vertical progress dots (right side) ── */}
      <div
        className="absolute right-4 z-[110] flex flex-col gap-1.5"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)', marginTop: '56px' }}
      >
        {exercises.map((ex, i) => {
          const exDone = (completedSets[ex.id] || 0) >= ex.sets;
          return (
            <div
              key={i}
              className="w-1.5 rounded-full transition-all duration-300"
              style={{
                height: i === currentIndex ? '24px' : '8px',
                background: exDone
                  ? '#CCFF00'
                  : i === currentIndex
                    ? '#00F2FF'
                    : 'rgba(255,255,255,0.25)',
              }}
            />
          );
        })}
      </div>

      {/* ── Scroll-snap container ── */}
      <div
        className="h-full w-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {exercises.map((exercise, index) => (
          <ExerciseReelSlide
            key={exercise.id || index}
            exercise={exercise}
            index={index}
            totalExercises={exercises.length}
            slideRef={el => { slideRefs.current[index] = el; }}
            videoRef={el => { videoRefs.current[index] = el; }}
            exerciseData={exerciseMap[exercise.name]}
            completedSets={completedSets[exercise.id] || 0}
            onCompleteSet={handleCompleteSet}
            isVisible={Math.abs(index - currentIndex) <= 1}
            isLast={index === exercises.length - 1}
            onFinishWorkout={handleFinishWorkout}
          />
        ))}
      </div>

      {/* ── Floating AI Coach button ── */}
      <motion.button
        onClick={() => setChatOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full gradient-cyan flex items-center justify-center shadow-lg glow-cyan z-[100]"
        style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
      >
        <Sparkles className="w-6 h-6 text-black" />
      </motion.button>

      {/* ── AI Coach Chat ── */}
      <AICoachChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        userProfile={profile}
        currentWorkout={workout}
        onWorkoutUpdate={handleWorkoutUpdate}
        isInSession={true}
      />
    </div>
  );
}