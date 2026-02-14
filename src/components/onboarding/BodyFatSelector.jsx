import React, { useState } from 'react';
import { motion } from 'framer-motion';

const BODY_FAT_REFERENCES = [
  { 
    value: 10, 
    label: '8-12%', 
    description: 'Very lean, visible abs',
    maleDescription: 'Competition ready, visible veins',
    femaleDescription: 'Athletic, defined muscles'
  },
  { 
    value: 15, 
    label: '13-17%', 
    description: 'Athletic, some definition',
    maleDescription: 'Fit appearance, abs visible',
    femaleDescription: 'Fit and toned'
  },
  { 
    value: 20, 
    label: '18-22%', 
    description: 'Healthy, less defined',
    maleDescription: 'Average fit, soft midsection',
    femaleDescription: 'Healthy and fit'
  },
  { 
    value: 25, 
    label: '23-27%', 
    description: 'Average, minimal definition',
    maleDescription: 'Some belly fat visible',
    femaleDescription: 'Average healthy'
  },
  { 
    value: 30, 
    label: '28-35%', 
    description: 'Above average',
    maleDescription: 'Rounded midsection',
    femaleDescription: 'Soft curves'
  }
];

export default function BodyFatSelector({ value, onChange, gender = 'male' }) {
  const [hoveredValue, setHoveredValue] = useState(null);
  
  const displayValue = hoveredValue !== null ? hoveredValue : value;
  const activeRef = BODY_FAT_REFERENCES.find(ref => {
    const diff = Math.abs(ref.value - (displayValue || 20));
    return diff <= 4;
  }) || BODY_FAT_REFERENCES[2];

  return (
    <div className="space-y-6">
      {/* Visual Display */}
      <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A]">
        <div className="text-center mb-6">
          <span className="text-5xl font-bold text-[#00F2FF]">{displayValue || 20}%</span>
          <p className="text-gray-400 mt-2">{activeRef.description}</p>
        </div>

        {/* Reference Images Grid */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {BODY_FAT_REFERENCES.map((ref) => {
            const isActive = Math.abs(ref.value - (displayValue || 20)) <= 4;
            return (
              <motion.button
                key={ref.value}
                onClick={() => onChange(ref.value)}
                onMouseEnter={() => setHoveredValue(ref.value)}
                onMouseLeave={() => setHoveredValue(null)}
                whileTap={{ scale: 0.95 }}
                className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                  isActive 
                    ? 'border-[#00F2FF] ring-2 ring-[#00F2FF]/30' 
                    : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                }`}
              >
                {/* Placeholder silhouette */}
                <div className={`absolute inset-0 flex items-center justify-center ${
                  isActive ? 'bg-[#00F2FF]/20' : 'bg-[#2A2A2A]'
                }`}>
                  <div className="text-center">
                    <div className="text-2xl mb-1">
                      {gender === 'male' ? '👤' : '👤'}
                    </div>
                    <span className={`text-xs font-bold ${isActive ? 'text-[#00F2FF]' : 'text-gray-500'}`}>
                      {ref.label}
                    </span>
                  </div>
                </div>
                
                {/* Selection indicator */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-0 left-0 right-0 bg-[#00F2FF] py-0.5"
                  >
                    <span className="text-[10px] font-bold text-black">SELECTED</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Slider */}
        <div className="space-y-3">
          <input
            type="range"
            min={8}
            max={35}
            step={1}
            value={displayValue || 20}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #00F2FF 0%, #00F2FF ${((displayValue || 20) - 8) / (35 - 8) * 100}%, #2A2A2A ${((displayValue || 20) - 8) / (35 - 8) * 100}%, #2A2A2A 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>8%</span>
            <span>35%</span>
          </div>
        </div>
      </div>

      {/* Reference Notice */}
      <p className="text-xs text-gray-500 text-center px-4">
        ⚠️ Reference only. These are approximate visual guides. For accurate measurements, consult a professional.
      </p>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {BODY_FAT_REFERENCES.map((ref) => (
          <button
            key={ref.value}
            onClick={() => onChange(ref.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              Math.abs(ref.value - (value || 20)) <= 4
                ? 'bg-[#00F2FF] text-black'
                : 'bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A] hover:border-[#00F2FF]'
            }`}
          >
            ~{ref.value}%
          </button>
        ))}
      </div>
    </div>
  );
}