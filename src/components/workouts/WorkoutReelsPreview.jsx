import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Dumbbell, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
import { getExerciseVideoUrl } from '@/data/exerciseVideos';

export default function WorkoutReelsPreview({ exercises, onStart, onClose, startIndex = 0 }) {
  const { t } = useTranslation();
  // Map of { [exerciseName]: { video_url, gif_url, instructions, difficulty } | 'loading' | null }
  const [exerciseMap, setExerciseMap] = useState({});
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const slideRefs = useRef([]);
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const hasScrolledToStart = useRef(false);

  // Fetch full exercise data from our DB, with Cloudinary fallback
  const fetchExercise = useCallback(async (name) => {
    setExerciseMap(prev => ({ ...prev, [name]: 'loading' }));
    try {
      const { data } = await api.get(`/exercises/lookup?name=${encodeURIComponent(name)}`);
      // If DB has no video_url, inject the Cloudinary fallback
      if (data && !data.video_url) {
        data.video_url = getExerciseVideoUrl(name);
      }
      setExerciseMap(prev => ({ ...prev, [name]: data ?? { video_url: getExerciseVideoUrl(name) } }));
    } catch {
      // API failed entirely — still provide the Cloudinary video
      setExerciseMap(prev => ({ ...prev, [name]: { video_url: getExerciseVideoUrl(name) } }));
    }
  }, []);

  useEffect(() => {
    if (!exercises?.length) return;
    exercises.forEach(ex => fetchExercise(ex.name));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which slide is in view; play/pause videos accordingly
  useEffect(() => {
    if (!exercises?.length) return;
    const observers = slideRefs.current.map((slide, index) => {
      if (!slide) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setCurrentIndex(index);
            videoRefs.current[index]?.play().catch(() => { });
          } else {
            const v = videoRefs.current[index];
            if (v) { v.pause(); v.currentTime = 0; }
          }
        },
        { threshold: 0.5 },
      );
      obs.observe(slide);
      return obs;
    });
    return () => observers.forEach(obs => obs?.disconnect());
  }, [exercises?.length]);

  // Scroll to startIndex on mount
  useEffect(() => {
    if (hasScrolledToStart.current || !exercises?.length || startIndex === 0) return;
    const target = slideRefs.current[startIndex];
    if (target) {
      // Use instant scroll so user doesn't see the slide animation from 0→N
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
      hasScrolledToStart.current = true;
    }
  }, [startIndex, exercises?.length]);

  if (!exercises?.length) return null;

  const DIFFICULTY_COLOR = {
    beginner: '#22c55e',
    intermediate: '#f59e0b',
    advanced: '#ef4444',
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[100] bg-black"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
        className="absolute right-4 z-[110] w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/70 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Vertical progress indicator */}
      <div
        className="absolute right-4 z-[110] flex flex-col gap-1.5"
        style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)', marginTop: '56px' }}
      >
        {exercises.map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-300"
            style={{
              height: i === currentIndex ? '24px' : '8px',
              background: i === currentIndex ? '#00F2FF' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>

      {/* Scroll-snap container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {exercises.map((exercise, index) => {
          const exData = exerciseMap[exercise.name]; // 'loading' | null | object
          const isLoading = exData === 'loading';
          const videoUrl = exData?.video_url ?? null;
          const gifUrl = exData?.gif_url ?? null;
          const instructions = exData?.instructions ?? [];
          const difficulty = exData?.difficulty ?? '';
          const isLast = index === exercises.length - 1;

          // Preload strategy: current ±1 get "auto", rest get "none"
          const preload = Math.abs(index - currentIndex) <= 1 ? 'auto' : 'none';

          return (
            <div
              key={index}
              ref={el => { slideRefs.current[index] = el; }}
              className="relative w-full flex-shrink-0"
              style={{ height: '100dvh', scrollSnapAlign: 'start' }}
            >
              {/* Background media */}
              {isLoading ? (
                <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
                  <div className="w-16 h-16 border-2 border-[#00F2FF]/30 border-t-[#00F2FF] rounded-full animate-spin" />
                </div>
              ) : videoUrl ? (
                /* ── HD Portrait Video ── */
                <video
                  ref={el => { videoRefs.current[index] = el; }}
                  src={videoUrl}
                  autoPlay={index === 0}
                  muted
                  loop
                  playsInline
                  preload={preload}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : gifUrl ? (
                /* ── GIF fallback (ExerciseDB, if ever available) ── */
                <img
                  src={gifUrl}
                  alt={exercise.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                /* ── No media — show instructions panel ── */
                <div className="absolute inset-0 bg-[#0d0d0d] flex flex-col justify-center px-6 pt-24 pb-8 overflow-hidden">
                  <Dumbbell className="w-16 h-16 text-[#00F2FF]/20 mb-6" />
                  {instructions.length > 0 && (
                    <div className="space-y-3 overflow-y-auto max-h-[45vh]">
                      {instructions.map((step, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00F2FF]/15 border border-[#00F2FF]/30 flex items-center justify-center text-[#00F2FF] text-xs font-bold">
                            {i + 1}
                          </span>
                          <p className="text-white/70 text-sm leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/50 pointer-events-none" />

              {/* Bottom content */}
              <div
                className="absolute bottom-0 left-0 right-0 px-6"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 40px)' }}
              >
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">
                  {t('workouts.exercise', 'Exercise')} {index + 1} / {exercises.length}
                </p>

                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-white text-3xl font-bold leading-tight">
                    {exercise.name}
                  </h2>
                  {difficulty && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                      style={{
                        color: DIFFICULTY_COLOR[difficulty] ?? '#fff',
                        borderColor: DIFFICULTY_COLOR[difficulty] ?? '#fff',
                        backgroundColor: (DIFFICULTY_COLOR[difficulty] ?? '#fff') + '22',
                      }}
                    >
                      {difficulty}
                    </span>
                  )}
                </div>

                <p className="text-[#00F2FF] text-lg font-semibold mb-2">
                  {exercise.sets} {t('common.sets', 'sets')} × {exercise.reps} {t('common.reps', 'reps')}
                  {exercise.weight > 0 ? ` · ${exercise.weight} ${t('common.kg', 'kg')}` : ''}
                </p>

                {/* Show first instruction as a teaser when there's media */}
                {(videoUrl || gifUrl) && instructions.length > 0 && (
                  <p className="text-white/50 text-sm leading-relaxed line-clamp-2">
                    {instructions[0]}
                  </p>
                )}

                {exercise.notes && (
                  <p className="text-white/40 text-sm mt-1">{exercise.notes}</p>
                )}

                {/* Swipe hint — first slide only */}
                {index === 0 && exercises.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: [0, 0.6, 0.6, 0], y: [6, 0, 0, -8] }}
                    transition={{ duration: 3.5, delay: 1.2, times: [0, 0.2, 0.7, 1] }}
                    className="mt-4 flex items-center gap-2 text-white/40 text-sm"
                  >
                    <span>↑</span>
                    <span>{t('workouts.swipeHint', 'Swipe up to preview next exercise')}</span>
                  </motion.div>
                )}

                {/* Start Workout CTA — last slide */}
                {isLast && (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={onStart}
                    className="w-full mt-6 h-14 rounded-2xl gradient-cyan text-black font-bold text-lg"
                  >
                    {t('workouts.startWorkout', 'Start Workout')} 🔥
                  </motion.button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
