import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, GripVertical, Check, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExerciseSearchInput from './ExerciseSearchInput';

// An exercise is "confirmed" when it has been selected from the DB (has an id)
const DEFAULT_EXERCISE = () => ({ id: '', name: '', sets: 3, reps: '10', rest_seconds: 60 });

const DEFAULT_STEPS = [
  { type: 'workout', name: 'Push',  exercises: [DEFAULT_EXERCISE()] },
  { type: 'workout', name: 'Pull',  exercises: [DEFAULT_EXERCISE()] },
  { type: 'workout', name: 'Legs',  exercises: [DEFAULT_EXERCISE()] },
  { type: 'rest' },
];

export default function PlanImport({ onComplete, onBack }) {
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [activeStep, setActiveStep] = useState(0);

  // ── Step management ──────────────────────────────────────────────────────────

  const addWorkoutStep = () => {
    const next = [...steps, { type: 'workout', name: '', exercises: [DEFAULT_EXERCISE()] }];
    setSteps(next);
    setActiveStep(next.length - 1);
  };

  const addRestStep = () => {
    const next = [...steps, { type: 'rest' }];
    setSteps(next);
    setActiveStep(next.length - 1);
  };

  const removeStep = (index) => {
    const next = steps.filter((_, i) => i !== index);
    setSteps(next);
    if (activeStep >= next.length) setActiveStep(Math.max(0, next.length - 1));
  };

  const updateStepName = (index, name) => {
    const next = [...steps];
    next[index] = { ...next[index], name };
    setSteps(next);
  };

  // ── Exercise management ───────────────────────────────────────────────────────

  const addExercise = (stepIndex) => {
    const next = [...steps];
    next[stepIndex] = {
      ...next[stepIndex],
      exercises: [...(next[stepIndex].exercises || []), DEFAULT_EXERCISE()],
    };
    setSteps(next);
  };

  const updateExercise = (stepIndex, exIndex, update) => {
    const next = [...steps];
    const exercises = [...(next[stepIndex].exercises || [])];
    if (update === null) {
      // User cleared/is typing freely — reset to unconfirmed
      exercises[exIndex] = { ...exercises[exIndex], id: '', name: '' };
    } else {
      exercises[exIndex] = { ...exercises[exIndex], ...update };
    }
    next[stepIndex] = { ...next[stepIndex], exercises };
    setSteps(next);
  };

  const removeExercise = (stepIndex, exIndex) => {
    const next = [...steps];
    next[stepIndex] = {
      ...next[stepIndex],
      exercises: next[stepIndex].exercises.filter((_, i) => i !== exIndex),
    };
    setSteps(next);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleComplete = () => {
    const cleaned = steps.map((step) => {
      if (step.type === 'rest') return { type: 'rest' };
      return {
        type: 'workout',
        name: step.name,
        exercises: (step.exercises || []).filter((e) => e.name.trim() !== ''),
      };
    }).filter((step) => step.type === 'rest' || step.exercises.length > 0);

    onComplete(cleaned);
  };

  // Valid only when at least one workout step has at least one DB-confirmed exercise (has id)
  const hasValidPlan = steps.some(
    (step) => step.type === 'workout' && (step.exercises || []).some((e) => e.id && e.name.trim() !== '')
  );

  // Warn if any workout step has unconfirmed exercises (typed but not selected from DB)
  const hasUnconfirmedExercises = steps.some(
    (step) => step.type === 'workout' && (step.exercises || []).some((e) => e.name.trim() !== '' && !e.id)
  );

  const currentStep = steps[activeStep];

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
        <h1 className="text-2xl font-bold mb-1">Define Your Cycle</h1>
        <p className="text-gray-500 text-sm">
          Build a repeating sequence — the app schedules it automatically from today.
        </p>
      </div>

      {/* Step Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {steps.map((step, index) => (
          <button
            key={index}
            onClick={() => setActiveStep(index)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${
              activeStep === index
                ? 'bg-[#00F2FF] text-black'
                : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2A2A2A]'
            }`}
          >
            {step.type === 'rest'
              ? <><Moon className="w-3 h-3" /> Rest</>
              : (step.name || `Day ${index + 1}`)
            }
          </button>
        ))}
        {steps.length < 14 && (
          <>
            <button
              onClick={addWorkoutStep}
              title="Add workout day"
              className="px-3 py-2 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={addRestStep}
              title="Add rest day"
              className="px-3 py-2 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-purple-400 hover:text-purple-400 transition-all flex-shrink-0"
            >
              <Moon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Step Editor */}
      {currentStep && (
        <div className="flex-1 space-y-4">
          {currentStep.type === 'rest' ? (
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A] flex flex-col items-center gap-3 text-center">
              <Moon className="w-8 h-8 text-purple-400" />
              <p className="text-gray-400 text-sm">Rest day — no workout scheduled for this position in the cycle.</p>
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(activeStep)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove this step
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Step name + remove */}
              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                <div className="flex items-center gap-3">
                  <Input
                    value={currentStep.name}
                    onChange={(e) => updateStepName(activeStep, e.target.value)}
                    placeholder="Workout name (e.g., Push, Legs, Full Body)"
                    className="flex-1 bg-[#0A0A0A] border-[#2A2A2A]"
                  />
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(activeStep)}
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
                  <span className="text-xs text-gray-600">
                    {(currentStep.exercises || []).length} exercises
                  </span>
                </div>

                <AnimatePresence>
                  {(currentStep.exercises || []).map((exercise, exIndex) => (
                    <motion.div
                      key={exIndex}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-[#1A1A1A] rounded-xl p-3 border border-[#2A2A2A]"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <ExerciseSearchInput
                          value={exercise.name}
                          onChange={(update) => updateExercise(activeStep, exIndex, update)}
                          placeholder="Search exercise..."
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={exercise.sets}
                            onChange={(e) => updateExercise(activeStep, exIndex, { sets: parseInt(e.target.value) || 0 })}
                            className="w-14 bg-[#0A0A0A] border-[#2A2A2A] h-9 text-center"
                          />
                          <span className="text-gray-600 text-sm">×</span>
                          <Input
                            value={exercise.reps}
                            onChange={(e) => updateExercise(activeStep, exIndex, { reps: e.target.value })}
                            placeholder="10"
                            className="w-16 bg-[#0A0A0A] border-[#2A2A2A] h-9 text-center"
                          />
                        </div>
                        <button
                          onClick={() => removeExercise(activeStep, exIndex)}
                          className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <button
                  onClick={() => addExercise(activeStep)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-[#2A2A2A] text-gray-500 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Exercise
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[#2A2A2A]">
        {hasUnconfirmedExercises && (
          <p className="text-xs text-yellow-600 text-center mb-3">
            Some exercises haven't been selected from the database — pick from the dropdown to confirm them.
          </p>
        )}
        <Button
          onClick={handleComplete}
          disabled={!hasValidPlan || hasUnconfirmedExercises}
          className={`w-full h-12 font-semibold ${
            hasValidPlan && !hasUnconfirmedExercises
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
