import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Download, Clock, Dumbbell, Check
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth,
  isSameDay, isToday
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock generation logic removed, now purely relies on DB Workouts.

const generateICS = (workouts, preferredTime) => {
  const [hours, minutes] = preferredTime.split(':').map(Number);

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nexus AI//Training Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

  workouts.forEach(workout => {
    const [year, month, day] = workout.date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes);
    const endDate = new Date(startDate.getTime() + (workout.duration_minutes || 60) * 60000);

    const formatICSDate = (d) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const exerciseList = workout.exercises
      ?.map(e => `• ${e.name}: ${e.sets}x${e.reps}`)
      .join('\\n') || '';

    icsContent += `BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:🏋️ ${workout.muscle_group} Workout
DESCRIPTION:Nexus AI Training Plan\\n\\n${exerciseList}
LOCATION:Gym
STATUS:CONFIRMED
UID:${workout.id}@nexusai
END:VEVENT
`;
  });

  icsContent += 'END:VCALENDAR';
  return icsContent;
};

const downloadICS = (content, filename) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function TrainingCalendar({ workouts: propWorkouts }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [exportSuccess, setExportSuccess] = useState(false);

  const [workouts, setWorkoutsState] = useState(propWorkouts || []);

  // Keep workouts in sync if parent API data arrives later
  React.useEffect(() => {
    if (propWorkouts) {
      setWorkoutsState(propWorkouts);
    }
  }, [propWorkouts]);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getWorkoutForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return workouts.find(w => {
      try {
        return format(new Date(w.date), 'yyyy-MM-dd') === dateStr;
      } catch (e) {
        return w.date === dateStr;
      }
    });
  };

  const selectedWorkout = selectedDate ? getWorkoutForDate(selectedDate) : null;

  const handleDayClick = (day) => {
    setSelectedDate(day);
    const workout = getWorkoutForDate(day);
    if (workout) {
      setShowWorkoutModal(true);
    }
  };

  const handleExport = () => {
    // Save preference
    localStorage.setItem('nexus_preferred_workout_time', preferredTime);

    const icsContent = generateICS(workouts, preferredTime);
    downloadICS(icsContent, `nexus-training-plan-${format(new Date(), 'yyyy-MM')}.ics`);

    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      setShowExportModal(false);
    }, 2000);
  };

  // Load saved preference
  React.useEffect(() => {
    const saved = localStorage.getItem('nexus_preferred_workout_time');
    if (saved) setPreferredTime(saved);
  }, []);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-[#00F2FF]" />
          <h2 className="font-bold text-lg">Training Calendar</h2>
        </div>
        <Button
          onClick={() => setShowExportModal(true)}
          variant="outline"
          size="sm"
          className="bg-transparent border-[#2A2A2A] text-white hover:bg-[#1A1A1A]"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Calendar
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-[#2A2A2A] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-[#2A2A2A] rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-xs text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const workout = getWorkoutForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <motion.button
                key={index}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square rounded-lg p-1 flex flex-col items-center justify-center
                  transition-all relative
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-[#00F2FF]/20 ring-2 ring-[#00F2FF]' : 'hover:bg-[#2A2A2A]'}
                  ${isToday(day) ? 'ring-1 ring-[#CCFF00]' : ''}
                `}
              >
                <span className={`text-sm ${isToday(day) ? 'text-[#CCFF00] font-bold' : ''}`}>
                  {format(day, 'd')}
                </span>
                {workout && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${workout.status === 'completed' ? 'bg-[#CCFF00]' : 'bg-[#00F2FF]'
                    }`} />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#2A2A2A]">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-[#00F2FF]" />
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-[#CCFF00]" />
            <span>Completed</span>
          </div>
        </div>
      </div>

      {/* Workout Detail Modal - Phone style */}
      <Dialog open={showWorkoutModal} onOpenChange={setShowWorkoutModal}>
        <DialogContent className="bg-[#0A0A0A] border border-[#2A2A2A] text-white max-w-md max-h-[80vh] overflow-y-auto">
          {selectedWorkout ? (
            <>
              <DialogHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{selectedDate && format(selectedDate, 'EEEE, MMMM d')}</p>
                    <DialogTitle className="text-xl font-bold text-[#00F2FF]">
                      {selectedWorkout.muscle_group}
                    </DialogTitle>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${selectedWorkout.status === 'completed'
                    ? 'bg-[#CCFF00]/20 text-[#CCFF00]'
                    : 'bg-[#00F2FF]/20 text-[#00F2FF]'
                    }`}>
                    {selectedWorkout.status === 'completed' ? 'Done' : 'Planned'}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex items-center gap-4 py-3 border-b border-[#2A2A2A]">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{selectedWorkout.duration_minutes} min</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Dumbbell className="w-4 h-4" />
                  <span>{selectedWorkout.exercises?.length || 0} exercises</span>
                </div>
              </div>

              <div className="space-y-1 py-2">
                {selectedWorkout.exercises?.map((exercise, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-3 border-b border-[#1A1A1A] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-sm font-bold text-gray-500">
                        {i + 1}
                      </div>
                      <span className="font-medium">{exercise.name}</span>
                    </div>
                    <span className="text-sm text-[#00F2FF] font-medium">
                      {exercise.sets} × {exercise.reps}
                    </span>
                  </motion.div>
                ))}
              </div>

              <Button
                onClick={() => setShowWorkoutModal(false)}
                className="w-full h-12 mt-2 gradient-cyan text-black font-semibold"
              >
                Close
              </Button>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-500">Rest day - no workout scheduled</p>
              <Button
                onClick={() => setShowWorkoutModal(false)}
                variant="outline"
                className="mt-4 bg-transparent border-[#2A2A2A] text-white hover:bg-[#1A1A1A]"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="bg-[#0A0A0A] border border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Export to Calendar</DialogTitle>
          </DialogHeader>

          {exportSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[#CCFF00]/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-[#CCFF00]" />
              </div>
              <p className="text-lg font-semibold">Download Started!</p>
              <p className="text-gray-500 text-sm mt-1">Open the .ics file to add events to your calendar</p>
            </motion.div>
          ) : (
            <div className="space-y-6 mt-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Preferred workout time
                </label>
                <Select value={preferredTime} onValueChange={setPreferredTime}>
                  <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                    {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
                      '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                <p className="text-sm text-gray-400 mb-2">This will export:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00F2FF]" />
                    {workouts.length} planned workouts
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                    Full exercise details included
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleExport}
                className="w-full h-12 gradient-cyan text-black font-semibold"
              >
                <Download className="w-4 h-4 mr-2" />
                Download .ics File
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Works with Google Calendar, Apple Calendar, Outlook, and more
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}