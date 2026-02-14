import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export default function GlobalCoachFAB({ onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-28 right-6 w-14 h-14 rounded-full gradient-cyan flex items-center justify-center shadow-lg glow-cyan z-50"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, type: 'spring' }}
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <MessageCircle className="w-6 h-6 text-black" />
      </motion.div>
      
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-[#00F2FF]"
        animate={{
          scale: [1, 1.3, 1.3],
          opacity: [0.8, 0, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
      />
    </motion.button>
  );
}