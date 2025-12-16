"use client";

import { useEffect, useRef, FormEvent, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCustomChat } from "@/lib/hooks/useCustomChat";
import { getWelcomeMessage, detectLanguage } from "@/lib/rag/prompt-templates";

interface ChatWindowProps {
    isMinimized: boolean;
    onToggleMinimize: () => void;
}

// Quick action suggestions by language - Finance-focused questions
const QUICK_ACTIONS = {
    de: [
        "Wie kann ich meine Steuern optimieren?",
        "Was ist der beste Weg zur Altersvorsorge?",
        "Immobilienberatung und Finanzierung",
        "Wie erstelle ich einen Finanzplan?",
        "Was kostet eine Beratung?"
    ],
    en: [
        "How can I optimize my taxes?",
        "What's the best retirement planning strategy?",
        "Real estate consulting and financing",
        "How do I create a financial plan?",
        "What does your consultation cost?"
    ],
    vi: [
        "Làm thế nào để tối ưu hóa thuế?",
        "Chiến lược lập kế hoạch hưu trí tốt nhất là gì?",
        "Tư vấn bất động sản và tài chính",
        "Cách tạo kế hoạch tài chính?",
        "Chi phí tư vấn là bao nhiêu?"
    ]
};

// Helper to parse assistant message into answer and suggestions
function parseAssistantMessage(content: string): { answer: string; suggestions: string[] } | null {
  if (!content) return null;
  const marker = "SUGGESTIONS:";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return null;
  }

  const answerRaw = content.slice(0, idx).trim();
  const suggestionsRaw = content.slice(idx + marker.length).trim();

  const answer = answerRaw.replace(/^ANSWER:\s*/i, "").trim();

  const suggestions = suggestionsRaw
    .split(/\r?\n/)
    .map(line => line.replace(/^[-•]\s*/, "").trim())
    .filter(line => line.length > 0);

  if (!answer && suggestions.length === 0) {
    return null;
  }

  return { answer: answer || content.trim(), suggestions };
}

