import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, GripVertical, Dumbbell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_EXERCISES = [
  { name: '', sets: 3, reps: '10' }
];

export default function PlanImport({ onComplete, onBack }) {
  const [workoutDays, setWorkoutDays] = useState([
    { day: 'Monday', name: 'Push', exercises: [...DEFAULT_EXERCISES] },
    { day: 'Wednesday', name: 'Pull', exercises: [...DEFAULT_EXERCISES] },
    { day: 'Friday', name: 'Legs', exercises: [...DEFAULT_EXERCISES] }
  ]);
  const [activeDay, setActiveDay] = useState(0);

  const addWorkoutDay = () => {
    const usedDays = workoutDays.map(w => w.day);
    const availableDay = DAYS_OF_WEEK.find(d => !usedDays.includes(d));
    if (availableDay) {
      setWorkoutDays([...workoutDays, { 
        day: availableDay, 
        name: '', 
        exercises: [...DEFAULT_EXERCISES] 
      }]);
      setActiveDay(workoutDays.length);
    }
  };

  const removeWorkoutDay = (index) => {
    const newDays = workoutDays.filter((_, i) => i !== index);
    setWorkoutDays(newDays);
    if (activeDay >= newDays.length) {
      setActiveDay(Math.max(0, newDays.length - 1));
    }
  };

  const updateWorkoutDay = (index, field, value) => {
    const newDays = [...workoutDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setWorkoutDays(newDays);
  };

  const addExercise = (dayIndex) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].exercises.push({ name: '', sets: 3, reps: '10' });
    setWorkoutDays(newDays);
  };

  const updateExercise = (dayIndex, exerciseIndex, field, value) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].exercises[exerciseIndex] = {
      ...newDays[dayIndex].exercises[exerciseIndex],
      [field]: value
    };
    setWorkoutDays(newDays);
  };

  const removeExercise = (dayIndex, exerciseIndex) => {
    const newDays = [...workoutDays];
    newDays[dayIndex].exercises = newDays[dayIndex].exercises.filter((_, i) => i !== exerciseIndex);
    setWorkoutDays(newDays);
  };

  const handleComplete = () => {
    // Filter out empty exercises and validate
    const cleanedPlan = workoutDays.map(day => ({
      ...day,
      exercises: day.exercises.filter(e => e.name.trim() !== '')
    })).filter(day => day.exercises.length > 0);

    onComplete(cleanedPlan);
  };

  const currentDay = workoutDays[activeDay];
  const hasValidPlan = workoutDays.some(day => 
    day.exercises.some(e => e.name.trim() !== '')
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col px-4 py-6"
    >
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 mb-4 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold mb-1">Import Your Routine</h1>
        <p className="text-gray-500 text-sm">Add your current workout days and exercises</p>
      </div>

      {/* Day Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {workoutDays.map((day, index) => (
          <button
            key={index}
            onClick={() => setActiveDay(index)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all flex-shrink-0 ${
              activeDay === index
                ? 'bg-[#00F2FF] text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2A2A2A]'
            }`}
          >
            {day.name || day.day}
          </button>
        ))}
        {workoutDays.length < 7 && (
          <button
            onClick={addWorkoutDay}
            className="px-4 py-2 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Current Day Editor */}
      {currentDay && (
        <div className="flex-1 space-y-4">
          {/* Day Settings */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
            <div className="flex items-center gap-3 mb-3">
              <select
                value={currentDay.day}
                onChange={(e) => updateWorkoutDay(activeDay, 'day', e.target.value)}
                className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm"
              >
                {DAYS_OF_WEEK.map(day => (
                  <option 
                    key={day} 
                    value={day}
                    disabled={workoutDays.some((w, i) => w.day === day && i !== activeDay)}
                  >
                    {day}
                  </option>
                ))}
              </select>
              <Input
                value={currentDay.name}
                onChange={(e) => updateWorkoutDay(activeDay, 'name', e.target.value)}
                placeholder="Workout name (e.g., Push, Legs)"
                className="flex-1 bg-[#0A0A0A] border-[#2A2A2A]"
              />
              {workoutDays.length > 1 && (
                <button
                  onClick={() => removeWorkoutDay(activeDay)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Exercises */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">Exercises</h3>
              <span className="text-xs text-gray-600">{currentDay.exercises.length} exercises</span>
            </div>
            
            <AnimatePresence>
              {currentDay.exercises.map((exercise, exerciseIndex) => (
                <motion.div
                  key={exerciseIndex}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-[#1A1A1A] rounded-xl p-3 border border-[#2A2A2A]"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <Input
                      value={exercise.name}
                      onChange={(e) => updateExercise(activeDay, exerciseIndex, 'name', e.target.value)}
                      placeholder="Exercise name"
                      className="flex-1 bg-[#0A0A0A] border-[#2A2A2A] h-9"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) => updateExercise(activeDay, exerciseIndex, 'sets', parseInt(e.target.value) || 0)}
                        className="w-14 bg-[#0A0A0A] border-[#2A2A2A] h-9 text-center"
                      />
                      <span className="text-gray-600 text-sm">×</span>
                      <Input
                        value={exercise.reps}
                        onChange={(e) => updateExercise(activeDay, exerciseIndex, 'reps', e.target.value)}
                        placeholder="10"
                        className="w-16 bg-[#0A0A0A] border-[#2A2A2A] h-9 text-center"
                      />
                    </div>
                    <button
                      onClick={() => removeExercise(activeDay, exerciseIndex)}
                      className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <button
              onClick={() => addExercise(activeDay)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Exercise
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
        <Button
          onClick={handleComplete}
          disabled={!hasValidPlan}
          className={`w-full h-12 font-semibold ${
            hasValidPlan 
              ? 'gradient-cyan text-black' 
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4 mr-2" />
          Save My Routine
        </Button>
        <p className="text-xs text-gray-600 text-center mt-3">
          You can always edit this later in settings
        </p>
      </div>
    </motion.div>
  );
}