import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import aiApi from '@/api/aiAxios';

const THREAD_STORAGE_KEY = 'nexus_global_chat_threads_v1';

const getCoachPersona = (style) => {
  const personas = {
    motivational: {
      greeting: "Hey champion! 🌟 I'm your coach and I'm SO excited to help you crush your goals today! What's on your mind?",
      style: "You are a MOTIVATIONAL coach - positive, encouraging, supportive. Celebrate small wins. Use phrases like 'You've got this!', 'Amazing work!'. Be warm and friendly. Use emojis like 🌟💪🎉"
    },
    spicy: {
      greeting: "Alright, let's cut the small talk. 💥 You came here for results, and I'm here to push you. What's going on?",
      style: "You are a SPICY coach - bold, direct, challenging with tough love. No sugarcoating but still supportive. Use phrases like 'I know you can do better', 'Step it up'. Use emojis like 💥⚡🔥"
    },
    hardcore: {
      greeting: "Listen up! 💀 I don't do hand-holding. You want results? Then EARN them. Tell me what you need and let's GO!",
      style: "You are a HARDCORE coach - military-style, no excuses, maximum intensity. Push hard. Use phrases like 'NO EXCUSES', 'PAIN IS TEMPORARY', 'DROP AND GIVE ME MORE'. Use emojis like 💀🔥⚔️"
    }
  };
  return personas[style] || personas.motivational;
};

const getDefaultAgentType = (context) => {
  const label = String(context || '').toLowerCase();
  return label.includes('nutrition') ? 'nutritionist' : 'coach';
};

const getAgentGreeting = (agentType, coachStyle) => {
  if (agentType === 'nutritionist') {
    return "Hey, I'm your nutritionist. I'll help with meals, macros, and daily nutrition targets. Tell me what you've eaten today. 🥗";
  }
  return getCoachPersona(coachStyle).greeting;
};

const getPersonaIdForAgent = (agentType, coachStyle) => (
  agentType === 'nutritionist' ? 'nutritionist' : coachStyle
);

const buildInitialThread = (agentType, coachStyle) => ([
  { role: 'assistant', content: getAgentGreeting(agentType, coachStyle) }
]);

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

export default function GlobalCoachChat({
  isOpen,
  onClose,
  context = 'General',
  coachStyle = 'motivational',
  prefill = '',
  onPrefillConsumed,
}) {
  const showToolTrace = Boolean(import.meta.env.DEV);
  const [selectedAgentType, setSelectedAgentType] = useState(() => getDefaultAgentType(context));
  const [threadsByAgent, setThreadsByAgent] = useState(() => loadStoredThreads());
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pastMemories, setPastMemories] = useState([]);
  const messagesEndRef = useRef(null);

  const messages = (threadsByAgent[selectedAgentType] && threadsByAgent[selectedAgentType].length)
    ? threadsByAgent[selectedAgentType]
    : buildInitialThread(selectedAgentType, coachStyle);

  useEffect(() => {
    setThreadsByAgent((prev) => {
      if (prev[selectedAgentType] && prev[selectedAgentType].length) {
        return prev;
      }
      return {
        ...prev,
        [selectedAgentType]: buildInitialThread(selectedAgentType, coachStyle),
      };
    });
  }, [selectedAgentType, coachStyle]);

  // Default agent on open based on current tab context:
  // Nutrition tab -> nutritionist, all other tabs -> coach.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedAgentType(getDefaultAgentType(context));
  }, [isOpen, context]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threadsByAgent));
  }, [threadsByAgent]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadMemories = async () => {
      try {
        const { data } = await aiApi.get('/chat/summaries', {
          params: { agentType: selectedAgentType },
        });
        if (!cancelled) {
          setPastMemories(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load memories:', error);
        }
      }
    };

    loadMemories();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedAgentType]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle prefill from swipe-to-swap or other triggers
  useEffect(() => {
    if (isOpen && prefill) {
      setInput(prefill);
      if (onPrefillConsumed) onPrefillConsumed();
    }
  }, [isOpen, prefill]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    const agentType = selectedAgentType;
    const personaId = getPersonaIdForAgent(agentType, coachStyle);

    const outgoingMessages = [...messages, { role: 'user', content: userMessage }]
      .filter((message, index) => !(index === 0 && message.role === 'assistant'))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    const structuredContext = {
      label: context,
      page: 'GlobalCoachChat',
      memoryCount: pastMemories.length,
      agentType,
    };

    setInput('');
    setThreadsByAgent((prev) => {
      const currentMessages = (prev[agentType] && prev[agentType].length)
        ? prev[agentType]
        : buildInitialThread(agentType, coachStyle);
      return {
        ...prev,
        [agentType]: [...currentMessages, { role: 'user', content: userMessage }],
      };
    });
    setIsTyping(true);

    try {
      const { data } = await aiApi.post('/chat/response', {
        messages: outgoingMessages,
        context: structuredContext,
        personaId,
        agentType,
        metadata: {
          surface: 'GlobalCoachChat'
        },
        coachStyle: personaId
      });

      const aiResponse = data.response;
      setThreadsByAgent((prev) => {
        const currentMessages = (prev[agentType] && prev[agentType].length)
          ? prev[agentType]
          : buildInitialThread(agentType, coachStyle);
        return {
          ...prev,
          [agentType]: [...currentMessages, {
            role: 'assistant',
            content: aiResponse,
            toolTrace: Array.isArray(data.toolTrace) ? data.toolTrace : []
          }],
        };
      });
      setIsTyping(false);

      // Update local memory indicator without additional write calls.
      setPastMemories((prev) => [{
        user_request: userMessage,
        ai_response: aiResponse,
        context,
      }, ...prev].slice(0, 5));
    } catch (error) {
      console.error('Chat error:', error);
      setThreadsByAgent((prev) => {
        const currentMessages = (prev[agentType] && prev[agentType].length)
          ? prev[agentType]
          : buildInitialThread(agentType, coachStyle);
        return {
          ...prev,
          [agentType]: [...currentMessages, {
            role: 'assistant',
            content: "I'm having trouble connecting right now. Let's try again in a moment!"
          }],
        };
      });
      setIsTyping(false);
    }
  };

  const quickReplies = selectedAgentType === 'nutritionist'
    ? ['What should I eat?', 'Am I eating enough protein?', 'Best post-workout meal?']
    : ["I'm short on time", 'Feeling tired today', 'Make it harder'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 h-[80vh] bg-[#0A0A0A] rounded-t-3xl border-t border-[#2A2A2A] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-cyan flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="font-bold">Nexus AI Coach</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">{context}</p>
                    {pastMemories.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-[#CCFF00]">
                        <Brain className="w-3 h-3" />
                        {pastMemories.length} memories
                      </span>
                    )}
                  </div>
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

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-[#1A1A1A] rounded-2xl px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#00F2FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[#00F2FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[#00F2FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {quickReplies.map((suggestion) => (
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
                  placeholder="Type anything to your coach..."
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white focus:border-[#00F2FF] focus:ring-[#00F2FF]/20"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
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
