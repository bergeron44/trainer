import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Sparkles, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/api/axios';
import ReactMarkdown from 'react-markdown';

const getTrainerPersona = (personality) => {
  const personas = {
    drill_sergeant: {
      greeting: "Listen up! I'm your coach and we're here to WORK. No excuses, no slacking. Tell me what's going on and I'll adjust your plan. Let's GO! 💪🔥",
      style: "You are THE DRILL SERGEANT - aggressive, high-energy, motivational but TOUGH. Use short, punchy sentences. Push hard but care deeply. NO EXCUSES mentality. Use emojis like 💪🔥⚡"
    },
    scientist: {
      greeting: "Hello! I'm your evidence-based training coach. I focus on biomechanics, RPE tracking, and data-driven progressive overload. Tell me how you're feeling and I'll optimize your session accordingly. 📊",
      style: "You are THE SCIENTIST - analytical, precise, data-focused. Explain WHY behind changes. Reference RPE, volume landmarks, recovery metrics. Professional but warm. Use emojis like 📊📈🔬"
    },
    zen_coach: {
      greeting: "Welcome, friend. I'm here to guide you on your fitness journey with patience and encouragement. Focus on the mind-muscle connection. How are you feeling today? 🧘‍♂️✨",
      style: "You are THE ZEN COACH - calm, encouraging, focused on longevity and mindfulness. Speak about feeling the movement, listening to your body, sustainable progress. Gentle but firm. Use emojis like 🧘‍♂️✨🌿"
    }
  };
  return personas[personality] || personas.drill_sergeant;
};

export default function AICoachChat({
  isOpen,
  onClose,
  userProfile,
  currentWorkout,
  onWorkoutUpdate,
  isInSession = false
}) {
  const personality = userProfile?.trainer_personality || 'drill_sergeant';
  const persona = getTrainerPersona(personality);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: persona.greeting
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Construct the prompt manually as we did with Base44
      const prompt = `${persona.style}\n\nUSER PROFILE:\n- Goal: ${userProfile?.goal}\n- Experience: ${userProfile?.experience_level}\n- Environment: ${userProfile?.environment}\n- Injuries: ${userProfile?.injuries || 'None'}\n\nCURRENT WORKOUT:\n- Focus: ${currentWorkout?.muscle_group}\n- Exercises: ${JSON.stringify(currentWorkout?.exercises?.map(e => ({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight })), null, 2)}\n\nUSER MESSAGE: "${userMessage}"\n\nRespond in your unique coaching style. If the user needs workout modifications, just describe them in text for now.`;

      const { data } = await api.post('/chat/response', {
        prompt: prompt,
        context: isInSession ? 'Workout Session' : 'Dashboard',
        coachStyle: personality
      });

      const aiMessage = data.response;
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);

      // Note: Automatic workout updates via JSON schema are invalid in the simple chat controller.
      // If we want that feature, we'd need to enhance the backend to support structured output or parsing.
      // For now, we just show the text response.

    } catch (error) {
      console.error('AI Coach Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I had a brief connection issue. Let's try that again! What do you need help with?"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${isInSession ? 'bottom-0 left-0 right-0 max-w-md mx-auto h-[70vh]' : 'bottom-0 left-0 right-0 h-[80vh]'} bg-[#0A0A0A] rounded-t-3xl border-t border-[#2A2A2A] flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-cyan flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="font-bold">Nexus AI Coach</h3>
                  <p className="text-xs text-gray-500">Always here to help</p>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                        ? 'bg-[#00F2FF] text-black'
                        : 'bg-[#1A1A1A] text-white'
                      }`}
                  >
                    {message.role === 'assistant' ? (
                      <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-[#1A1A1A] rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#00F2FF]" />
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {["I'm short on time", "My shoulder hurts", "Make it harder"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400 hover:border-[#00F2FF] hover:text-[#00F2FF] transition-colors whitespace-nowrap"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#2A2A2A]">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white focus:border-[#00F2FF] focus:ring-[#00F2FF]/20"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="gradient-cyan text-black px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}