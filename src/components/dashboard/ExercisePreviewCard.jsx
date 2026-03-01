import React from 'react';
import { motion } from 'framer-motion';
import { Play, Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExercisePreviewCard({ exercise, index, onClick }) {
    const { t } = useTranslation();

    return (
        <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
            onClick={() => onClick?.(index)}
            className="w-full group relative overflow-hidden rounded-2xl border border-[#2A2A2A] bg-gradient-to-br from-[#1A1A1A] to-[#111111] hover:border-[#00F2FF]/40 transition-all duration-300 text-left"
            style={{ height: '25vh', minHeight: '140px', maxHeight: '200px' }}
        >
            {/* Subtle gradient accent on the left */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00F2FF] to-[#CCFF00] rounded-l-2xl opacity-60 group-hover:opacity-100 transition-opacity" />

            {/* Content */}
            <div className="relative h-full flex items-center justify-between px-5 py-4">
                {/* Left side — exercise info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Number badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#00F2FF]/10 border border-[#00F2FF]/20 flex items-center justify-center">
                        <span className="text-[#00F2FF] font-bold text-lg">{index + 1}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg text-white truncate group-hover:text-[#00F2FF] transition-colors">
                            {exercise.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-sm text-gray-400">
                                <span className="text-[#00F2FF] font-semibold">{exercise.sets}</span> {t('common.sets', 'sets')}
                            </span>
                            <span className="text-[#2A2A2A]">·</span>
                            <span className="text-sm text-gray-400">
                                <span className="text-[#00F2FF] font-semibold">{exercise.reps}</span> {t('session.reps', 'reps')}
                            </span>
                            {exercise.weight > 0 && (
                                <>
                                    <span className="text-[#2A2A2A]">·</span>
                                    <span className="text-sm text-gray-400">
                                        <span className="text-[#CCFF00] font-semibold">{exercise.weight}</span> {t('common.kg', 'kg')}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right side — play icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#00F2FF]/10 border border-[#00F2FF]/20 flex items-center justify-center group-hover:bg-[#00F2FF]/20 group-hover:scale-110 transition-all duration-300">
                    <Play className="w-5 h-5 text-[#00F2FF] ml-0.5" />
                </div>
            </div>

            {/* Hover glow effect */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: 'inset 0 0 30px rgba(0, 242, 255, 0.05)' }}
            />
        </motion.button>
    );
}
