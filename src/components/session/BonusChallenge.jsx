import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BonusChallenge({ isVisible, challenge, onAccept, onDismiss }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative w-full max-w-sm"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-[#CCFF00]/20 blur-3xl rounded-full" />
            
            <div className="relative bg-[#1A1A1A] rounded-3xl border-2 border-[#CCFF00] p-6 text-center">
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 p-2 hover:bg-[#2A2A2A] rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>

              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="w-20 h-20 rounded-full bg-[#CCFF00] flex items-center justify-center mx-auto mb-4"
              >
                <Zap className="w-10 h-10 text-black" />
              </motion.div>

              <h2 className="text-2xl font-bold text-[#CCFF00] mb-2">BONUS CHALLENGE!</h2>
              <p className="text-gray-400 mb-1">Your coach sees you're crushing it!</p>
              
              <div className="bg-[#0A0A0A] rounded-xl p-4 my-4 border border-[#2A2A2A]">
                <p className="text-xl font-bold text-white">{challenge}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={onDismiss}
                  variant="outline"
                  className="flex-1 border-[#2A2A2A] text-gray-400 hover:bg-[#2A2A2A]"
                >
                  Skip
                </Button>
                <Button
                  onClick={onAccept}
                  className="flex-1 bg-[#CCFF00] hover:bg-[#CCFF00]/90 text-black font-bold"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Accept
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}