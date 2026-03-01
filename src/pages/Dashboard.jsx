import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Play, CheckCircle, Flame, Clock, Layers } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import ExercisePreviewCard from '@/components/dashboard/ExercisePreviewCard';
import ProgressRing from '@/components/dashboard/ProgressRing';
import WorkoutPlanTabs from '@/components/dashboard/WorkoutPlanTabs';
import WorkoutEditorSheet from '@/components/dashboard/WorkoutEditorSheet';
import WorkoutReelsPreview from '@/components/workouts/WorkoutReelsPreview';

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

        let needsPlan = !profileData.has_existing_plan;

        if (needsPlan) {
          const genRes = await fetch('http://localhost:5001/api/workouts/generate', {
            method: 'POST',
            headers
          });
          if (genRes.ok) {
            profileData.has_existing_plan = true;
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);

        const fetchUrl = `http://localhost:5001/api/workouts?startDate=${today.toISOString()}&endDate=${endOfWeek.toISOString()}`;
        const workRes = await fetch(fetchUrl, { headers });

        if (!workRes.ok) throw new Error('Failed to fetch workouts');

        const fetchedWorkouts = await workRes.json();

        if (Array.isArray(fetchedWorkouts) && fetchedWorkouts.length > 0) {
          const todayStr = format(today, 'yyyy-MM-dd');
          const todaysWorkout = fetchedWorkouts.find(w => format(new Date(w.date), 'yyyy-MM-dd') === todayStr);

          if (todaysWorkout) {
            setTodayWorkout(todaysWorkout);
          } else {
            setTodayWorkout({
              id: 'rest_day',
              muscle_group: t('common.restDay', 'Rest / Active Recovery'),
              exercises: [],
              status: 'planned'
            });
          }

          const plans = fetchedWorkouts.slice(0, 5).map((w, i) => ({
            id: w._id || `plan_${i}`,
            name: w.muscle_group,
            rawItem: w
          }));

          const uniquePlans = Array.from(new Map(plans.map(item => [item.name, item])).values());
          setWorkoutPlans(uniquePlans);
          setActivePlanId(uniquePlans.find(p => todaysWorkout && p.name === todaysWorkout.muscle_group)?.id || uniquePlans[0]?.id);

          localStorage.setItem('nexus_live_workouts', JSON.stringify(fetchedWorkouts));
        } else {
          setTodayWorkout({
            id: 'error_fallback',
            muscle_group: t('dashboard.noWorkoutsFound', 'No Workouts Found'),
            exercises: [],
            status: 'planned'
          });
          setWorkoutPlans([{ id: 'fb', name: t('dashboard.noWorkoutsFound', 'No Workouts') }]);
        }
      } catch (err) {
        console.error('Failed to initialize workout data:', err);
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

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const saved = localStorage.getItem(`nexus_completed_sets_${todayStr}`);
    if (saved) setCompletedSets(JSON.parse(saved));
  }, [user, isLoadingAuth, navigate]);

  const handleStartWorkout = () => {
    if (todayWorkout?.exercises?.length > 0) {
      setWorkoutStarted(true);
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

  const handleOpenEditor = (plan) => {
    const saved = localStorage.getItem('nexus_live_workouts');
    let workouts = saved ? JSON.parse(saved) : [];
    let workoutForPlan = workouts.find(w => w.muscle_group === plan.name);
    if (!workoutForPlan) workoutForPlan = { ...todayWorkout, muscle_group: plan.name, id: `workout_${plan.id}` };
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
        const saved = JSON.parse(localStorage.getItem('nexus_live_workouts') || '[]');
        localStorage.setItem('nexus_live_workouts', JSON.stringify(saved.map(w => w._id === updatedWorkout._id ? updatedWorkout : w)));
      } catch (e) {
        console.error('Failed workout update', e);
      }
    }
  };

  const handleSelectPlan = (planId) => {
    setActivePlanId(planId);
    const plan = workoutPlans.find(p => p.id === planId);
    if (plan?.rawItem) {
      setTodayWorkout(plan.rawItem);
    } else if (plan) {
      const saved = localStorage.getItem('nexus_live_workouts');
      const workouts = saved ? JSON.parse(saved) : [];
      const found = workouts.find(w => w.muscle_group === plan.name);
      if (found) setTodayWorkout(found);
    }
  };

  const totalSets = todayWorkout?.exercises?.reduce((acc, ex) => acc + ex.sets, 0) || 0;
  const completedSetsTotal = Object.values(completedSets).reduce((acc, n) => acc + n, 0);
  const progress = totalSets > 0 ? Math.round((completedSetsTotal / totalSets) * 100) : 0;

  // Estimated workout duration in minutes
  const estimatedDuration = todayWorkout?.exercises?.length > 0
    ? Math.round(todayWorkout.exercises.reduce((acc, ex) => acc + ex.sets * (45 + (ex.rest_seconds || 90)), 0) / 60)
    : 0;

  if (!profile || !todayWorkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 pt-6 pb-28">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <p className="text-gray-500 text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="text-2xl font-black text-white mt-0.5">
          {t('dashboard.greeting', 'Ready to train,')} <span className="text-[#00F2FF]">{user?.name?.split(' ')[0] || 'Champ'}</span> 💪
        </h1>
      </motion.div>

      {/* ── Week Day Tabs ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-5"
      >
        <WorkoutPlanTabs
          plans={workoutPlans}
          activePlan={activePlanId}
          onSelect={handleSelectPlan}
          onOpenEditor={handleOpenEditor}
        />
      </motion.div>

      {/* ── Today's Workout Hero Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 28 }}
        className="relative overflow-hidden rounded-3xl mb-5"
        style={{
          background: 'linear-gradient(135deg, #001820 0%, #001008 50%, #080808 100%)',
          border: '1px solid rgba(0,242,255,0.18)'
        }}
      >
        {/* Glow blobs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#00F2FF]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#CCFF00]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6">
          {/* Top row: muscle group + progress ring */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[#00F2FF] text-xs font-semibold uppercase tracking-widest mb-1">
                {t('dashboard.todaysFocus', "Today's Focus")}
              </p>
              <h2 className="text-3xl font-black text-white leading-tight truncate">
                {todayWorkout.muscle_group}
              </h2>

              {/* Stats pills */}
              <div className="flex items-center gap-3 mt-3">
                {todayWorkout.exercises.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 rounded-full px-3 py-1">
                      <Layers className="w-3 h-3 text-[#00F2FF]" />
                      <span><span className="text-white font-semibold">{todayWorkout.exercises.length}</span> exercises</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 rounded-full px-3 py-1">
                      <Clock className="w-3 h-3 text-[#CCFF00]" />
                      <span>~<span className="text-white font-semibold">{estimatedDuration}</span> min</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 rounded-full px-3 py-1">
                      <Flame className="w-3 h-3 text-orange-400" />
                      <span><span className="text-white font-semibold">{totalSets}</span> sets</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Progress ring */}
            <ProgressRing progress={progress} size={84} strokeWidth={7}>
              <div className="text-center">
                <span className="text-xl font-black text-white">{progress}%</span>
              </div>
            </ProgressRing>
          </div>

          {/* Progress text */}
          {totalSets > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              {completedSetsTotal} {t('common.of', 'of')} {totalSets} {t('common.sets', 'sets')} {t('dashboard.completed', 'completed')}
            </p>
          )}

          {/* Action button */}
          {todayWorkout.exercises.length > 0 ? (
            progress === 100 ? (
              <div className="flex items-center gap-2.5 py-3.5 px-5 bg-[#CCFF00]/10 rounded-2xl border border-[#CCFF00]/25">
                <CheckCircle className="w-5 h-5 text-[#CCFF00]" />
                <span className="text-[#CCFF00] font-bold">{t('dashboard.workoutComplete', 'Workout Complete!')}</span>
              </div>
            ) : (
              <Button
                onClick={handleStartWorkout}
                className="w-full h-13 gradient-cyan text-black font-black text-base rounded-2xl shadow-lg shadow-[#00F2FF]/20 hover:shadow-[#00F2FF]/30 transition-shadow"
              >
                <Play className="w-5 h-5 mr-2 fill-black" />
                {workoutStarted
                  ? t('dashboard.continueWorkout', 'Continue Workout')
                  : t('dashboard.startWorkout', 'Start Workout')}
              </Button>
            )
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">
              {t('dashboard.restDay', '🧘 Rest Day — Recover & Recharge')}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Exercise List ── */}
      {todayWorkout.exercises.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            {t('dashboard.exercises', 'Exercises')}
          </p>
          <div className="space-y-2.5">
            {todayWorkout.exercises.map((exercise, index) => (
              <ExercisePreviewCard
                key={exercise.id || index}
                exercise={exercise}
                index={index}
                onClick={handleExerciseClick}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Nutrition Quick Stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 bg-[#111] rounded-2xl p-4 border border-[#1E1E1E]"
      >
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          {t('dashboard.todaysNutrition', "Today's Nutrition")}
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t('common.calories', 'Cal'), value: profile?.target_calories || 2000, color: '#00F2FF' },
            { label: t('common.protein', 'Pro'), value: `${profile?.protein_goal || 150}g`, color: '#CCFF00' },
            { label: t('common.carbs', 'Carbs'), value: `${profile?.carbs_goal || 200}g`, color: '#FF6B6B' },
            { label: t('common.fat', 'Fat'), value: `${profile?.fat_goal || 65}g`, color: '#FFD93D' }
          ].map(stat => (
            <div key={stat.label} className="text-center py-2 rounded-xl bg-white/3">
              <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Workout Editor Sheet ── */}
      <WorkoutEditorSheet
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        workout={editingWorkout}
        onSave={handleSaveWorkout}
      />

      {/* ── Video Reels Preview ── */}
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
