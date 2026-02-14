import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, GripVertical, Plus, Trash2, Save, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function EditableExercise({ exercise, onChange, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = (field, value) => {
    onChange({ ...exercise, [field]: value });
  };

  return (
    <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="w-5 h-5 text-gray-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <Input
            value={exercise.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="bg-transparent border-none p-0 h-auto text-white font-semibold focus:ring-0"
            placeholder="Exercise name"
          />
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-[#2A2A2A] rounded-lg"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sets</label>
                <Input
                  type="number"
                  value={exercise.sets}
                  onChange={(e) => updateField('sets', parseInt(e.target.value) || 0)}
                  className="bg-[#0A0A0A] border-[#2A2A2A] text-center"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reps</label>
                <Input
                  value={exercise.reps}
                  onChange={(e) => updateField('reps', e.target.value)}
                  className="bg-[#0A0A0A] border-[#2A2A2A] text-center"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Weight (kg)</label>
                <Input
                  type="number"
                  value={exercise.weight || 0}
                  onChange={(e) => updateField('weight', parseFloat(e.target.value) || 0)}
                  className="bg-[#0A0A0A] border-[#2A2A2A] text-center"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isExpanded && (
        <div className="px-3 pb-3 flex gap-4 text-xs text-gray-400">
          <span><span className="text-[#00F2FF]">{exercise.sets}</span> sets</span>
          <span><span className="text-[#00F2FF]">{exercise.reps}</span> reps</span>
          {exercise.weight > 0 && <span><span className="text-[#CCFF00]">{exercise.weight}</span> kg</span>}
        </div>
      )}
    </div>
  );
}

export default function WorkoutEditorSheet({ isOpen, onClose, workout, onSave }) {
  const [exercises, setExercises] = useState([]);
  const [workoutName, setWorkoutName] = useState('');

  useEffect(() => {
    if (workout) {
      setExercises(workout.exercises || []);
      setWorkoutName(workout.muscle_group || workout.name || '');
    }
  }, [workout]);

  const handleExerciseChange = (index, updatedExercise) => {
    const newExercises = [...exercises];
    newExercises[index] = updatedExercise;
    setExercises(newExercises);
  };

  const handleDeleteExercise = (index) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      {
        id: `ex_${Date.now()}`,
        name: 'New Exercise',
        sets: 3,
        reps: '10',
        weight: 0,
        rest_seconds: 60
      }
    ]);
  };

  const handleSave = () => {
    onSave({
      ...workout,
      muscle_group: workoutName,
      exercises
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 h-[85vh] bg-[#0A0A0A] rounded-t-3xl border-t border-[#2A2A2A] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
              <div className="flex-1">
                <Input
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  className="bg-transparent border-none text-xl font-bold p-0 h-auto focus:ring-0"
                  placeholder="Workout name"
                />
                <p className="text-xs text-gray-500 mt-1">{exercises.length} exercises</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#1A1A1A] rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Exercise list */}
            <div className="flex-1 overflow-y-auto p-4">
              <Reorder.Group
                axis="y"
                values={exercises}
                onReorder={setExercises}
                className="space-y-3"
              >
                {exercises.map((exercise, index) => (
                  <Reorder.Item
                    key={exercise.id}
                    value={exercise}
                    className="list-none"
                  >
                    <EditableExercise
                      exercise={exercise}
                      onChange={(updated) => handleExerciseChange(index, updated)}
                      onDelete={() => handleDeleteExercise(index)}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <button
                onClick={handleAddExercise}
                className="w-full mt-4 p-4 rounded-xl border-2 border-dashed border-[#2A2A2A] hover:border-[#00F2FF] hover:bg-[#00F2FF]/5 transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-[#00F2FF]"
              >
                <Plus className="w-5 h-5" />
                Add Exercise
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#2A2A2A]">
              <Button
                onClick={handleSave}
                className="w-full h-12 gradient-cyan text-black font-bold"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Workout
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}