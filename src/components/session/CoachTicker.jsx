import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function CoachTicker({ message, isTyping }) {
  return (
    <div className="relative overflow-hidden">
      {/* Pulse background effect */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-to-r from-[#00F2FF]/10 via-[#00F2FF]/20 to-[#00F2FF]/10"
      />
      
      <div className="relative flex items-center gap-3 px-4 py-3">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-8 h-8 rounded-full gradient-cyan flex items-center justify-center flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-black" />
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {isTyping ? (
              <motion.div
                key="typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <span className="text-sm text-[#00F2FF]">Coach is thinking</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-white font-medium truncate"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}