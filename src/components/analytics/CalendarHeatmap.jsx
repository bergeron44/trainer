import React from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths } from 'date-fns';

export default function CalendarHeatmap({ workoutDates = [] }) {
  const today = new Date();
  const startDate = startOfMonth(subMonths(today, 2));
  const endDate = endOfMonth(today);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getIntensity = (date) => {
    const workout = workoutDates.find(w => isSameDay(new Date(w.date), date));
    if (!workout) return 0;
    if (workout.completed) return 2;
    return 1;
  };

  const intensityColors = {
    0: 'bg-[#1A1A1A]',
    1: 'bg-[#00F2FF]/30',
    2: 'bg-[#CCFF00]'
  };

  const weeks = [];
  let currentWeek = [];
  
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]">
      <h3 className="font-semibold mb-1">Consistency</h3>
      <p className="text-xs text-gray-500 mb-4">Last 3 months</p>
      
      <div className="flex gap-1 justify-center flex-wrap">
        {days.map((day, index) => (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.005 }}
            className={`w-4 h-4 rounded-sm ${intensityColors[getIntensity(day)]}`}
            title={format(day, 'MMM d, yyyy')}
          />
        ))}
 