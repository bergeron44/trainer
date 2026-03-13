import React from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SWIPE_THRESHOLD = -80;

export default function ExercisePreviewCard({ exercise, index, onClick, onSwapRequest }) {
    const { t } = useTranslation();
    const dragX = useMotionValue(0);
    const controls = useAnimation();
    const swapOpacity = useTransform(dragX, [-120, -60, 0], [1, 0.6, 0]);
    const swapScale = useTransform(dragX, [-120, -60, 0], [1, 0.85, 0.7]);

    const handleDragEnd = (_, info) => {
        if (info.offset.x < SWIPE_THRESHOLD) {
            controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
            onSwapRequest?.(exercise);
        } else {
            controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 28 }}
            className="relative overflow-hidden rounded-xl"
            style={{ height: '56px' }}
        >
            {/* Swap action background — revealed on drag */}
            <motion.div
                className="absolute inset-0 rounded-xl flex items-center justify-end pr-5 gap-2"
                style={{
                    background: 'linear-gradient(135deg, #00F2FF 0%, #00A8B5 100%)',
                    opacity: swapOpacity,
                }}
            >
                <motion.div style={{ scale: swapScale }} className="flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4 text-black" />
                    <span className="text-black text-xs font-bold tracking-wide">
                        {t('dashboard.swapExercise', 'Swap')}
                    </span>
                </motion.div>
            </motion.div>

            {/* Draggable card */}
            <motion.button
                drag="x"
                dragConstraints={{ left: -140, right: 0 }}
                dragElastic={0.25}
                dragMomentum={false}
                animate={controls}
                onDragEnd={handleDragEnd}
                onClick={() => onClick?.(index)}
                className="absolute inset-0 w-full h-full flex items-center gap-3 px-4 rounded-xl text-left cursor-grab active:cursor-grabbing select-none border border-[#1E1E1E] hover:border-[#00F2FF]/30 transition-colors"
                style={{
                    x: dragX,
                    background: 'linear-gradient(135deg, #141414 0%, #1A1A1A 50%, #1E1E1E 100%)',
                }}
            >
                {/* Subtle left accent line */}
                <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                    style={{ background: 'linear-gradient(180deg, #00F2FF, #CCFF00)' }}
                />

                {/* Index circle */}
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00F2FF]/10 border border-[#00F2FF]/25 flex items-center justify-center ml-1">
                    <span className="text-[#00F2FF] font-bold text-xs">{index + 1}</span>
                </div>

                {/* Exercise name */}
                <span className="flex-1 font-semibold text-sm text-white/90 truncate">
                    {exercise.name}
                </span>

                {/* Sets × Reps pill */}
                <div className="flex-shrink-0 flex items-center gap-1 bg-white/5 rounded-full px-2.5 py-0.5 border border-white/10">
                    <span className="text-[#00F2FF] text-xs font-bold">{exercise.sets}</span>
                    <span className="text-gray-500 text-[10px]">×</span>
                    <span className="text-[#00F2FF] text-xs font-bold">{exercise.reps}</span>
                </div>

                {exercise.weight > 0 && (
                    <div className="flex-shrink-0 bg-[#CCFF00]/10 rounded-full px-2 py-0.5 border border-[#CCFF00]/20">
                        <span className="text-[#CCFF00] text-[11px] font-bold">{exercise.weight}kg</span>
                    </div>
                )}
            </motion.button>
        </motion.div>
    );
}
