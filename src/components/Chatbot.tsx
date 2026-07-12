import { useState, useRef, useEffect } from 'react';
import { FaComments, FaTimes, FaPaperPlane, FaRobot, FaUser } from 'react-icons/fa';
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
    <div className="fixed bottom-6 right-6 z-50 font-['Urbanist'] select-none">
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-2xl transition hover:scale-110 active:scale-95 animate-bounce hover:animate-none"
          title="Chat với G2Cinema"
        >
          <FaComments className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 text-[9px] font-bold justify-center items-center">1</span>
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="flex h-[500px] w-[360px] flex-col rounded-2xl border border-white/10 bg-[#0F172A]/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-900/40 via-cyan-900/20 to-slate-900/60 p-4 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 text-white shadow-md">
                <FaRobot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white leading-tight">G2C Assistant</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Trực tuyến</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
                >
                  {isBot && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-cyan-400 text-xs font-bold border border-slate-700">
                      <FaRobot />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[75%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-xs shadow-md leading-relaxed whitespace-pre-line ${
                        isBot
                          ? 'bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-none'
                          : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-tr-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className={`text-[9px] text-gray-500 mt-1 ${!isBot ? 'text-right' : ''}`}>
                      {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!isBot && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600/20 text-blue-400 text-xs font-bold border border-blue-500/20">
                      <FaUser />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Loader */}
            {isTyping && (
              <div className="flex items-start gap-2.5 justify-start">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-cyan-400 text-xs font-bold border border-slate-700">
                  <FaRobot />
                </div>
                <div className="flex flex-col">
                  <div className="rounded-2xl rounded-tl-none px-4 py-2.5 bg-slate-800/80 border border-slate-700/50 text-slate-400 text-xs flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick presets (only shown if not typing) */}
          {!isTyping && (
            <div className="px-4 pb-2 pt-1 border-t border-white/5 flex gap-1.5 flex-wrap">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(preset.text)}
                  className="rounded-full border border-gray-800 bg-[#0F172A] hover:border-blue-500/50 hover:bg-blue-950/10 px-2.5 py-1 text-[10px] font-black text-slate-300 transition"
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
            className="border-t border-white/10 p-3 flex gap-2 shrink-0 bg-slate-950/40 rounded-b-2xl"
          >
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 rounded-xl border border-gray-800 bg-[#0F172A] px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <FaPaperPlane className="h-3 w-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
