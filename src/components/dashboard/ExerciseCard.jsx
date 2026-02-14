import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Check, Edit2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExerciseCard({
  exercise,
  index,
  isActive,
  onSetComplete,
  onEdit,
  completedSets = 0
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [restTime, setRestTime] = useState(0);

  useEffect(() => {
    let interval;
    if (timerRunning && !restMode) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else if (restMode && restTime > 0) {
      interval = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            setRestMode(false);
            return 0;
          }
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
    if (restMode) {
      setRestMode(false);
      setRestTime(0);
    }
    setTimerRunning(!timerRunning);
  };

  const allSetsComplete = completedSets >= exercise.sets;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
      className={`relative rounded-2xl border-2 p-4 transition-all duration-500 ${
        isActive && timerRunning
          ? 'border-[#00F2FF] bg-[#00F2FF]/5 animate-pulse-glow'
          : restMode
          ? 'border-[#CCFF00] bg-[#CCFF00]/5'
          : allSetsComplete
          ? 'border-[#CCFF00]/50 bg-[#1A1A1A]'
          : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      {/* Exercise number badge */}
      <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        allSetsComplete ? 'bg-[#CCFF00] text-black' : 'bg-[#2A2A2A] text-white'
      }`}>
        {allSetsComplete ? <Check className="w-4 h-4" /> : index + 1}
      </div>

      {/* Edit button */}
      <button
        onClick={() => onEdit(exercise)}
        className="absolute top-3 right-3 p-2 rounded-lg bg-[#2A2A2A] hover:bg-[#3A3A3A] transition-colors"
      >
        <Edit2 className="w-4 h-4 text-gray-400" />
      </button>

      <div className="pr-12">
        <h3 className={`font-bold text-lg ${allSetsComplete ? 'text-gray-400 line-through' : 'text-white'}`}>
          {exercise.name}
        </h3>
        
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-gray-400">
            <span className="text-[#00F2FF] font-semibold">{exercise.sets}</span> sets
          </span>
          <span className="text-gray-400">
            <span className="text-[#00F2FF] font-semibold">{exercise.reps}</span> reps
          </span>
          {exercise.weight > 0 && (
            <span className="text-gray-400">
              <span className="text-[#CCFF00] font-semibold">{exercise.weight}</span> kg
            </span>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-3">
          {Array.from({ length: exercise.sets }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < completedSets
                  ? 'bg-[#CCFF00]'
                  : i === completedSets && timerRunning
                  ? 'bg-[#00F2FF] animate-pulse'
                  : 'bg-[#2A2A2A]'
              }`}
            />
          ))}
        </div>

        {/* Timer section */}
        {!allSetsComplete && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleStartPause}
              size="sm"
              className={`w-12 h-12 rounded-full p-0 transition-all duration-300 ${
                restMode
                  ? 'bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black'
                  : timerRunning
                  ? 'bg-[#00F2FF] hover:bg-[#00F2FF]/90 text-black'
                  : 'bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white'
              }`}
            >
              {timerRunning ? (
                <Pause className="w-5 h-5" />
              ) : restMode ? (
                <RotateCcw className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            {(timerRunning || restMode) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1"
              >
                {restMode ? (
                  <div>
                    <p className="text-xs text-[#CCFF00] font-medium">REST</p>
                    <p className="text-2xl font-bold text-[#CCFF00]">{formatTime(restTime)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-500">Set {completedSets + 1} of {exercise.sets}</p>
                    <p className="text-2xl font-bold text-[#00F2FF]">{formatTime(timeElapsed)}</p>
                  </div>
                )}
              </motion.div>
            )}

            {timerRunning && !restMode && (
              <Button
                onClick={handleComplete}
                size="sm"
                className="gradient-green text-black font-semibold px-6"
              >
                <Check className="w-4 h-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        )}

        {exercise.notes && (
          <p className="text-xs text-gray-500 mt-3 italic">💡 {exercise.notes}</p>
        )}
      </div>
    </motion.div>
  );
}