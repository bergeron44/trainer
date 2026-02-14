import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Play, CheckCircle, Calendar, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InteractiveExerciseList from '@/components/dashboard/InteractiveExerciseList';
import ProgressRing from '@/components/dashboard/ProgressRing';
import WorkoutPlanTabs from '@/components/dashboard/WorkoutPlanTabs';
import WorkoutEditorSheet from '@/components/dashboard/WorkoutEditorSheet';

const generateWorkout = (profile) => {
  const workoutPlans = {
    weight_loss: {
      muscle_groups: ['Full Body', 'Upper Body', 'Lower Body', 'HIIT Circuit', 'Core & Cardio'],
      exercises: {
        'Full Body': [
          { name: 'Goblet Squats', sets: 3, reps: '12-15', weight: 12, rest_seconds: 45 },
          { name: 'Push-ups', sets: 3, reps: '10-15', weight: 0, rest_seconds: 45 },
          { name: 'Dumbbell Rows', sets: 3, reps: '12', weight: 10, rest_seconds: 45 },
          { name: 'Walking Lunges', sets: 3, reps: '20 steps', weight: 0, rest_seconds: 45 },
          { name: 'Plank', sets: 3, reps: '45 sec', weight: 0, rest_seconds: 30 }
        ]
      }
    },
    muscle_gain: {
      muscle_groups: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
      exercises: {
        'Push': [
          { name: 'Bench Press', sets: 4, reps: '8-10', weight: 60, rest_seconds: 90 },
          { name: 'Overhead Press', sets: 4, reps: '8-10', weight: 40, rest_seconds: 90 },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', weight: 22, rest_seconds: 60 },
          { name: 'Tricep Dips', sets: 3, reps: '10-12', weight: 0, rest_seconds: 60 },
          { name: 'Cable Flyes', sets: 3, reps: '12-15', weight: 15, rest_seconds: 45 }
        ]
      }
    },
    recomp: {
      muscle_groups: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full Body'],
      exercises: {
        'Upper A': [
          { name: 'Barbell Rows', sets: 4, reps: '8-10', weight: 50, rest_seconds: 90 },
          { name: 'Dumbbell Bench Press', sets: 4, reps: '10-12', weight: 24, rest_seconds: 90 },
          { name: 'Pull-ups', sets: 3, reps: '8-10', weight: 0, rest_seconds: 90 },
          { name: 'Lateral Raises', sets: 3, reps: '12-15', weight: 8, rest_seconds: 45 },
          { name: 'Face Pulls', sets: 3, reps: '15-20', weight: 15, rest_seconds: 45 }
        ]
      }
    },
    athletic_performance: {
      muscle_groups: ['Power', 'Speed', 'Strength', 'Agility', 'Recovery'],
      exercises: {
        'Power': [
          { name: 'Power Cleans', sets: 5, reps: '3', weight: 50, rest_seconds: 120 },
          { name: 'Box Jumps', sets: 4, reps: '5', weight: 0, rest_seconds: 90 },
          { name: 'Medicine Ball Slams', sets: 3, reps: '10', weight: 8, rest_seconds: 60 },
          { name: 'Broad Jumps', sets: 3, reps: '8', weight: 0, rest_seconds: 60 },
          { name: 'Battle Ropes', sets: 3, reps: '30 sec', weight: 0, rest_seconds: 45 }
        ]
      }
    }
  };

  const goal = profile?.goal || 'muscle_gain';
  const plan = workoutPlans[goal] || workoutPlans.muscle_gain;
  const dayOfWeek = new Date().getDay();
  const muscleGroup = plan.muscle_groups[dayOfWeek % plan.muscle_groups.length];
  
  const exerciseKey = Object.keys(plan.exercises)[0];
  const exercises = plan.exercises[exerciseKey].map((ex, i) => ({
    ...ex,
    id: `ex_${Date.now()}_${i}`
  }));

  return {
    id: `workout_${Date.now()}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    muscle_group: muscleGroup,
    exercises,
    status: 'planned'
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [completedSets, setCompletedSets] = useState({});
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);

  // Load profile and workout from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('nexus_user_profile');
    if (!savedProfile) {
      navigate(createPageUrl('Onboarding'));
      return;
    }

    const profileData = JSON.parse(savedProfile);
    setProfile(profileData);

    // Check for today's workout
    const today = format(new Date(), 'yyyy-MM-dd');
    const savedWorkouts = localStorage.getItem('nexus_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    
    let todaysWorkout = workouts.find(w => w.date === today);
    
    if (!todaysWorkout) {
      todaysWorkout = generateWorkout(profileData);
      workouts.push(todaysWorkout);
      localStorage.setItem('nexus_workouts', JSON.stringify(workouts));
    }
    
    setTodayWorkout(todaysWorkout);

    // Generate workout plans based on goal
    const goal = profileData?.goal || 'muscle_gain';
    const planNames = {
      weight_loss: ['Full Body', 'Upper Body', 'Lower Body', 'HIIT Circuit', 'Core & Cardio'],
      muscle_gain: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
      recomp: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full Body'],
      athletic_performance: ['Power', 'Speed', 'Strength', 'Agility', 'Recovery']
    };
    const plans = (planNames[goal] || planNames.muscle_gain).map((name, i) => ({
      id: `plan_${i}`,
      name
    }));
    setWorkoutPlans(plans);
    setActivePlanId(plans.find(p => p.name === todaysWorkout.muscle_group)?.id || plans[0]?.id);

    // Load completed sets
    const savedCompletedSets = localStorage.getItem(`nexus_completed_sets_${today}`);
    if (savedCompletedSets) {
      setCompletedSets(JSON.parse(savedCompletedSets));
    }
  }, [navigate]);

  const handleStartWorkout = () => {
    navigate(createPageUrl('LiveSession'));
  };

  const handleSetComplete = (exerciseId, setNumber) => {
    const newCompletedSets = {
      ...completedSets,
      [exerciseId]: setNumber
    };
    setCompletedSets(newCompletedSets);
    
    // Save to localStorage
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem(`nexus_completed_sets_${today}`, JSON.stringify(newCompletedSets));
  };

  const handleReorderExercises = (newOrder) => {
    setTodayWorkout(prev => ({ ...prev, exercises: newOrder }));
    // Save updated order to localStorage
    const savedWorkouts = localStorage.getItem('nexus_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    workouts = workouts.map(w => w.id === todayWorkout.id ? { ...w, exercises: newOrder } : w);
    localStorage.setItem('nexus_workouts', JSON.stringify(workouts));
  };

  const handleReplaceExercise = (exerciseId, newExercise) => {
    const newExercises = todayWorkout.exercises.map(ex => 
      ex.id === exerciseId ? newExercise : ex
    );
    setTodayWorkout(prev => ({ ...prev, exercises: newExercises }));
    // Save to localStorage
    const savedWorkouts = localStorage.getItem('nexus_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    workouts = workouts.map(w => w.id === todayWorkout.id ? { ...w, exercises: newExercises } : w);
    localStorage.setItem('nexus_workouts', JSON.stringify(workouts));
  };

  const handleOpenEditor = (plan) => {
    // Find or generate workout for this plan
    const savedWorkouts = localStorage.getItem('nexus_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    let workoutForPlan = workouts.find(w => w.muscle_group === plan.name);
    
    if (!workoutForPlan) {
      workoutForPlan = { ...todayWorkout, muscle_group: plan.name, id: `workout_${plan.id}` };
    }
    setEditingWorkout(workoutForPlan);
    setEditorOpen(true);
  };

  const handleSaveWorkout = (updatedWorkout) => {
    const savedWorkouts = localStorage.getItem('nexus_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    
    const existingIndex = workouts.findIndex(w => w.id === updatedWorkout.id);
    if (existingIndex >= 0) {
      workouts[existingIndex] = updatedWorkout;
    } else {
      workouts.push(updatedWorkout);
    }
    
    localStorage.setItem('nexus_workouts', JSON.stringify(workouts));
    
    // Update today's workout if it matches
    if (todayWorkout?.id === updatedWorkout.id) {
      setTodayWorkout(updatedWorkout);
    }
  };

  const handleSelectPlan = (planId) => {
    setActivePlanId(planId);
    const plan = workoutPlans.find(p => p.id === planId);
    if (plan) {
      const savedWorkouts = localStorage.getItem('nexus_workouts');
      let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
      const workoutForPlan = workouts.find(w => w.muscle_group === plan.name);
      if (workoutForPlan) {
        setTodayWorkout(workoutForPlan);
      }
    }
  };

  const totalSets = todayWorkout?.exercises?.reduce((acc, ex) => acc + ex.sets, 0) || 0;
  const completedSetsTotal = Object.values(completedSets).reduce((acc, sets) => acc + sets, 0);
  const progress = totalSets > 0 ? Math.round((completedSetsTotal / totalSets) * 100) : 0;

  if (!profile || !todayWorkout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="text-2xl font-bold mt-1">
          Today's Focus: <span className="text-[#00F2FF]">{todayWorkout?.muscle_group || 'Rest Day'}</span>
        </h1>
      </motion.div>

      {/* Workout Plan Tabs */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        <WorkoutPlanTabs
          plans={workoutPlans}
          activePlan={activePlanId}
          onSelect={handleSelectPlan}
          onOpenEditor={handleOpenEditor}
        />
      </motion.div>

      {/* Progress Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-6 border border-[#2A2A2A] mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Workout Progress</h2>
            <p className="text-gray-500 text-sm">
              {completedSetsTotal} of {totalSets} sets completed
            </p>
            
            {!workoutStarted ? (
              <Button
                onClick={handleStartWorkout}
                className="mt-4 gradient-cyan text-black font-semibold px-6"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Workout
              </Button>
            ) : progress === 100 ? (
              <div className="mt-4 flex items-center gap-2 text-[#CCFF00]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Workout Complete!</span>
              </div>
            ) : null}
          </div>
          
          <ProgressRing progress={progress} size={100} strokeWidth={8}>
            <div className="text-center">
              <span className="text-2xl font-bold">{progress}%</span>
            </div>
          </ProgressRing>
        </div>
      </motion.div>

      {/* Exercises */}
      {todayWorkout?.exercises && (
        <InteractiveExerciseList
          exercises={todayWorkout.exercises}
          onReorder={handleReorderExercises}
          onReplace={handleReplaceExercise}
          isActive={workoutStarted}
          completedSets={completedSets}
          onSetComplete={handleSetComplete}
        />
      )}

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 grid grid-cols-2 gap-3"
      >
        <button 
          onClick={() => navigate(createPageUrl('TrainingCalendar'))}
          className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors text-left"
        >
          <Calendar className="w-6 h-6 text-[#00F2FF] mb-2" />
          <p className="font-semibold">Calendar</p>
          <p className="text-xs text-gray-500">View full schedule</p>
        </button>
        <button 
          onClick={() => navigate(createPageUrl('NutritionDemo'))}
          className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors text-left"
        >
          <Dumbbell className="w-6 h-6 text-[#CCFF00] mb-2" />
          <p className="font-semibold">Nutrition</p>
          <p className="text-xs text-gray-500">Track your meals</p>
        </button>
      </motion.div>

      {/* Nutrition Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-4 bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]"
      >
        <h3 className="font-semibold mb-3">Today's Nutrition Target</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Calories', value: profile?.target_calories || 2000, color: '#00F2FF' },
            { label: 'Protein', value: `${profile?.protein_goal || 150}g`, color: '#CCFF00' },
            { label: 'Carbs', value: `${profile?.carbs_goal || 200}g`, color: '#FF6B6B' },
            { label: 'Fat', value: `${profile?.fat_goal || 65}g`, color: '#FFD93D' }
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Workout Editor Sheet */}
      <WorkoutEditorSheet
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        workout={editingWorkout}
        onSave={handleSaveWorkout}
      />
    </div>
  );
}