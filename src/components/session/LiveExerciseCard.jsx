import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Check, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveExerciseCard({
  exercise,
  isActive,
  completedSets,
  onSetComplete,
  adjustment,
  pulsePhase // 'work' | 'rest' | 'idle'
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [currentWeight, setCurrentWeight] = useState(exercise.weight || 0);
  const [currentReps, setCurrentReps] = useState(exercise.reps);

  // Apply AI adjustments
  useEffect(() => {
    if (adjustment) {
      if (adjustment.weight) setCurrentWeight(adjustment.weight);
      if (adjustment.reps) setCurrentReps(adjustment.reps);
    }
  }, [adjustment]);

  useEffect(() => {
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

  const adjustWeight = (delta) => {
    setCurrentWeight(prev => Math.max(0, prev + delta));
  };

  const allSetsComplete = completedSets >= exercise.sets;

  // Dynamic border color based on phase
  const getBorderStyle = () => {
    if (allSetsComplete) return 'border-[#CCFF00]/50';
    if (restMode) return 'border-[#CCFF00]';
    if (timerRunning) return 'border-[#00F2FF]';
    return 'border-[#2A2A2A]';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border-2 ${getBorderStyle()} bg-[#1A1A1A]/80 backdrop-blur-sm overflow-hidden`}
    >
      {/* Pulse effect overlay */}
      {(timerRunning || restMode) && (
        <motion.div
          animate={{ opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: restMode ? 3 : 1.5, repeat: Infinity }}
          className={`absolute inset-0 ${restMode ? 'bg-[#CCFF00]' : 'bg-[#00F2FF]'}`}
        />
      )}

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${allSetsComplete ? 'text-gray-500 line-through' : 'text-white'}`}>
              {exercise.name}
            </h3>
            {adjustment && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-[#CCFF00] mt-1"
              >
                ✨ AI adjusted: {adjustment.reason}
              </motion.p>
            )}
          </div>
          
          {/* Completion badge */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            allSetsComplete ? 'bg-[#CCFF00] text-black' : 'bg-[#2A2A2A] text-white'
          }`}>
            {allSetsComplete ? <Check className="w-5 h-5" /> : `${completedSets}/${exercise.sets}`}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Sets */}
          <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Sets</p>
            <p className="text-lg font-bold text-[#00F2FF]">{exercise.sets}</p>
          </div>
          
          {/* Reps */}
          <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Reps</p>
            <p className={`text-lg font-bold ${adjustment?.reps ? 'text-[#CCFF00]' : 'text-[#00F2FF]'}`}>
              {currentReps}
            </p>
          </div>
          
          {/* Weight with adjusters */}
          <div className="bg-[#0A0A0A] rounded-xl p-2 text-center">
            <p className="text-xs text-gray-500 mb-1">Weight</p>
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => adjustWeight(-2.5)} className="p-0.5 hover:bg-[#2A2A2A] rounded">
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              <p className={`text-lg font-bold ${adjustment?.weight ? 'text-[#CCFF00]' : 'text-[#00F2FF]'}`}>
                {currentWeight}
              </p>
              <button onClick={() => adjustWeight(2.5)} className="p-0.5 hover:bg-[#2A2A2A] rounded">
                <ChevronUp className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: exercise.sets }).map((_, i) => (
            <motion.div
              key={i}
              animate={i === completedSets && timerRunning ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={`w-3 h-3 rounded-full transition-all ${
                i < completedSets
                  ? 'bg-[#CCFF00]'
                  : i === completedSets && timerRunning
                  ? 'bg-[#00F2FF]'
                  : 'bg-[#2A2A2A]'
              }`}
            />
          ))}
        </div>

        {/* Timer and controls */}
        {!allSetsComplete && (
          <div className="flex items-center gap-4">
            <Button
              onClick={handleStartPause}
              className={`w-14 h-14 rounded-full p-0 ${
                restMode
                  ? 'bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black'
                  : timerRunning
                  ? 'bg-[#00F2FF] hover:bg-[#00F2FF]/90 text-black'
                  : 'bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white'
              }`}
            >
              {timerRunning ? <Pause className="w-6 h-6" /> : restMode ? <RotateCcw className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </Button>

            <div className="flex-1">
              {restMode ? (
                <div>
                  <p className="text-xs text-[#CCFF00] font-medium">REST TIME</p>
                  <p className="text-3xl font-bold text-[#CCFF00] font-mono">{formatTime(restTime)}</p>
                </div>
              ) : timerRunning ? (
                <div>
                  <p className="text-xs text-gray-500">Set {completedSets + 1} in progress</p>
                  <p className="text-3xl font-bold text-[#00F2FF] font-mono">{formatTime(timeElapsed)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500">Ready for set {completedSets + 1}</p>
                  <p className="text-sm text-gray-400">Tap to start</p>
                </div>
              )}
            </div>

            {timerRunning && !restMode && (
              <Button
                onClick={handleComplete}
                className="bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black font-bold px-6 h-12"
              >
                <Check className="w-5 h-5 mr-2" />
                Done
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}