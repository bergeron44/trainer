import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import aiApi from '@/api/aiAxios';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

const THREAD_STORAGE_KEY = 'nexus_ai_coach_chat_threads_v1';

const getTrainerPersona = (personality) => {
  const personas = {
    drill_sergeant_coach: {
      greeting: "Listen up! I'm your coach and we're here to WORK. No excuses, no slacking. Tell me what's going on and I'll adjust your plan. Let's GO! 💪🔥",
      style: "You are THE DRILL SERGEANT - aggressive, high-energy, motivational but TOUGH. Use short, punchy sentences. Push hard but care deeply. NO EXCUSES mentality. Use emojis like 💪🔥⚡"
    },
    scientist_coach: {
      greeting: "Hello! I'm your evidence-based training coach. I focus on biomechanics, RPE tracking, and data-driven progressive overload. Tell me how you're feeling and I'll optimize your session accordingly. 📊",
      style: "You are THE SCIENTIST - analytical, precise, data-focused. Explain WHY behind changes. Reference RPE, volume landmarks, recovery metrics. Professional but warm. Use emojis like 📊📈🔬"
    },
    nutritionist: {
      greeting: "Hey! I'm your nutrition-focused coach. I'll help you hit calories and macros with meals that actually fit your routine. Tell me what you've eaten today and what your goal is. 🥗📉",
      style: "You are THE NUTRITIONIST COACH - practical, evidence-aware, and adherence-focused. Prioritize calories, protein, meal structure, and sustainability. Avoid extreme restrictions. Use emojis like 🥗📉🍽️"
    },
    zen_coach: {
      greeting: "Welcome, friend. I'm here to guide you on your fitness journey with patience and encouragement. Focus on the mind-muscle connection. How are you feeling today? 🧘‍♂️✨",
      style: "You are THE ZEN COACH - calm, encouraging, focused on longevity and mindfulness. Speak about feeling the movement, listening to your body, sustainable progress. Gentle but firm. Use emojis like 🧘‍♂️✨🌿"
    }
  };
  return personas[personality] || personas.drill_sergeant_coach;
};

const resolveCoachPersonaId = (personality) => (
  String(personality || '').endsWith('_coach') ? personality : 'drill_sergeant_coach'
);

const buildInitialThread = ({ agentType, personality }) => {
  const personaId = agentType === 'nutritionist'
    ? 'nutritionist'
    : resolveCoachPersonaId(personality);

  return [{
    role: 'assistant',
    content: getTrainerPersona(personaId).greeting,
  }];
};

const sanitizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && typeof message.role === 'string' && typeof message.content === 'string')
    .map((message) => ({
      role: message.role,
      content: message.content,
      toolTrace: Array.isArray(message.toolTrace) ? message.toolTrace : undefined,
    }));
};

const loadStoredThreads = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(THREAD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return {
      coach: sanitizeMessages(parsed.coach),
      nutritionist: sanitizeMessages(parsed.nutritionist),
    };
  } catch (_error) {
    return {};
  }
};

