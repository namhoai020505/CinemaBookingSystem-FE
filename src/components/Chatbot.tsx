import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Loader2, MessageSquare } from 'lucide-react';
import { chatbotService } from '../services/chatbotService';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Tôi là trợ lý ảo G2Cinema. Tôi có thể giúp gì cho bạn hôm nay? (Ví dụ: hỏi về các mã voucher hiện có, cách đặt vé, lịch chiếu...)',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle Send Message
  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const responseText = await chatbotService.sendMessage(text);
      
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: 'Xin lỗi, tôi không thể xử lý yêu cầu lúc này.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Preset prompts
  const presets = [
    { label: 'Voucher hiện có', text: 'Tôi muốn tìm hiểu các voucher giảm giá đang chạy' },
    { label: 'Hướng dẫn đặt vé', text: 'Hướng dẫn tôi các bước đặt vé xem phim' },
    { label: 'Lịch chiếu', text: 'Hôm nay có những phim nào đang chiếu?' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-2xl transition hover:scale-110 active:scale-95 animate-bounce hover:animate-none border border-indigo-400/20"
          title="Chat với G2Cinema"
        >
          <MessageSquare className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 text-[9px] font-bold justify-center items-center">1</span>
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="flex h-[550px] w-[380px] flex-col rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 to-indigo-950 shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-indigo-600/30 backdrop-blur-sm p-4 border-b border-indigo-500/30 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Sparkles className="text-indigo-300 h-5 w-5" />
              <div>
                <h3 className="text-white font-medium text-sm">G2C Assistant</h3>
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] text-emerald-400 font-medium">Trực tuyến</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-indigo-200 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isBot ? "justify-start" : "justify-end"}`}
                >
                  <div className="flex flex-col max-w-[80%]">
                    <div
                      className={`p-3 rounded-2xl ${
                        !isBot
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-700/60 text-slate-100 rounded-tl-none border border-slate-600/50"
                      } animate-fade-in`}
                    >
                      <p className="text-xs whitespace-pre-line leading-relaxed">{msg.text}</p>
                    </div>
                    <span className={`text-[9px] text-slate-400 mt-1 px-1 ${!isBot ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl bg-slate-700/60 text-slate-100 rounded-tl-none border border-slate-600/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick presets (only shown if not typing) */}
          {!isTyping && (
            <div className="px-4 pb-2 pt-1 border-t border-slate-800/40 bg-slate-900/30 flex gap-1.5 flex-wrap">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(preset.text)}
                  className="rounded-full border border-indigo-500/20 bg-slate-800/50 hover:border-indigo-500/50 hover:bg-indigo-950/40 px-2.5 py-1 text-[10px] text-indigo-200 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className={`p-4 border-t ${isFocused ? 'border-indigo-500/70 bg-slate-800/80' : 'border-slate-700/50 bg-slate-800/30'} transition-colors duration-200`}
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Nhập tin nhắn..."
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-full py-2.5 pl-4 pr-12 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className={`absolute right-1 rounded-full p-1.5 ${
                  !inputValue.trim() || isTyping
                    ? "text-slate-500 bg-slate-700/50 cursor-not-allowed"
                    : "text-white bg-indigo-600 hover:bg-indigo-500"
                } transition-colors`}
              >
                {isTyping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>
        {`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        
        .delay-75 {
          animation-delay: 0.2s;
        }
        
        .delay-150 {
          animation-delay: 0.4s;
        }
        `}
      </style>
    </div>
  );
}
