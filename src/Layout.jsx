import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Dumbbell, User, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalCoachFAB from '@/components/coach/GlobalCoachFAB';
import GlobalCoachChat from '@/components/coach/GlobalCoachChat';

export default function Layout({ children, currentPageName }) {
  const [mounted, setMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [coachStyle, setCoachStyle] = useState('motivational');

  useEffect(() => {
    setMounted(true);
    const savedCoach = localStorage.getItem('nexus_coach_style');
    if (savedCoach) setCoachStyle(savedCoach);
  }, []);

  const navItems = [
    { name: 'Dashboard', icon: Home, page: 'Dashboard' },
    { name: 'Workouts', icon: Dumbbell, page: 'Workouts' },
    { name: 'Nutrition', icon: Utensils, page: 'NutritionDemo' },
    { name: 'Profile', icon: User, page: 'Profile' },
  ];

  const hideNav = ['Onboarding', 'WorkoutSession', 'Login', 'Register'].includes(currentPageName);
  const showCoachFAB = !hideNav; // Show on all pages including NutritionDemo

  // Get context for coach chat
  const getContext = () => {
    const contextMap = {
      'Dashboard': 'Dashboard - Today\'s Workout',
      'Workouts': 'Workouts - Training History',
      'TrainingCalendar': 'Training Calendar',
      'NutritionDemo': 'Nutrition',
      'Analytics': 'Analytics - Progress Tracking',
      'Profile': 'Profile Settings'
    };
    return contextMap[currentPageName] || 'General';
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <style>{`
        :root {
          --cyan: #00F2FF;
          --green: #CCFF00;
          --dark: #0A0A0A;
          --black: #000000;
          --gray-dark: #1A1A1A;
          --gray-mid: #2A2A2A;
          --gray-light: #3A3A3A;
        }
        
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--gray-mid) var(--black);
        }
        
        *::-webkit-scrollbar {
          width: 6px;
        }
        
        *::-webkit-scrollbar-track {
          background: var(--black);
        }
        
        *::-webkit-scrollbar-thumb {
          background-color: var(--gray-mid);
          border-radius: 3px;
        }

        .glow-cyan {
          box-shadow: 0 0 20px rgba(0, 242, 255, 0.3);
        }

        .glow-green {
          box-shadow: 0 0 20px rgba(204, 255, 0, 0.3);
        }

        .gradient-cyan {
          background: linear-gradient(135deg, #00F2FF 0%, #00A8B5 100%);
        }

        .gradient-green {
          background: linear-gradient(135deg, #CCFF00 0%, #9BC700 100%);
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 242, 255, 0.6); }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>

      <AnimatePresence mode="wait">
        <motion.main
          key={currentPageName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`${hideNav ? '' : 'pb-24'}`}
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {/* Global Coach FAB - appears on all main pages */}
      {showCoachFAB && (
        <GlobalCoachFAB onClick={() => setChatOpen(true)} />
      )}

      {/* Global Coach Chat */}
      <GlobalCoachChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={getContext()}
        coachStyle={coachStyle}
      />

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#000000]/95 backdrop-blur-xl border-t border-[#2A2A2A] z-50">
          <div className="max-w-lg mx-auto px-2">
            <div className="flex items-center justify-around py-3">
              {navItems.map((item) => {
                const isActive = currentPageName === item.page;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className="flex flex-col items-center gap-1 relative"
                  >
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className={`p-2 rounded-xl transition-all duration-300 ${isActive
                          ? 'bg-[#00F2FF]/10'
                          : 'hover:bg-[#1A1A1A]'
                        }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-[#00F2FF]' : 'text-gray-500'
                          }`}
                      />
                    </motion.div>
                    <span className={`text-[10px] font-medium transition-colors duration-300 ${isActive ? 'text-[#00F2FF]' : 'text-gray-500'
                      }`}>
                      {item.name}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="navIndicator"
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00F2FF]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}