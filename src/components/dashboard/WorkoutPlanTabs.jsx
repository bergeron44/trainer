import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function WorkoutPlanTabs({ plans, activePlan, onSelect, onOpenEditor }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {plans.map((plan) => {
        const isActive = activePlan === plan.id;
        return (
          <motion.button
            key={plan.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(plan.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${isActive
                ? 'bg-[#00F2FF]/10 border-2 border-[#00F2FF]'
                : 'bg-[#1A1A1A] border-2 border-[#2A2A2A] hover:border-[#3A3A3A]'
              }`}
          >
            <span className={`font-semibold ${isActive ? 'text-[#00F2FF]' : 'text-gray-300'}`}>
              {plan.name}
            </span>
            {isActive && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditor(plan);
                }}
                className="p-1 hover:bg-[#00F2FF]/20 rounded-full cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-[#00F2FF]" />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}