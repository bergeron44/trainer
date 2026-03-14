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
  Flame,
  Pencil,
  Save,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const INITIAL_EDIT_STATE = {
  id: '',
  meal_name: '',
  meal_period_label: '',
  date: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

const toInputValue = (value) => String(Number(value) || 0);

export default function NutritionCalendar({ onDataChanged }) {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daySummaries, setDaySummaries] = useState({});
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayEntries, setDayEntries] = useState([]);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState('');
  const [editDraft, setEditDraft] = useState(INITIAL_EDIT_STATE);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const loadMonth = async (dateValue = currentMonth) => {
    setIsMonthLoading(true);
    try {
      const res = await api.get('/nutrition/calendar', {
        params: { month: format(dateValue, 'yyyy-MM') },
      });
      const nextMap = {};
      (Array.isArray(res?.data?.days) ? res.data.days : []).forEach((day) => {
        nextMap[String(day?.date || '')] = day;
      });
      setDaySummaries(nextMap);
    } catch (error) {
      console.error('Failed to load nutrition calendar:', error?.response?.data || error?.message || error);
      setDaySummaries({});
    } finally {
      setIsMonthLoading(false);
    }
  };

  const loadDay = async (dateValue) => {
    setIsDayLoading(true);
    try {
      const res = await api.get(`/nutrition/date/${format(dateValue, 'yyyy-MM-dd')}`);
      setDayEntries(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load nutrition day:', error?.response?.data || error?.message || error);
      setDayEntries([]);
    } finally {
      setIsDayLoading(false);
    }
  };

  useEffect(() => {
    loadMonth(currentMonth);
  }, [currentMonth]);

  const handleOpenDay = async (day) => {
    setSelectedDate(day);
    setEditingEntryId('');
    setEditDraft(INITIAL_EDIT_STATE);
    setIsDayDialogOpen(true);
    await loadDay(day);
  };

  const startEdit = (entry) => {
    setEditingEntryId(String(entry?._id || ''));
    setEditDraft({
      id: String(entry?._id || ''),
      meal_name: String(entry?.meal_name || ''),
      meal_period_label: String(entry?.meal_period_label || ''),
      date: format(new Date(entry?.date || selectedDate), 'yyyy-MM-dd'),
      calories: toInputValue(entry?.calories),
      protein: toInputValue(entry?.protein),
      carbs: toInputValue(entry?.carbs),
      fat: toInputValue(entry?.fat),
    });
  };

  const stopEdit = () => {
    setEditingEntryId('');
    setEditDraft(INITIAL_EDIT_STATE);
  };

  const refreshAfterMutation = async (dateValue = selectedDate) => {
    await Promise.all([
      loadMonth(currentMonth),
      loadDay(dateValue),
    ]);
    if (onDataChanged) {
      await onDataChanged();
    }
  };

  const handleSaveEntry = async () => {
    if (!editingEntryId || !editDraft.meal_name.trim()) return;
    setIsSavingEntry(true);
    try {
      await api.put(`/nutrition/entry/${editingEntryId}`, {
        meal_name: editDraft.meal_name.trim(),
        meal_period_label: editDraft.meal_period_label.trim(),
        date: editDraft.date,
        calories: Number(editDraft.calories) || 0,
        protein: Number(editDraft.protein) || 0,
        carbs: Number(editDraft.carbs) || 0,
        fat: Number(editDraft.fat) || 0,
      });
      const nextSelectedDate = editDraft.date ? new Date(editDraft.date) : selectedDate;
      setSelectedDate(nextSelectedDate);
      stopEdit();
      await refreshAfterMutation(nextSelectedDate);
    } catch (error) {
      console.error('Failed to update nutrition entry:', error?.response?.data || error?.message || error);
      window.alert(t('nutrition.calendarSaveFailed', 'Failed to save meal changes. Please try again.'));
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    const confirmed = window.confirm(
      t('nutrition.calendarDeleteConfirm', 'Delete this meal from the calendar history?')
    );
    if (!confirmed) return;

    try {
      await api.delete(`/nutrition/entry/${entryId}`);
      if (editingEntryId === String(entryId)) {
        stopEdit();
      }
      await refreshAfterMutation(selectedDate);
    } catch (error) {
      console.error('Failed to delete nutrition entry:', error?.response?.data || error?.message || error);
      window.alert(t('nutrition.calendarDeleteFailed', 'Failed to delete meal. Please try again.'));
    }
  };

  const daySummaryForDate = (dateValue) => daySummaries[format(dateValue, 'yyyy-MM-dd')] || null;

  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00F2FF]/10 text-[#00F2FF]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{t('nutrition.calendarTitle', 'Nutrition Calendar')}</h3>
            <p className="text-xs text-gray-500">
              {t('nutrition.calendarSubtitle', 'Review and edit what you ate on any day.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[132px] text-center text-sm font-semibold text-white">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
          <div key={dayName} className="py-1 text-center text-xs text-gray-500">
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const summary = daySummaryForDate(day);
          const activeMonth = isSameMonth(day, currentMonth);
          const selected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleOpenDay(day)}
              className={`min-h-[84px] rounded-xl border p-2 text-left transition-colors ${
                selected
                  ? 'border-[#00F2FF] bg-[#00F2FF]/10'
                  : 'border-[#2A2A2A] bg-[#101010] hover:border-[#00F2FF]/40'
              } ${activeMonth ? '' : 'opacity-35'}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-sm ${isToday(day) ? 'font-bold text-[#CCFF00]' : 'text-white'}`}>
                  {format(day, 'd')}
                </span>
                {summary?.meal_count ? (
                  <span className="rounded-full bg-[#CCFF00]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#CCFF00]">
                    {summary.meal_count}
                  </span>
                ) : null}
              </div>

              {summary ? (
                <div className="space-y-1 text-[11px] text-gray-400">
                  <div className="flex items-center gap-1 text-[#00F2FF]">
                    <Flame className="h-3 w-3" />
                    <span>{Math.round(summary.total_calories)} kcal</span>
                  </div>
                  <div>{`P ${Math.round(summary.total_protein)} | C ${Math.round(summary.total_carbs)} | F ${Math.round(summary.total_fat)}`}</div>
                </div>
              ) : (
                <div className="pt-3 text-[11px] text-gray-600">
                  {isMonthLoading ? t('common.loading', 'Loading...') : t('nutrition.noMealsShort', 'No meals')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
        <DialogContent className="max-w-2xl border border-[#2A2A2A] bg-[#0A0A0A] text-white">
          <DialogHeader>
            <DialogTitle>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>

          {isDayLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading', 'Loading...')}</p>
          ) : dayEntries.length === 0 ? (
            <p className="text-sm text-gray-400">{t('nutrition.noMealsForDay', 'No meals saved for this day yet.')}</p>
          ) : (
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {dayEntries.map((entry) => {
                const isEditing = editingEntryId === String(entry?._id || '');

                return (
                  <div key={String(entry?._id || Math.random())} className="rounded-xl border border-[#2A2A2A] bg-[#111] p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={editDraft.meal_name}
                            onChange={(event) => setEditDraft((prev) => ({ ...prev, meal_name: event.target.value }))}
                            placeholder={t('nutrition.mealName', 'Meal name')}
                            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00F2FF]"
                          />
                          <input
                            value={editDraft.meal_period_label}
                            onChange={(event) => setEditDraft((prev) => ({ ...prev, meal_period_label: event.target.value }))}
                            placeholder={t('nutrition.mealSlot', 'Meal slot')}
                            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00F2FF]"
                          />
                          <input
                            type="date"
                            value={editDraft.date}
                            onChange={(event) => setEditDraft((prev) => ({ ...prev, date: event.target.value }))}
                            className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00F2FF]"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                          {[
                            ['calories', t('common.calories', 'Calories')],
                            ['protein', t('common.protein', 'Protein')],
                            ['carbs', t('common.carbs', 'Carbs')],
                            ['fat', t('common.fat', 'Fat')],
                          ].map(([key, label]) => (
                            <label key={key} className="text-xs text-gray-400">
                              <span className="mb-1 block">{label}</span>
                              <input
                                type="number"
                                min="0"
                                value={editDraft[key]}
                                onChange={(event) => setEditDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                                className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00F2FF]"
                              />
                            </label>
                          ))}
                        </div>

                        {Array.isArray(entry?.foods) && entry.foods.length ? (
                          <div className="rounded-lg border border-[#1F1F1F] bg-[#0C0C0C] p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {t('nutrition.ingredients', 'Ingredients')}
                            </p>
                            <div className="space-y-1 text-xs text-gray-400">
                              {entry.foods.map((food, index) => (
                                <p key={`${food?.name || 'food'}-${index}`}>
                                  {food?.portion ? `${food.portion} ` : ''}{food?.name || ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex gap-2">
                          <button
                            onClick={stopEdit}
                            className="flex-1 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-[#1A1A1A]"
                          >
                            <X className="mr-2 inline h-4 w-4" />
                            {t('common.cancel', 'Cancel')}
                          </button>
                          <button
                            onClick={handleSaveEntry}
                            disabled={isSavingEntry}
                            className="flex-1 rounded-lg bg-gradient-to-r from-[#00F2FF] to-[#CCFF00] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            <Save className="mr-2 inline h-4 w-4" />
                            {t('common.save', 'Save')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-white">{entry?.meal_name || t('nutrition.mealSuggestion', 'Meal suggestion')}</h4>
                            <p className="text-xs text-gray-500">
                              {entry?.meal_period_label || format(new Date(entry?.date || selectedDate), 'HH:mm')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(entry)}
                              className="rounded-lg border border-[#2A2A2A] p-2 text-gray-400 transition-colors hover:border-[#00F2FF]/40 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry?._id)}
                              className="rounded-lg border border-[#2A2A2A] p-2 text-gray-400 transition-colors hover:border-red-400/40 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-4">
                          {[
                            [t('common.calories', 'Calories'), `${Math.round(Number(entry?.calories) || 0)} kcal`],
                            [t('common.protein', 'Protein'), `${Math.round(Number(entry?.protein) || 0)} g`],
                            [t('common.carbs', 'Carbs'), `${Math.round(Number(entry?.carbs) || 0)} g`],
                            [t('common.fat', 'Fat'), `${Math.round(Number(entry?.fat) || 0)} g`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-[#181818] px-3 py-2 text-center">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                              <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                            </div>
                          ))}
                        </div>

                        {Array.isArray(entry?.foods) && entry.foods.length ? (
                          <div className="mt-3 rounded-lg border border-[#1F1F1F] bg-[#0C0C0C] p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <Utensils className="h-3.5 w-3.5" />
                              <span>{t('nutrition.ingredients', 'Ingredients')}</span>
                            </div>
                            <div className="space-y-1 text-xs text-gray-400">
                              {entry.foods.map((food, index) => (
                                <p key={`${food?.name || 'food'}-${index}`}>
                                  {food?.portion ? `${food.portion} ` : ''}{food?.name || ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
