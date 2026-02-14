import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Dumbbell, Target, Flame } from 'lucide-react';
import StrengthChart from '@/components/analytics/StrengthChart';
import CalendarHeatmap from '@/components/analytics/CalendarHeatmap';
import VolumeChart from '@/components/analytics/VolumeChart';

export default function Analytics() {
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    const savedProfile = localStorage.getItem('nexus_user_profile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }

    const savedWorkouts = localStorage.getItem('nexus_workouts');
    if (savedWorkouts) {
      setWorkouts(JSON.parse(savedWorkouts));
    }
  }, []);

  // Mock strength progression data
  const strengthData = [
    { date: 'W1', weight: 60 },
    { date: 'W2', weight: 62.5 },
    { date: 'W3', weight: 62.5 },
    { date: 'W4', weight: 65 },
    { date: 'W5', weight: 67.5 },
    { date: 'W6', weight: 70 },
  ];

  // Mock volume data
  const volumeData = [
    { week: 'W1', volume: 12500 },
    { week: 'W2', volume: 14200 },
    { week: 'W3', volume: 13800 },
    { week: 'W4', volume: 15600 },
    { week: 'W5', volume: 16100 },
    { week: 'W6', volume: 17200 },
  ];

  // Calendar data from workouts
  const workoutDates = workouts.map(w => ({
    date: w.date,
    completed: w.status === 'completed'
  }));

  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const totalVolume = 45000; // Mock total

  const stats = [
    { 
      label: 'Workouts This Week', 
      value: completedWorkouts.length || 3, 
      target: profile?.workout_days_per_week || 4,
      icon: Dumbbell, 
      color: '#00F2FF' 
    },
    { 
      label: 'Total Volume', 
      value: `${(totalVolume / 1000).toFixed(1)}k kg`, 
      icon: TrendingUp, 
      color: '#CCFF00' 
    },
    { 
      label: 'Consistency', 
      value: '87%', 
      icon: Target, 
      color: '#FF6B6B' 
    },
    { 
      label: 'Current Streak', 
      value: '3 days', 
      icon: Flame, 
      color: '#FFD93D' 
    }
  ];

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-500 text-sm">Track your progress over time</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-gray-500">
                {stat.label}
                {stat.target && <span className="text-gray-600"> / {stat.target}</span>}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StrengthChart data={strengthData} exercise="Bench Press" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <VolumeChart data={volumeData} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <CalendarHeatmap workoutDates={workoutDates} />
        </motion.div>
      </div>

      {/* Personal Records */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-6 bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]"
      >
        <h3 className="font-semibold mb-4">Personal Records</h3>
        <div className="space-y-3">
          {[
            { exercise: 'Bench Press', weight: '70 kg', date: 'Mar 15' },
            { exercise: 'Squat', weight: '90 kg', date: 'Mar 12' },
            { exercise: 'Deadlift', weight: '110 kg', date: 'Mar 8' },
            { exercise: 'Overhead Press', weight: '45 kg', date: 'Mar 14' }
          ].map((pr, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-[#2A2A2A] last:border-0">
              <div>
                <p className="font-medium">{pr.exercise}</p>
                <p className="text-xs text-gray-500">{pr.date}</p>
              </div>
              <span className="text-lg font-bold text-[#CCFF00]">{pr.weight}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Demo Notice */}
      <p className="text-xs text-gray-600 text-center mt-6">
        📊 Demo data shown. In the full version, charts reflect your actual progress.
      </p>
    </div>
  );
}