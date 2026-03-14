import React, { useEffect, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  Dumbbell,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function WorkoutHistoryCalendar() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daySummaries, setDaySummaries] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const loadMonth = async (dateValue = currentMonth) => {
    setIsMonthLoading(true);
    try {
      const res = await api.get('/workouts/calendar', {
        params: { month: format(dateValue, 'yyyy-MM') },
      });
      const nextMap = {};
      (Array.isArray(res?.data?.days) ? res.data.days : []).forEach((day) => {
        nextMap[String(day?.date || '')] = day;
      });
      setDaySummaries(nextMap);
    } catch (error) {
      console.error('Failed to load workout history calendar:', error?.response?.data || error?.message || error);
      setDaySummaries({});
    } finally {
      setIsMonthLoading(false);
    }
  };

  const loadDay = async (dateValue) => {
    setIsDayLoading(true);
    try {
      const res = await api.get(`/workouts/calendar/date/${format(dateValue, 'yyyy-MM-dd')}`);
      setSelectedSessions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load workout sessions for day:', error?.response?.data || error?.message || error);
      setSelectedSessions([]);
    } finally {
      setIsDayLoading(false);
    }
  };

  useEffect(() => {
    loadMonth(currentMonth);
  }, [currentMonth]);

  const openDay = async (day) => {
    setSelectedDate(day);
    setIsDayDialogOpen(true);
    await loadDay(day);
  };

  const getDaySummary = (dateValue) => daySummaries[format(dateValue, 'yyyy-MM-dd')] || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#00F2FF]" />
          <div>
            <h2 className="font-bold text-lg">{t('workouts.historyCalendarTitle', 'Completed Workout Calendar')}</h2>
            <p className="text-sm text-gray-500">{t('workouts.historyCalendarSubtitle', 'Track the workouts you actually finished.')}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-4">
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

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-xs text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const summary = getDaySummary(day);
            const activeMonth = isSameMonth(day, currentMonth);
            const selected = isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => openDay(day)}
                className={`min-h-[84px] rounded-lg p-2 text-left transition-all ${
                  !activeMonth ? 'opacity-30' : ''
                } ${
                  selected ? 'bg-[#00F2FF]/15 ring-1 ring-[#00F2FF]' : 'hover:bg-[#2A2A2A]'
                } ${isToday(day) ? 'ring-1 ring-[#CCFF00]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isToday(day) ? 'text-[#CCFF00] font-bold' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {summary?.session_count ? (
                    <span className="rounded-full bg-[#CCFF00]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#CCFF00]">
                      {summary.session_count}
                    </span>
                  ) : null}
                </div>

                {summary ? (
                  <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3 text-[#00F2FF]" />
                      <span>{Math.round(summary.total_duration_minutes)} {t('common.minutes', 'minutes')}</span>
                    </div>
                    <div>{`${summary.total_sets_completed} ${t('common.sets', 'sets')}`}</div>
                  </div>
                ) : (
                  <div className="mt-4 text-[11px] text-gray-600">
                    {isMonthLoading ? t('common.loading', 'Loading...') : t('workouts.noCompletedShort', 'No done')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border border-[#2A2A2A] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>

          {isDayLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading', 'Loading...')}</p>
          ) : selectedSessions.length === 0 ? (
            <p className="text-sm text-gray-400">{t('workouts.noCompletedForDay', 'No completed workouts for this day.')}</p>
          ) : (
            <div className="space-y-3">
              {selectedSessions.map((session) => (
                <div key={String(session?._id || session?.id || Math.random())} className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-white">{session?.muscle_group || t('workouts.title', 'Workout')}</h4>
                      <p className="text-xs text-gray-500">
                        {session?.completed_at ? format(new Date(session.completed_at), 'HH:mm') : ''}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                      <Check className="w-3 h-3" />
                      {t('workouts.statusCompleted', 'Done')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="rounded-lg bg-[#1A1A1A] p-3 text-center">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{t('common.minutes', 'minutes')}</p>
                      <p className="mt-1 font-semibold text-[#00F2FF]">{Math.round(Number(session?.duration_minutes) || 0)}</p>
                    </div>
                    <div className="rounded-lg bg-[#1A1A1A] p-3 text-center">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{t('common.sets', 'sets')}</p>
                      <p className="mt-1 font-semibold text-[#CCFF00]">{Math.round(Number(session?.total_sets_completed) || 0)}</p>
                    </div>
                    <div className="rounded-lg bg-[#1A1A1A] p-3 text-center">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">XP</p>
                      <p className="mt-1 font-semibold text-[#FF6B6B]">{Math.round(Number(session?.xp_earned) || 0)}</p>
                    </div>
                  </div>

                  {Array.isArray(session?.completed_exercises) && session.completed_exercises.length ? (
                    <div className="mt-3 rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <Dumbbell className="h-3.5 w-3.5" />
                        <span>{t('workouts.completedExercises', 'Completed Exercises')}</span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-400">
                        {session.completed_exercises.map((exercise, index) => (
                          <p key={`${exercise?.exercise_id || 'exercise'}-${index}`}>
                            {exercise?.exercise_name || exercise?.exercise_id || t('session.exercise', 'Exercise')}: {Math.round(Number(exercise?.sets_completed) || 0)} {t('common.sets', 'sets')}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
