import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Play, CheckCircle, Calendar, Dumbbell } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import ExercisePreviewCard from '@/components/dashboard/ExercisePreviewCard';
import ProgressRing from '@/components/dashboard/ProgressRing';
import WorkoutPlanTabs from '@/components/dashboard/WorkoutPlanTabs';
import WorkoutEditorSheet from '@/components/dashboard/WorkoutEditorSheet';
import WorkoutReelsPreview from '@/components/workouts/WorkoutReelsPreview';

// Local generation logic removed - now handled by backend 12-week AI AI Generator

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [completedSets, setCompletedSets] = useState({});
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [showReels, setShowReels] = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);

  // Load profile and fetch authentic DB workouts
  useEffect(() => {
    if (isLoadingAuth) return;

    const profileData = user?.profile;

    if (!profileData || !profileData.goal || !profileData.tdee) {
      navigate(createPageUrl('Onboarding'));
      return;
    }

    setProfile(profileData);

    const initWorkouts = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // 1. Check if user needs the 12-week generative plan built
        let needsPlan = !profileData.has_existing_plan;

        if (needsPlan) {
          const genRes = await fetch('http://localhost:5001/api/workouts/generate', {
            method: 'POST',
            headers
          });

          if (genRes.ok) {
            console.log('Successfully generated 12-week DB plan');
            // Optimistically update local profile flag
            profileData.has_existing_plan = true;
          }
        }

        // 2. Fetch the newly built (or existing) workouts for this week
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Grab the next 7 days of workouts as our "live" cache for the dashboard
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);

        const fetchUrl = `http://localhost:5001/api/workouts?startDate=${today.toISOString()}&endDate=${endOfWeek.toISOString()}`;
        const workRes = await fetch(fetchUrl, { headers });

        if (!workRes.ok) {
          throw new Error('Failed to fetch workouts');
        }

        const fetchedWorkouts = await workRes.json();

        if (Array.isArray(fetchedWorkouts) && fetchedWorkouts.length > 0) {
          // Normalize formatting to YYYY-MM-DD for matching
          const todayStr = format(today, 'yyyy-MM-dd');

          // Find the specific workout scheduled exactly for today
          const todaysWorkout = fetchedWorkouts.find(w => format(new Date(w.date), 'yyyy-MM-dd') === todayStr);

          if (todaysWorkout) {
            setTodayWorkout(todaysWorkout);
          } else {
            // If there's no workout today (rest day), create a null-state representation or pick the next closest
            setTodayWorkout({
              id: 'rest_day',
              muscle_group: t('common.restDay', 'Rest / Active Recovery'),
              exercises: [],
              status: 'planned'
            });
          }

          // Build dynamic tabs based on the upcoming week's routine
          const plans = fetchedWorkouts.slice(0, 5).map((w, i) => ({
            id: w._id || `plan_${i}`,
            name: w.muscle_group,
            rawItem: w
          }));

          // Ensure unique tabs (no repeating "Rest Day" tabs etc)
          const uniquePlans = Array.from(new Map(plans.map(item => [item.name, item])).values());

          setWorkoutPlans(uniquePlans);
          setActivePlanId(uniquePlans.find(p => todaysWorkout && p.name === todaysWorkout.muscle_group)?.id || uniquePlans[0]?.id);

          // Cache the full incoming list locally for quick editor matching
          localStorage.setItem('nexus_live_workouts', JSON.stringify(fetchedWorkouts));
        } else {
          // Fallback to prevent infinite loader
          setTodayWorkout({
            id: 'error_fallback',
            muscle_group: t('dashboard.noWorkoutsFound', 'No Workouts Found'),
            exercises: [],
            status: 'planned'
          });
          setWorkoutPlans([{ id: 'fb', name: t('dashboard.noWorkoutsFound', 'No Workouts') }]);
        }

      } catch (err) {
        console.error("Failed to initialize workout data via API:", err);
        setTodayWorkout({
          id: 'error_fallback',
          muscle_group: t('dashboard.failedToLoad', 'Failed to Load'),
          exercises: [],
          status: 'planned'
        });
        setWorkoutPlans([{ id: 'fb', name: t('common.error', 'Error') }]);
      }
    };

    initWorkouts();

    // Load completed sets
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const savedCompletedSets = localStorage.getItem(`nexus_completed_sets_${todayStr}`);
    if (savedCompletedSets) {
      setCompletedSets(JSON.parse(savedCompletedSets));
    }
  }, [user, isLoadingAuth, navigate]);

  const handleStartWorkout = () => {
    if (todayWorkout?.exercises?.length > 0) {
      setReelsStartIndex(0);
      setShowReels(true);
    } else {
      navigate(createPageUrl('LiveSession'));
    }
  };

  const handleExerciseClick = (exerciseIndex) => {
    if (todayWorkout?.exercises?.length > 0) {
      setReelsStartIndex(exerciseIndex);
      setShowReels(true);
    }
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

  const handleReorderExercises = async (newOrder) => {
    setTodayWorkout(prev => ({ ...prev, exercises: newOrder }));

    // Attempt real update to DB
    if (todayWorkout && todayWorkout._id) {
      try {
        await fetch(`http://localhost:5001/api/workouts/${todayWorkout._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ exercises: newOrder })
        });
      } catch (e) {
        console.error("Failed reorder update", e);
      }
    }
  };

  const handleReplaceExercise = async (exerciseId, newExercise) => {
    const newExercises = todayWorkout.exercises.map(ex =>
      ex.id === exerciseId ? newExercise : ex
    );
    setTodayWorkout(prev => ({ ...prev, exercises: newExercises }));

    if (todayWorkout && todayWorkout._id) {
      try {
        await fetch(`http://localhost:5001/api/workouts/${todayWorkout._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ exercises: newExercises })
        });
      } catch (e) {
        console.error("Failed replacing exercise", e);
      }
    }
  };

  const handleOpenEditor = (plan) => {
    const savedWorkouts = localStorage.getItem('nexus_live_workouts');
    let workouts = savedWorkouts ? JSON.parse(savedWorkouts) : [];
    let workoutForPlan = workouts.find(w => w.muscle_group === plan.name);

    if (!workoutForPlan) {
      workoutForPlan = { ...todayWorkout, muscle_group: plan.name, id: `workout_${plan.id}` };
    }
    setEditingWorkout(workoutForPlan);
    setEditorOpen(true);
  };

  const handleSaveWorkout = async (updatedWorkout) => {
    if (todayWorkout?.id === updatedWorkout.id || todayWorkout?._id === updatedWorkout._id) {
      setTodayWorkout(updatedWorkout);
    }

    if (updatedWorkout._id) {
      try {
        await fetch(`http://localhost:5001/api/workouts/${updatedWorkout._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ exercises: updatedWorkout.exercises, notes: updatedWorkout.notes })
        });

        // Force update local cache
        const savedWorkouts = JSON.parse(localStorage.getItem('nexus_live_workouts') || '[]');
        const updatedList = savedWorkouts.map(w => w._id === updatedWorkout._id ? updatedWorkout : w);
        localStorage.setItem('nexus_live_workouts', JSON.stringify(updatedList));

      } catch (e) {
        console.error("Failed workout update on editor save", e);
      }
    }
  };

  const handleSelectPlan = (planId) => {
    setActivePlanId(planId);
    const plan = workoutPlans.find(p => p.id === planId);
    if (plan && plan.rawItem) {
      setTodayWorkout(plan.rawItem);
    } else if (plan) {
      const savedWorkouts = localStorage.getItem('nexus_live_workouts');
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
          {t('dashboard.todaysFocus', "Today's Focus:")} <span className="text-[#00F2FF]">{todayWorkout?.muscle_group || t('common.restDay', 'Rest Day')}</span>
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
            <h2 className="text-lg font-semibold mb-1">{t('dashboard.workoutProgress', 'Workout Progress')}</h2>
            <p className="text-gray-500 text-sm">
              {t('dashboard.setsCompleted', '{{completed}} of {{total}} sets completed', { completed: completedSetsTotal, total: totalSets })}
            </p>

            {!workoutStarted ? (
              <Button
                onClick={handleStartWorkout}
                className="mt-4 gradient-cyan text-black font-semibold px-6"
              >
                <Play className="w-4 h-4 mr-2" />
                {t('dashboard.startWorkout', 'Start Workout')}
              </Button>
            ) : progress === 100 ? (
              <div className="mt-4 flex items-center gap-2 text-[#CCFF00]">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">{t('dashboard.workoutComplete', 'Workout Complete!')}</span>
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

      {/* Exercises — Preview Cards */}
      {todayWorkout?.exercises?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          {todayWorkout.exercises.map((exercise, index) => (
            <ExercisePreviewCard
              key={exercise.id || index}
              exercise={exercise}
              index={index}
              onClick={handleExerciseClick}
            />
          ))}
        </motion.div>
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
          <p className="font-semibold">{t('dashboard.calendar', 'Calendar')}</p>
          <p className="text-xs text-gray-500">{t('dashboard.viewSchedule', 'View full schedule')}</p>
        </button>
        <button
          onClick={() => navigate(createPageUrl('NutritionDemo'))}
          className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors text-left"
        >
          <Dumbbell className="w-6 h-6 text-[#CCFF00] mb-2" />
          <p className="font-semibold">{t('navigation.nutrition', 'Nutrition')}</p>
          <p className="text-xs text-gray-500">{t('dashboard.trackMeals', 'Track your meals')}</p>
        </button>
      </motion.div>

      {/* Nutrition Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-4 bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]"
      >
        <h3 className="font-semibold mb-3">{t('dashboard.todaysNutrition', "Today's Nutrition Target")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: t('common.calories', 'Calories'), value: profile?.target_calories || 2000, color: '#00F2FF' },
            { label: t('common.protein', 'Protein'), value: `${profile?.protein_goal || 150}g`, color: '#CCFF00' },
            { label: t('common.carbs', 'Carbs'), value: `${profile?.carbs_goal || 200}g`, color: '#FF6B6B' },
            { label: t('common.fat', 'Fat'), value: `${profile?.fat_goal || 65}g`, color: '#FFD93D' }
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

      {/* Workout Preview Reels — opens before session starts */}
      <AnimatePresence>
        {showReels && (
          <WorkoutReelsPreview
            exercises={todayWorkout.exercises}
            startIndex={reelsStartIndex}
            onClose={() => setShowReels(false)}
            onStart={() => {
              const workoutId = todayWorkout._id || todayWorkout.id;
              setShowReels(false);
              navigate(`/WorkoutSession?id=${workoutId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}