export default function AICoachChat({
  isOpen,
  onClose,
  userProfile,
  currentWorkout,
  onWorkoutUpdate,
  isInSession = false
}) {
  const { t } = useTranslation();
  const showToolTrace = Boolean(import.meta.env.DEV);
  const personality = userProfile?.trainer_personality || 'drill_sergeant_coach';
  const [selectedAgentType, setSelectedAgentType] = useState(
    personality === 'nutritionist' ? 'nutritionist' : 'coach'
  );
  const [threadsByAgent, setThreadsByAgent] = useState(() => loadStoredThreads());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const activePersonaId = selectedAgentType === 'nutritionist'
    ? 'nutritionist'
    : resolveCoachPersonaId(personality);

  const messages = (threadsByAgent[selectedAgentType] && threadsByAgent[selectedAgentType].length)
    ? threadsByAgent[selectedAgentType]
    : buildInitialThread({ agentType: selectedAgentType, personality });

  useEffect(() => {
    setThreadsByAgent((prev) => {
      if (prev[selectedAgentType] && prev[selectedAgentType].length) {
        return prev;
      }
      return {
        ...prev,
        [selectedAgentType]: buildInitialThread({ agentType: selectedAgentType, personality }),
      };
    });
  }, [selectedAgentType, personality]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threadsByAgent));
  }, [threadsByAgent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const agentType = selectedAgentType;
    const personaId = activePersonaId;

    const outgoingMessages = [...messages, { role: 'user', content: userMessage }]
      .filter((message, index) => !(index === 0 && message.role === 'assistant'))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    const structuredContext = {
      label: isInSession ? 'Workout Session' : 'Dashboard',
      page: isInSession ? 'WorkoutSession' : 'Dashboard',
      userProfile: {
        goal: userProfile?.goal,
        experience_level: userProfile?.experience_level,
        environment: userProfile?.environment,
        injuries: userProfile?.injuries || 'None'
      },
      currentWorkout: currentWorkout ? {
        muscle_group: currentWorkout?.muscle_group,
        exercises: currentWorkout?.exercises?.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight
        }))
      } : null,
      agentType,
    };

    setInput('');
    setThreadsByAgent((prev) => {
      const currentMessages = (prev[agentType] && prev[agentType].length)
        ? prev[agentType]
        : buildInitialThread({ agentType, personality });
      return {
        ...prev,
        [agentType]: [...currentMessages, { role: 'user', content: userMessage }],
      };
    });
    setIsLoading(true);

    try {
      const { data } = await aiApi.post('/chat/response', {
        messages: outgoingMessages,
        context: structuredContext,
        personaId,
        agentType,
        metadata: {
          surface: 'AICoachChat',
          is_in_session: isInSession
        },
        coachStyle: personaId
      });

      const aiMessage = data.response;
      setThreadsByAgent((prev) => {
        const currentMessages = (prev[agentType] && prev[agentType].length)
          ? prev[agentType]
          : buildInitialThread({ agentType, personality });
        return {
          ...prev,
          [agentType]: [...currentMessages, {
            role: 'assistant',
            content: aiMessage,
            toolTrace: Array.isArray(data.toolTrace) ? data.toolTrace : []
          }],
        };
      });

      // Note: Automatic workout updates via JSON schema are invalid in the simple chat controller.
      // If we want that feature, we'd need to enhance the backend to support structured output or parsing.
      // For now, we just show the text response.

    } catch (error) {
      console.error('AI Coach Error:', error);
      setThreadsByAgent((prev) => {
        const currentMessages = (prev[agentType] && prev[agentType].length)
          ? prev[agentType]
          : buildInitialThread({ agentType, personality });
        return {
          ...prev,
          [agentType]: [...currentMessages, {
            role: 'assistant',
            content: t('coach.errorConnecting', "Sorry, I had a brief connection issue. Let's try that again! What do you need help with?")
          }],
        };
      });
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
                  <h3 className="font-bold">{t('coach.title', 'Nexus AI Coach')}</h3>
                  <p className="text-xs text-gray-500">{t('coach.alwaysHereSubtitle', 'Always here to help')}</p>
                  <div className="mt-2">
                    <Select value={selectedAgentType} onValueChange={setSelectedAgentType}>
                      <SelectTrigger className="h-8 w-[150px] border-[#2A2A2A] bg-[#1A1A1A] px-2 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[220] border-[#2A2A2A] bg-[#121212] text-white">
                        <SelectItem value="coach" className="text-xs focus:bg-[#1F1F1F]">Coach</SelectItem>
                        <SelectItem value="nutritionist" className="text-xs focus:bg-[#1F1F1F]">Nutritionist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                      <>
                        <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                          {message.content}
                        </ReactMarkdown>
                        {showToolTrace && Array.isArray(message.toolTrace) && message.toolTrace.length > 0 && (
                          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-gray-400">
                            Tools: {message.toolTrace.map((trace) => `${trace.toolName}:${trace.ok ? 'ok' : 'err'}`).join(', ')}
                          </div>
                        )}
                      </>
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
                    <span className="text-sm text-gray-400">{t('common.thinking', 'Thinking...')}</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {(selectedAgentType === 'nutritionist'
                ? [
                  t('coach.suggestions.whatShouldIEat', 'What should I eat now?'),
                  t('coach.suggestions.howMuchProtein', 'How much protein should I eat?'),
                  t('coach.suggestions.quickMealIdea', 'Give me a quick meal idea')
                ]
                : [
                  t('coach.suggestions.shortOnTime', "I'm short on time"),
                  t('coach.suggestions.shoulderHurts', 'My shoulder hurts'),
                  t('coach.suggestions.makeHarder', 'Make it harder')
                ]
              ).map((suggestion) => (
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
                  placeholder={t('coach.askMeAnything', 'Ask me anything...')}
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
