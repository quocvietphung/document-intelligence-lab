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
    const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
    const [displayedContent, setDisplayedContent] = useState<Record<string, string>>({});
    const typingSpeedRef = useRef(30);

    const welcomeText = t("welcome") + ". Ask me anything about ERGO insurance and finance consulting";

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, displayedContent]);

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

    useEffect(() => {
        if (welcomeComplete && messages.length === 0) {
            const lang = detectLanguage(t("welcome") as string);
            const welcome = getWelcomeMessage(lang, true);
            addMessage({ role: "assistant", content: welcome, isWelcome: true });
        }
    }, [welcomeComplete, messages.length, addMessage, t]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === "assistant" && !(lastMessage as any).isWelcome && !isLoading) {
            const messageId = lastMessage.id;
            const fullContent = lastMessage.content;
            const currentDisplayed = displayedContent[messageId] || "";

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

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px";
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
                    className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 hover:from-blue-700 hover:via-blue-800 hover:to-purple-800 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center group relative"
                    aria-label={t("open_chat")}
                >
                    {/* Animated background glow */}
                    <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 relative z-10"
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

                    {/* Pulse animation */}
                    <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-20"></span>
                </button>
            </div>
        );
    }

    return (
        <div
            className={`fixed z-50 transition-all duration-500 ease-out flex flex-col ${
                isExpanded
                    ? "bottom-6 right-6 w-[90vw] h-[90vh] max-w-4xl max-h-[900px]"
                    : "bottom-6 right-6 w-full sm:w-[420px] h-[600px] sm:h-[700px] mx-4 sm:mx-0 max-w-[calc(100vw-32px)]"
            }`}
        >
            {/* Modern Chat Container */}
            <div className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden h-full border border-slate-100/50">
                {/* ========== HEADER ========== */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3.5 flex items-center justify-between border-b border-blue-500/40 relative overflow-hidden group">
                    {/* Background gradient animation */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 to-purple-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="flex items-center gap-3 relative z-10">
                        {/* Avatar with status indicator */}
                        <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-300 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-blue-600 shadow-md"></div>
                        </div>

                        <div className="min-w-0">
                            <h3 className="font-semibold text-sm leading-tight truncate">{t("title")}</h3>
                            <p className="text-blue-100 text-xs font-medium">{t("status_ready")}</p>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 relative z-10">
                        {/* Maximize/Restore Button */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200 flex items-center justify-center group"
                            title={isExpanded ? t("restore_tooltip") : t("expand_tooltip")}
                            aria-label={isExpanded ? "Restore" : "Maximize"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 group-hover:scale-110 transition-transform"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                {isExpanded ? (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M9 4H5a2 2 0 00-2 2v4m0 0a2 2 0 002-2h4m11 0h4a2 2 0 012 2v4m0 0v4a2 2 0 01-2 2h-4m0 0a2 2 0 01-2-2v-4m0-4h4a2 2 0 012 2v4m0 0a2 2 0 01-2 2h-4"
                                    />
                                ) : (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-6-2l6 6m0 0l-6-6m6 6V4"
                                    />
                                )}
                            </svg>
                        </button>

                        {/* Close/Minimize Button */}
                        <button
                            onClick={onToggleMinimize}
                            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200 flex items-center justify-center group"
                            title={t("minimize_tooltip")}
                            aria-label="Minimize"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 group-hover:scale-110 transition-transform"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ========== MESSAGES AREA ========== */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-white/50 scroll-smooth">
                    {/* Welcome Message */}
                    {messages.length === 0 && displayedWelcome.length > 0 && (
                        <div className="flex justify-start animate-slideInLeft">
                            <div className="max-w-[85%] bg-slate-100 text-slate-900 rounded-2xl rounded-bl-none px-3.5 py-2.5 shadow-sm border border-slate-200">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {displayedWelcome}
                                    {showWelcomeTyping && <span className="animate-pulse">▌</span>}
                                </p>
                                <span className="text-xs mt-1.5 block text-slate-500">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                            </div>
                        </div>
                    )}

                    {/* Messages List */}
                    {messages.length > 0 &&
                        messages.map((message) => {
                            const isUser = message.role === "user";
                            const isWelcome = (message as any).isWelcome;

                            let displayContent = message.content;
                            if (!isUser && !isWelcome && displayedContent[message.id]) {
                                displayContent = displayedContent[message.id];
                            }

                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slideIn`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
                                            isUser
                                                ? "bg-blue-600 text-white rounded-br-none border border-blue-500/60"
                                                : "bg-slate-100 text-slate-900 rounded-bl-none border border-slate-200"
                                        }`}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {displayContent}
                                            {typingMessageId === message.id && (
                                                <span className="animate-pulse ml-1">▌</span>
                                            )}
                                        </p>
                                        <span className={`text-xs mt-1.5 block ${
                                            isUser ? "text-blue-100" : "text-slate-500"
                                        }`}>
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                                    </div>
                                </div>
                            );
                        })}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex justify-start animate-slideInLeft">
                            <div className="bg-slate-100 rounded-2xl rounded-bl-none px-3.5 py-2.5 shadow-sm border border-slate-200">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div
                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.2s" }}
                                    ></div>
                                    <div
                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.4s" }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex justify-center animate-slideIn">
                            <div className="bg-red-50 text-red-700 rounded-2xl px-4 py-3 text-sm border border-red-200 shadow-sm font-medium">
                                <div className="flex items-center gap-2">
                                    <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                                    </svg>
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ========== INPUT AREA ========== */}
                <div className="border-t border-slate-200 bg-white p-5">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="flex gap-2 items-end">
                            {/* Textarea */}
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t("placeholder")}
                                className="flex-1 px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none bg-white hover:bg-slate-50 focus:bg-white transition-all max-h-[200px] shadow-sm placeholder:text-slate-400"
                                disabled={isLoading}
                                autoFocus
                                rows={3}
                            />

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-3 rounded-full transition-all font-semibold h-auto flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 duration-200 group disabled:cursor-not-allowed flex-shrink-0"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 group-hover:scale-110 transition-transform"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16179957 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.34915502,10.7524035 3.50612381,10.7524035 L16.6915026,11.5379023 C16.6915026,11.5379023 17.1624089,11.5379023 17.1624089,12.0091944 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                                </svg>
                            </button>
                        </div>

                        {/* Helper Text */}
                        <p className="text-xs text-slate-500 px-1">
                            💡 <span className="bg-slate-200 px-1.5 py-0.5 rounded">Shift + Enter</span> {t("helper_text")}
                        </p>
                    </form>
                </div>
            </div>

            {/* ========== ANIMATIONS ========== */}
            <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-slideIn {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Custom Scrollbar */
        div::-webkit-scrollbar {
          width: 6px;
        }

        div::-webkit-scrollbar-track {
          background: transparent;
        }

        div::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #1e40af);
          border-radius: 10px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #1e3a8a);
        }

        /* Smooth transitions */
        * {
          transition-property: background-color, border-color, color, fill, stroke;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 200ms;
        }
      `}</style>
        </div>
    );
}
