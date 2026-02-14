import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function OnboardingStep({
  question,
  type,
  options,
  value,
  onChange,
  onNext,
  onBack,
  stepNumber,
  totalSteps,
  unit,
  placeholder,
  multiSelect = false
}) {
  const handleOptionClick = (option) => {
    if (multiSelect) {
      const current = value || [];
      if (current.includes(option)) {
        onChange(current.filter(v => v !== option));
      } else {
        onChange([...current, option]);
      }
    } else {
      onChange(option);
    }
  };

  const canProceed = value !== undefined && value !== '' && value !== null && 
    (Array.isArray(value) ? value.length > 0 : true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="min-h-screen flex flex-col px-6 py-8"
    >
      {/* Progress bar with clear indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">{stepNumber}/{totalSteps}</span>
          <span className="text-xs text-[#00F2FF]">{Math.round((stepNumber / totalSteps) * 100)}%</span>
        </div>
        <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(stepNumber / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[#00F2FF] to-[#CCFF00] rounded-full"
          />
        </div>
      </div>

      {/* Question */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold mb-8 leading-tight"
      >
        {question}
      </motion.h2>

      {/* Input area */}
      <div className="flex-1">
        {type === 'number' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative"
          >
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
              placeholder={placeholder}
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-4xl font-bold h-20 text-center focus:border-[#00F2FF] focus:ring-[#00F2FF]/20"
            />
            {unit && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                {unit}
              </span>
            )}
          </motion.div>
        )}

        {type === 'text' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-lg h-14 focus:border-[#00F2FF] focus:ring-[#00F2FF]/20"
            />
          </motion.div>
        )}

        {type === 'textarea' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-white text-lg p-4 focus:border-[#00F2FF] focus:ring-[#00F2FF]/20 focus:outline-none resize-none"
            />
          </motion.div>
        )}

        {type === 'select' && options && (
          <div className="grid gap-3">
            {options.map((option, index) => (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                onClick={() => handleOptionClick(option.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                  (multiSelect ? (value || []).includes(option.value) : value === option.value)
                    ? 'border-[#00F2FF] bg-[#00F2FF]/10'
                    : 'border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {option.icon && (
                    <span className="text-2xl">{option.icon}</span>
                  )}
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {type === 'slider' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <span className="text-4xl font-bold text-[#00F2FF]">{value || options.min}</span>
              {unit && <span className="text-gray-500">{unit}</span>}
            </div>
            <input
              type="range"
              min={options.min}
              max={options.max}
              step={options.step || 1}
              value={value || options.min}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full h-2 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer slider-cyan"
              style={{
                background: `linear-gradient(to right, #00F2FF 0%, #00F2FF ${((value || options.min) - options.min) / (options.max - options.min) * 100}%, #1A1A1A ${((value || options.min) - options.min) / (options.max - options.min) * 100}%, #1A1A1A 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{options.min}</span>
              <span>{options.max}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {stepNumber > 1 && (
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 h-14 bg-transparent border-[#2A2A2A] text-white hover:bg-[#1A1A1A] hover:text-white"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className={`flex-1 h-14 font-semibold transition-all duration-300 ${
            canProceed
              ? 'gradient-cyan text-black hover:opacity-90'
              : 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
          }`}
        >
          {stepNumber === totalSteps ? 'Complete Setup' : 'Continue'}
          {stepNumber !== totalSteps && <ChevronRight className="w-5 h-5 ml-2" />}
        </Button>
      </div>
    </motion.div>
  );
}