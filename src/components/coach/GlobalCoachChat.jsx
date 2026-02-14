import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

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

const getMockResponse = (userMessage, coachStyle, context) => {
  const message = userMessage.toLowerCase();
  const persona = getCoachPersona(coachStyle);
  
  // Context-aware responses
  if (context.includes('Nutrition')) {
    if (message.includes('protein') || message.includes('eat')) {
      const responses = {
        motivational: "Great question! 🌟 For your goals, aim for about 1.6-2g of protein per kg of body weight. You're already thinking smart - that's the winning mindset!",
        spicy: "Protein is your best friend right now. 💥 Aim for 2g per kg bodyweight minimum. No excuses about 'not being hungry' - your muscles need fuel!",
        hardcore: "LISTEN UP! 💀 Protein isn't optional - it's MANDATORY. 2g per kg, EVERY. SINGLE. DAY. Your muscles don't care about your feelings!"
      };
      return responses[coachStyle] || responses.motivational;
    }
    if (message.includes('calorie') || message.includes('cut') || message.includes('bulk')) {
      const responses = {
        motivational: "Love the focus on nutrition! 🎉 For cutting, aim for a 300-500 calorie deficit. For bulking, add 200-300 calories. Small, sustainable changes win the race!",
        spicy: "Calories are just math. 💥 Want to lose fat? Eat less than you burn. Want to gain muscle? Eat more. Stop overcomplicating it and start executing!",
        hardcore: "NUMBERS DON'T LIE! 💀 Track everything. Every bite. No 'cheat days' - only WEAK days. You want results or excuses?!"
      };
      return responses[coachStyle] || responses.motivational;
    }
  }
  
  if (context.includes('Workout') || context.includes('Dashboard')) {
    if (message.includes('tired') || message.includes('skip') || message.includes('rest')) {
      const responses = {
        motivational: "I hear you! 💪 Rest is actually part of the process. If you're genuinely exhausted, take a light day. But if it's just motivation - remember why you started! You've got this!",
        spicy: "Tired? 💥 Join the club. Everyone's tired. The question is - are you going to let that stop you? At least do a lighter version. Show up!",
        hardcore: "TIRED IS A STATE OF MIND! 💀 Your muscles don't know what day it is. Get in there and MOVE. You can rest when you're DEAD!"
      };
      return responses[coachStyle] || responses.motivational;
    }
    if (message.includes('hurt') || message.includes('pain') || message.includes('injury')) {
      const responses = {
        motivational: "Oh no, let's be careful! 🌟 If it's sharp pain, STOP immediately and maybe see a professional. Muscle soreness is normal, but real pain is a signal. Your health comes first!",
        spicy: "Pain is information. 💥 Sharp pain = stop. Muscle soreness = push through. Know the difference. Don't be stupid, but don't be soft either.",
        hardcore: "INJURY IS NOT AN EXCUSE - it's a DETOUR! 💀 Work around it. Bad shoulder? Train legs. Bad knee? Upper body. NO EXCUSES, only ADAPTATIONS!"
      };
      return responses[coachStyle] || responses.motivational;
    }
  }
  
  // Generic responses
  if (message.includes('help') || message.includes('advice')) {
    const responses = {
      motivational: "I'm here for you! 🌟 Tell me more about what's on your mind. Together, we'll figure out the best path forward!",
      spicy: "Alright, spill it. 💥 What's the real issue? Be specific and I'll give you real solutions.",
      hardcore: "TALK! 💀 What's holding you back? Spit it out and let's CRUSH whatever's in your way!"
    };
    return responses[coachStyle] || responses.motivational;
  }
  
  // Default responses
  const defaults = {
    motivational: "That's a great point! 🌟 Keep that energy up! Is there anything specific about your training or nutrition I can help with?",
    spicy: "Got it. 💥 Now let's turn that into ACTION. What's your next move?",
    hardcore: "NOTED! 💀 Now stop talking and start DOING. What's the plan?!"
  };
  return defaults[coachStyle] || defaults.motivational;
};

// Summarize text into a short sentence
const summarizeText = async (text, type) => {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Summarize this ${type} into ONE short sentence (max 15 words). Be concise and capture the key point:\n\n"${text}"`,
    response_json_schema: {
      type: "object",
      properties: {
        summary: { type: "string" }
      }
    }
  });
  return result.summary;
};

export default function GlobalCoachChat({ 
  isOpen, 
  onClose,
  context = 'General',
  coachStyle = 'motivational'
}) {
  const persona = getCoachPersona(coachStyle);
  
  const [messages, setMessages] = useState([
    { role: 'assistant', content: persona.greeting }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pastMemories, setPastMemories] = useState([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  // Load past memories on mount
  useEffect(() => {
    const loadMemories = async () => {
      const summaries = await base44.entities.ChatSummary.list('-created_date', 5);
      setPastMemories(summaries);
      setMemoriesLoaded(true);
    };
    if (isOpen && !memoriesLoaded) {
      loadMemories();
    }
  }, [isOpen, memoriesLoaded]);

  useEffect(() => {
    // Reset messages when coach style changes
    setMessages([{ role: 'assistant', content: persona.greeting }]);
  }, [coachStyle]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    // Build memory context from past summaries
    let memoryContext = '';
    if (pastMemories.length > 0) {
      memoryContext = '\n\nPAST USER INTERACTIONS (for context):\n' + 
        pastMemories.map(m => `- User: ${m.user_request} → Coach: ${m.ai_response}`).join('\n');
    }

    // Build the full prompt with persona and memory
    const systemPrompt = `${persona.style}\n\nYou are helping with: ${context}.${memoryContext}\n\nKeep responses concise and actionable (2-3 sentences max).`;

    // Call real LLM
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nUser: ${userMessage}`
    });

    const aiResponse = result;
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setIsTyping(false);

    // Summarize and save to memory (in background)
    (async () => {
      const [userSummary, aiSummary] = await Promise.all([
        summarizeText(userMessage, 'user request'),
        summarizeText(aiResponse, 'coach response')
      ]);
      
      await base44.entities.ChatSummary.create({
        user_request: userSummary,
        ai_response: aiSummary,
        context: context
      });
      
      // Update local memories
      setPastMemories(prev => [{
        user_request: userSummary,
        ai_response: aiSummary,
        context: context
      }, ...prev].slice(0, 5));
    })();
  };

  const quickReplies = context.includes('Nutrition') 
    ? ["What should I eat?", "Am I eating enough protein?", "Best post-workout meal?"]
    : ["I'm short on time", "Feeling tired today", "Make it harder"];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
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
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
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