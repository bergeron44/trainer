import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Zap, ThumbsUp, ThumbsDown, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QUICK_FEEDBACKS = [
  { id: 'easy', label: 'Too Easy', icon: ThumbsUp, color: '#CCFF00', energy: 'high' },
  { id: 'good', label: 'Just Right', icon: Zap, color: '#00F2FF', energy: 'normal' },
  { id: 'hard', label: 'Too Hard', icon: ThumbsDown, color: '#FF6B6B', energy: 'low' },
  { id: 'heartrate', label: 'Heart Rate High', icon: Heart, color: '#FF6B6B', energy: 'recovery' },
];

export default function FeedbackButton({ onFeedback, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const handleQuickFeedback = (feedback) => {
    onFeedback(feedback);
    setIsOpen(false);
  };

  const handleCustomFeedback = () => {
    if (customText.trim()) {
      onFeedback({ id: 'custom', label: customText, energy: 'custom' });
      setCustomText('');
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Main FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full gradient-cyan flex items-center justify-center shadow-lg shadow-[#00F2FF]/30 z-40"
      >
        <MessageCircle className="w-6 h-6 text-black" />
      </motion.button>

      {/* Feedback Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-[#0A0A0A] rounded-t-3xl border-t border-[#2A2A2A] p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">How was that set?</h3>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-[#1A1A1A] rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Quick feedback buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {QUICK_FEEDBACKS.map(feedback => {
                  const Icon = feedback.icon;
                  return (
                    <motion.button
                      key={feedback.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleQuickFeedback(feedback)}
                      className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#2A2A2A] hover:border-[#3A3A3A] bg-[#1A1A1A] transition-colors"
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${feedback.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: feedback.color }} />
                      </div>
                      <span className="font-medium">{feedback.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Custom text input */}
              <div className="flex gap-2">
                <Input
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustomFeedback()}
                  placeholder="Tell your coach anything..."
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                />
                <Button 
                  onClick={handleCustomFeedback}
                  disabled={!customText.trim()}
                  className="gradient-cyan text-black px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}