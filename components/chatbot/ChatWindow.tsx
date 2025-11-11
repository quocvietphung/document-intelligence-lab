"use client";

import { useEffect, useRef, FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useCustomChat } from "@/lib/useCustomChat";
import { getWelcomeMessage, detectLanguage } from "@/lib/prompt-templates";

interface ChatWindowProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export default function ChatWindow({ isMinimized, onToggleMinimize }: ChatWindowProps) {
  const t = useTranslations("chatbot");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, input, setInput, sendMessage, isLoading, error, addMessage } =
    useCustomChat("/api/chat");
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayedWelcome, setDisplayedWelcome] = useState("");
  const [showWelcomeTyping, setShowWelcomeTyping] = useState(true);
  const [welcomeComplete, setWelcomeComplete] = useState(false);

  // State để quản lý typing effect cho chat responses
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<Record<string, string>>({});
  const typingSpeedRef = useRef(30); // ms per character

  const welcomeText = t("welcome") + ". Ask me anything about ERGO insurance and tax consulting";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedContent]);

  // Typing effect for welcome message
  useEffect(() => {
    if (messages.length === 0 && !welcomeComplete) {
      if (displayedWelcome.length < welcomeText.length) {
        const timer = setTimeout(() => {
          setDisplayedWelcome(welcomeText.slice(0, displayedWelcome.length + 1));
        }, 30);
        return () => clearTimeout(timer);
      } else {
        setShowWelcomeTyping(false);
        setWelcomeComplete(true);
      }
    }
  }, [displayedWelcome, messages.length, welcomeComplete, welcomeText]);

  // When welcome typing completes, insert the assistant welcome into messages history
  useEffect(() => {
    if (welcomeComplete && messages.length === 0) {
      const lang = detectLanguage(t("welcome") as string);
      const welcome = getWelcomeMessage(lang, true);
      addMessage({ role: "assistant", content: welcome, isWelcome: true });
    }
  }, [welcomeComplete, messages.length, addMessage, t]);

  // Typing effect cho các assistant messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === "assistant" && !(lastMessage as any).isWelcome && !isLoading) {
      const messageId = lastMessage.id;
      const fullContent = lastMessage.content;
      const currentDisplayed = displayedContent[messageId] || "";

      // Nếu chưa hiển thị hết nội dung, tiếp tục typing
      if (currentDisplayed.length < fullContent.length) {
        const timer = setTimeout(() => {
          setDisplayedContent(prev => ({
            ...prev,
            [messageId]: fullContent.slice(0, currentDisplayed.length + 1)
          }));
          setTypingMessageId(messageId);
        }, typingSpeedRef.current);

        return () => clearTimeout(timer);
      } else if (currentDisplayed.length === fullContent.length) {
        setTypingMessageId(null);
      }
    }
  }, [messages, displayedContent, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={onToggleMinimize}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full p-4 shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
          aria-label="Open chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 transition-all duration-300 ease-out flex flex-col ${
      isExpanded 
        ? "bottom-6 right-6 w-[90vw] h-[90vh] max-w-5xl max-h-[900px]" 
        : "bottom-6 right-6 w-[480px] h-[700px]"
    }`}>
      {/* Modern Chat Container */}
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden h-full">
        {/* ========== HEADER ========== */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white px-6 py-5 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg">{t("title")}</h3>
              <p className="text-blue-100 text-xs">Always here to help</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              title={isExpanded ? "Minimize" : "Expand"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                {isExpanded ? (
                  <path d="M6 14l6-6 6 6" stroke="currentColor" fill="none" strokeWidth="2" />
                ) : (
                  <path d="M6 10l6 6 6-6" stroke="currentColor" fill="none" strokeWidth="2" />
                )}
              </svg>
            </button>

            <button
              onClick={onToggleMinimize}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              title="Minimize"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ========== MESSAGES AREA ========== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-white via-gray-50 to-gray-100 scroll-smooth">
          {messages.length === 0 && displayedWelcome.length > 0 && (
            <div className="flex justify-start animate-fadeIn">
              <div className="max-w-[70%] bg-white text-gray-900 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm border border-gray-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {displayedWelcome}
                  {showWelcomeTyping && <span className="animate-pulse">|</span>}
                </p>
                <span className="text-xs mt-2 block text-gray-400">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            messages.map((message) => {
              const isUser = message.role === "user";
              const isWelcome = (message as any).isWelcome;

              // Lấy nội dung hiển thị (typing effect) hoặc full content
              let displayContent = message.content;
              if (!isUser && !isWelcome && displayedContent[message.id]) {
                displayContent = displayedContent[message.id];
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm transition-all ${
                      isUser
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none"
                        : "bg-white text-gray-900 rounded-bl-none border border-gray-200"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {displayContent}
                      {typingMessageId === message.id && <span className="animate-pulse">|</span>}
                    </p>
                    <span className={`text-xs mt-2 block ${isUser ? "text-blue-100" : "text-gray-400"}`}>
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-none px-5 py-3 shadow-sm border border-gray-200">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 text-red-700 rounded-2xl px-5 py-3 text-sm border border-red-200 shadow-sm">
                <p className="font-medium">Error: {error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========== INPUT AREA ========== */}
        <div className="border-t border-gray-200 bg-white p-5 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex space-x-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                className="flex-1 px-5 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm resize-none bg-gray-50 hover:bg-white transition-colors max-h-[120px]"
                disabled={isLoading}
                autoFocus
                rows={1}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-400 text-white px-6 py-3 rounded-2xl transition-all font-medium h-auto flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16179957 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.34915502,10.7524035 3.50612381,10.7524035 L16.6915026,11.5379023 C16.6915026,11.5379023 17.1624089,11.5379023 17.1624089,12.0091944 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500">Press Shift+Enter for new line</p>
          </form>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  );
}