export default function ChatWindow({ isMinimized, onToggleMinimize }: ChatWindowProps) {
    const t = useTranslations("chatbot");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { messages, input, setInput, sendMessage, isLoading, error, addMessage } =
        useCustomChat("/api/chat");
    const [isExpanded, setIsExpanded] = useState(false);
    const [displayedWelcome, setDisplayedWelcome] = useState("");
    const [welcomeComplete, setWelcomeComplete] = useState(false);
    const [displayedContent, setDisplayedContent] = useState<Record<string, string>>({});
    const [hasUserInteracted, setHasUserInteracted] = useState(false);
    const [currentLocale, setCurrentLocale] = useState<"de" | "en" | "vi">("de");

    const welcomeText = t("welcome");

    useEffect(() => {
        // Detect current locale from browser or default to DE
        const locale = document.documentElement.lang || "de";
        if (locale.startsWith("en")) setCurrentLocale("en");
        else if (locale.startsWith("vi")) setCurrentLocale("vi");
        else setCurrentLocale("de");
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleQuickAction = async (action: string) => {
        setHasUserInteracted(true);
        await sendMessage(action);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, displayedContent]);

    useEffect(() => {
        if (messages.length === 0 && !welcomeComplete) {
            setDisplayedWelcome(welcomeText);
            setWelcomeComplete(true);
        }
    }, [messages.length, welcomeComplete, welcomeText]);

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
            setDisplayedContent(prev => ({
                ...prev,
                [messageId]: fullContent
            }));
        }
    }, [messages, isLoading]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px";
        }
    }, [input]);

    // Lock body scroll when fullscreen
    useEffect(() => {
        if (isExpanded && !isMinimized) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isExpanded, isMinimized]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        setHasUserInteracted(true);
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
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-4">

                {/* Main Chat Button */}
                <button
                    onClick={onToggleMinimize}
                    className="group relative flex items-center justify-center"
                    aria-label={t("open_chat")}
                >
                    {/* Animated background orbs */}
                    <div className="absolute inset-0 rounded-full">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
                        <div className="absolute inset-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                    </div>

                    {/* Main button */}
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 shadow-2xl hover:shadow-3xl transition-all duration-300 group-hover:scale-110 flex items-center justify-center border border-blue-400/30 backdrop-blur-md">
                        {/* Inner glow */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* Icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-7 w-7 text-white relative z-10"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>

                        {/* Animated badge */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                    </div>

                    {/* Tooltip */}
                    <div className="absolute -top-12 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="bg-gray-900 text-white text-xs font-semibold py-2 px-3 rounded-lg whitespace-nowrap">
                            {t("open_chat")}
                        </div>
                    </div>
                </button>

                {/* Quick Contact Buttons */}
                <div className="flex flex-col gap-3">
                    {/* WhatsApp Button */}
                    <a
                        href="https://wa.me/491777884553?text=Xin%20chào%20Jenny,%20tôi%20muốn%20tư%20vấn%20về%20tài%20chính"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative w-14 h-14 rounded-full bg-white shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-110 flex items-center justify-center border border-gray-200/50 hover:border-gray-300 backdrop-blur-md"
                        title="WhatsApp"
                    >
                        {/* WhatsApp official icon */}
                        <svg className="w-7 h-7 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a5.505 5.505 0 0 0-5.5 5.515c0 3.048 2.468 5.573 5.466 5.573h.004c3.022 0 5.5-2.525 5.5-5.517 0-1.54-.635-3.051-1.746-4.15-1.112-1.1-2.588-1.703-4.22-1.721M2.604 2.862A10.07 10.07 0 0 1 12.004 0C6.719 0 2.5 4.22 2.5 9.506c0 1.659.429 3.268 1.234 4.649L2.167 21.995l7.168-2.333c1.295.707 2.759 1.08 4.234 1.08 5.285 0 9.503-4.22 9.503-9.506C21.507 6.718 17.29 2.862 12.004 2.862" fill="#25D366" />
                        </svg>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs font-semibold py-1 px-2 rounded-lg whitespace-nowrap">
                                WhatsApp
                            </div>
                        </div>
                    </a>

                    {/* Zalo Button */}
                    <a
                        href="https://zalo.me/84917788553"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative w-14 h-14 rounded-full bg-white shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-110 flex items-center justify-center border border-gray-200/50 hover:border-gray-300 backdrop-blur-md"
                        title="Zalo"
                    >
                        {/* Zalo official icon */}
                        <svg className="w-7 h-7 relative z-10" fill="#0084FF" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.05.532 4.02 1.504 5.738L0 24l6.459-3.187C8.704 22.766 10.308 23.5 12 23.5c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.833 15.833h-9.166c-.459 0-.834-.375-.834-.833v-2.5c0-.459.375-.833.834-.833h9.166c.459 0 .834.375.834.833v2.5c0 .458-.375.833-.834.833z" />
                        </svg>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs font-semibold py-1 px-2 rounded-lg whitespace-nowrap">
                                Zalo
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`fixed z-50 transition-all duration-300 ease-out flex flex-col ${
                isExpanded
                    ? "bottom-6 right-6 w-[95vw] h-[95vh] max-w-6xl max-h-[900px] rounded-2xl scale-100 opacity-100"
                    : "bottom-6 right-6 w-full sm:w-[450px] h-[650px] sm:h-[750px] mx-4 sm:mx-0 max-w-[calc(100vw-32px)] rounded-2xl scale-100 opacity-100"
            }`}
        >
            {/* Outer glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 pointer-events-none"></div>

            {/* Main container with glassmorphism */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden h-full border border-white/40 relative z-10">

                {/* ========== HEADER ========== */}
                <div className="relative bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white px-6 py-5 flex items-center justify-between border-b border-blue-500/40 min-h-[80px]">
                    {/* Header background effects */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-400/5 to-purple-500/10"></div>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        {/* Premium Avatar */}
                        <div className="relative">
                            <Image
                                src="/ava.png"
                                alt="Jenny - Financial Advisor"
                                width={44}
                                height={44}
                                className="rounded-full object-cover border border-blue-300/50 shadow-lg"
                                priority
                            />
                            {/* Status dot */}
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-700 shadow-lg animate-pulse"></div>
                        </div>

                        <div>
                            <h3 className="font-bold text-base leading-tight">{t("title")}</h3>
                            <p className="text-blue-100 text-xs font-medium">
                                {t("status_ready")}
                            </p>
                        </div>
                    </div>

                    {/* Header Buttons */}
                    <div className="flex items-center gap-2 relative z-10">

                      {/* Expand / Restore */}
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all duration-200 active:scale-95 backdrop-blur-md"
                        title={isExpanded ? t("restore_tooltip") : t("expand_tooltip")}
                      >
                        {isExpanded ? (
                          /* Restore */
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="14 3 14 10 21 10" />
                            <line x1="14" y1="10" x2="21" y2="3" />
                            <polyline points="10 21 10 14 3 14" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        ) : (
                          /* Expand */
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        )}
                      </button>

                      {/* Minimize */}
                      <button
                        onClick={onToggleMinimize}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all duration-200 active:scale-95 backdrop-blur-md"
                        title={t("minimize_tooltip")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>
                </div>

                {/* ========== ANIMATIONS ========== */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/30 scroll-smooth">
                    {/* Welcome Message */}
                    {messages.length === 0 && displayedWelcome.length > 0 && (
                        <div className="flex justify-start animate-slideInLeft">
                            <div className="max-w-xs bg-white rounded-2xl rounded-tl-none px-5 py-4 shadow-md border border-slate-200/50 backdrop-blur-sm">
                                <p className="text-sm leading-relaxed text-slate-900 whitespace-pre-wrap font-semibold">
                                    {displayedWelcome}
                                </p>
                                <span className="text-xs mt-3 block text-slate-500 font-medium">
                                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Messages List */}
                    {messages.length > 0 &&
                        messages.map((message, msgIndex) => {
                            const isUser = message.role === "user";
                            const isWelcome = (message as any).isWelcome;

                            let displayText = message.content;
                            let suggestions: string[] = [];

                            if (!isUser && !isWelcome) {
                                const parsed = parseAssistantMessage(message.content);
                                if (parsed) {
                                    displayText = parsed.answer;
                                    suggestions = parsed.suggestions;
                                }
                            }

                            // Check if this is the last assistant message
                            const isLastAssistantMessage = msgIndex === messages.length - 1 && !isUser && suggestions.length > 0;

                            return (
                                <div key={message.id}>
                                    <div
                                        className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slideIn`}
                                    >
                                        <div
                                            className={`max-w-xs rounded-2xl px-5 py-3.5 shadow-sm transition-all ${
                                                isUser
                                                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none border border-blue-500/30"
                                                    : "bg-white text-slate-900 rounded-tl-none border border-slate-200/50 shadow-md"
                                            }`}
                                        >
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-semibold">
                                                {displayText}
                                            </p>
                                            <span className={`text-xs mt-2 block font-medium ${
                                                isUser ? "text-blue-200" : "text-slate-400"
                                            }`}>
                                                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Suggestions as separate tag buttons below last assistant message */}
                                    {isLastAssistantMessage && (
                                        <div className="mt-5 flex flex-wrap gap-2.5 animate-slideIn pl-1">
                                            {suggestions.map((s, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleQuickAction(s)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg text-xs font-semibold text-slate-700 border border-blue-200/60 hover:border-blue-400/80 hover:from-blue-100 hover:to-blue-50 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:bg-blue-50/90 backdrop-blur-sm"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    {/* Quick Actions - Only visible before first user message */}
                    {messages.filter((m) => m.role === "user").length === 0 &&
                        welcomeComplete &&
                        !hasUserInteracted && (
                        <div className="mt-8 space-y-3 animate-slideIn">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mb-3">
                                {currentLocale === "de" && "Häufige Anfragen"}
                                {currentLocale === "en" && "Popular Questions"}
                                {currentLocale === "vi" && "Câu hỏi phổ biến"}
                            </p>
                            <div className="flex flex-wrap gap-2.5">
                                {QUICK_ACTIONS[currentLocale].map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleQuickAction(action)}
                                        disabled={isLoading}
                                        className="px-4 py-2.5 bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50/80 rounded-lg text-slate-700 text-xs font-semibold border border-blue-200/70 hover:border-blue-400/80 hover:from-blue-100 hover:via-blue-50 hover:to-blue-100/80 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md backdrop-blur-sm"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex justify-start animate-slideInLeft">
                            <div className="bg-white rounded-2xl rounded-tl-none px-5 py-4 shadow-md border border-slate-200/50">
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div
                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.15s" }}
                                    ></div>
                                    <div
                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                        style={{ animationDelay: "0.3s" }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex justify-center animate-slideIn">
                            <div className="bg-red-50/80 text-red-700 rounded-xl px-4 py-3 text-sm border border-red-200/50 shadow-sm font-medium backdrop-blur-sm">
                                <div className="flex items-center gap-2.5">
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
                <div className="border-t border-slate-200/50 bg-gradient-to-t from-slate-50/50 to-white/80 backdrop-blur-xl px-6 py-5">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="flex gap-3 items-end">
                            {/* Textarea */}
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t("placeholder")}
                                className="flex-1 px-4 py-3 border border-slate-300/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none bg-white hover:bg-slate-50/50 focus:bg-white transition-all max-h-[200px] shadow-sm placeholder:text-slate-500 placeholder:font-medium font-medium"
                                disabled={isLoading}
                                autoFocus
                                rows={3}
                            />

                            {/* Send Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 text-white px-5 py-3 rounded-xl transition-all font-bold h-auto flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 duration-200 disabled:cursor-not-allowed flex-shrink-0"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 transition-transform group-hover:scale-110"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16179957 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99721575 L3.03521743,10.4382088 C3.03521743,10.5953061 3.34915502,10.7524035 3.50612381,10.7524035 L16.6915026,11.5379023 C16.6915026,11.5379023 17.1624089,11.5379023 17.1624089,12.0091944 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                                </svg>
                            </button>
                        </div>

                        {/* Helper Text */}
                        <p className="text-xs text-slate-500 px-1 font-medium">
                            💡 <span className="bg-slate-200/70 px-2 py-0.5 rounded-md font-semibold">Shift + Enter</span> {t("helper_text")}
                        </p>
                    </form>
                </div>
            </div>

            {/* ========== ANIMATIONS ========== */}
            <style>{`
                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-16px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .animate-slideInLeft {
                    animation: slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1);
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
                    background: linear-gradient(to bottom, #93c5fd, #3b82f6);
                    border-radius: 10px;
                }

                div::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, #60a5fa, #2563eb);
                }
            `}</style>
        </div>
    );
}
