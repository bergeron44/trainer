import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder, useMotionValue, useTransform } from 'framer-motion';
import { GripVertical, RefreshCw, Play, Pause, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const SWIPE_THRESHOLD_HALF = -80;
const SWIPE_THRESHOLD_FULL = -160;

// Alternative exercises database
const ALTERNATIVES = {
  'Bench Press': ['Dumbbell Press', 'Floor Press', 'Push-ups', 'Machine Chest Press'],
  'Overhead Press': ['Arnold Press', 'Landmine Press', 'Pike Push-ups', 'Dumbbell Shoulder Press'],
  'Incline Dumbbell Press': ['Incline Barbell Press', 'Low Cable Flyes', 'Incline Push-ups'],
  'Tricep Dips': ['Skull Crushers', 'Tricep Pushdowns', 'Close Grip Bench Press'],
  'Cable Flyes': ['Dumbbell Flyes', 'Pec Deck', 'Resistance Band Flyes'],
  'Goblet Squats': ['Air Squats', 'Leg Press', 'Split Squats'],
  'Push-ups': ['Knee Push-ups', 'Wall Push-ups', 'Diamond Push-ups'],
  'Dumbbell Rows': ['Cable Rows', 'Barbell Rows', 'T-Bar Rows'],
  'Walking Lunges': ['Reverse Lunges', 'Bulgarian Split Squats', 'Step-ups'],
  'Plank': ['Dead Bug', 'Bird Dog', 'Hollow Hold'],
  'Barbell Rows': ['Seated Cable Rows', 'Pendlay Rows', 'Meadows Rows'],
  'Pull-ups': ['Lat Pulldowns', 'Assisted Pull-ups', 'Chin-ups'],
  'Lateral Raises': ['Cable Lateral Raises', 'Leaning Lateral Raises', 'Machine Laterals'],
  'Face Pulls': ['Rear Delt Flyes', 'Band Pull-aparts', 'Reverse Pec Deck'],
  'Power Cleans': ['Hang Cleans', 'High Pulls', 'Kettlebell Swings'],
  'Box Jumps': ['Jump Squats', 'Depth Jumps', 'Step-ups with Knee Drive'],
  'Medicine Ball Slams': ['Battle Ropes', 'Kettlebell Swings', 'Burpees'],
  'Broad Jumps': ['Standing Long Jumps', 'Tuck Jumps', 'Frog Jumps'],
  'Battle Ropes': ['Jumping Jacks', 'Mountain Climbers', 'High Knees'],
};

function getRandomAlternative(exerciseName) {
  const alts = ALTERNATIVES[exerciseName] || ['Alternative Exercise'];
  return alts[Math.floor(Math.random() * alts.length)];
}

function SwipeableExerciseCard({
  exercise,
  index,
  isActive,
  onSetComplete,
  completedSets = 0,
  onReplace,
  isDragging
}) {
  const { t } = useTranslation();
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [isReplacing, setIsReplacing] = useState(false);

  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [SWIPE_THRESHOLD_FULL, SWIPE_THRESHOLD_HALF, 0],
    ['#FF6B6B', '#FF9500', '#1A1A1A']
  );
  const replaceOpacity = useTransform(x, [-40, SWIPE_THRESHOLD_HALF], [0, 1]);

  React.useEffect(() => {
    let interval;
    if (timerRunning && !restMode) {
      interval = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);
    } else if (restMode && restTime > 0) {
      interval = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) { setRestMode(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, restMode, restTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleComplete = () => {
    setTimerRunning(false);
    setTimeElapsed(0);
    setRestMode(true);
    setRestTime(exercise.rest_seconds || 60);
    onSetComplete(exercise.id, completedSets + 1);
  };

  const handleStartPause = () => {
    if (restMode) { setRestMode(false); setRestTime(0); }
    setTimerRunning(!timerRunning);
  };

  const handleDragEnd = async (_, info) => {
    const offset = info.offset.x;
    if (offset < SWIPE_THRESHOLD_FULL) {
      // Full swipe - auto replace with AI
      setIsReplacing(true);
      const newExercise = getRandomAlternative(exercise.name);
      setTimeout(() => {
        onReplace(exercise.id, { ...exercise, name: newExercise, id: `ex_${Date.now()}` });
        setIsReplacing(false);
      }, 600);
    } else if (offset < SWIPE_THRESHOLD_HALF) {
      // Half swipe - show replace option
      onReplace(exercise.id, { ...exercise, name: getRandomAlternative(exercise.name), id: `ex_${Date.now()}` });
    }
  };

  const allSetsComplete = completedSets >= exercise.sets;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background action indicator */}
      <motion.div
        style={{ background }}
        className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6"
      >
        <motion.div style={{ opacity: replaceOpacity }} className="flex items-center gap-2 text-white font-semibold">
          <RefreshCw className="w-5 h-5" />
          {t('workouts.replace', 'Replace')}
        </motion.div>
      </motion.div>

      {/* Main card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={isReplacing ? { opacity: 0, scale: 0.8, filter: 'blur(10px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
        whileTap={isDragging ? { scale: 0.98 } : {}}
        className={`relative rounded-2xl border-2 p-4 transition-colors duration-300 bg-[#1A1A1A] ${isActive && timerRunning
          ? 'border-[#00F2FF]'
          : restMode
            ? 'border-[#CCFF00]'
            : allSetsComplete
              ? 'border-[#CCFF00]/50'
              : 'border-[#2A2A2A]'
          }`}
      >
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <div className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-5 h-5 text-gray-600" />
          </div>

          {/* Exercise number badge */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${allSetsComplete ? 'bg-[#CCFF00] text-black' : 'bg-[#2A2A2A] text-white'
            }`}>
            {allSetsComplete ? <Check className="w-4 h-4" /> : index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-lg truncate ${allSetsComplete ? 'text-gray-400 line-through' : 'text-white'}`}>
              {exercise.name}
            </h3>

            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="text-gray-400">
                <span className="text-[#00F2FF] font-semibold">{exercise.sets}</span> {t('common.sets', 'sets')}
              </span>
              <span className="text-gray-400">
                <span className="text-[#00F2FF] font-semibold">{exercise.reps}</span> {t('session.reps', 'reps')}
              </span>
              {exercise.weight > 0 && (
                <span className="text-gray-400">
                  <span className="text-[#CCFF00] font-semibold">{exercise.weight}</span> {t('common.kg')}
                </span>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 mt-3">
              {Array.from({ length: exercise.sets }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${i < completedSets
                    ? 'bg-[#CCFF00]'
                    : i === completedSets && timerRunning
                      ? 'bg-[#00F2FF] animate-pulse'
                      : 'bg-[#2A2A2A]'
                    }`}
                />
              ))}
            </div>

            {/* Timer section */}
            {!allSetsComplete && isActive && (
              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={handleStartPause}
                  size="sm"
                  className={`w-10 h-10 rounded-full p-0 transition-all duration-300 ${restMode
                    ? 'bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black'
                    : timerRunning
                      ? 'bg-[#00F2FF] hover:bg-[#00F2FF]/90 text-black'
                      : 'bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white'
                    }`}
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : restMode ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </Button>

                {(timerRunning || restMode) && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
                    {restMode ? (
                      <div>
                        <p className="text-xs text-[#CCFF00] font-medium">{t('session.restPeriod', 'REST')}</p>
                        <p className="text-xl font-bold text-[#CCFF00]">{formatTime(restTime)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-500">{t('session.set', 'Set')} {completedSets + 1} {t('onboarding.of', 'of')} {exercise.sets}</p>
                        <p className="text-xl font-bold text-[#00F2FF]">{formatTime(timeElapsed)}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {timerRunning && !restMode && (
                  <Button onClick={handleComplete} size="sm" className="gradient-green text-black font-semibold px-4">
                    <Check className="w-4 h-4 mr-1" /> {t('common.done', 'Done')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function InteractiveExerciseList({
  exercises,
  onReorder,
  onReplace,
  isActive,
  completedSets,
  onSetComplete
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleReorder = (newOrder) => {
    onReorder(newOrder);
  };

  return (
    <Reorder.Group
      axis="y"
      values={exercises}
      onReorder={handleReorder}
      className="space-y-3"
    >
      <AnimatePresence mode="popLayout">
        {exercises.map((exercise, index) => (
          <Reorder.Item
            key={exercise.id}
            value={exercise}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0, 242, 255, 0.2)', zIndex: 50 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="list-none"
          >
            <SwipeableExerciseCard
              exercise={exercise}
              index={index}
              isActive={isActive}
              completedSets={completedSets[exercise.id] || 0}
              onSetComplete={onSetComplete}
              onReplace={onReplace}
              isDragging={isDragging}
            />
          </Reorder.Item>
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}