"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useEffect, useRef, useState, FormEvent } from "react";
import { useTranslations } from "next-intl";

interface ChatWindowProps {
  onClose: () => void;
}

type FallbackReply = {
  id: string;
  text: string;
  rag?: Array<{ id: string; file: string; chunkIndex: number; text: string; score?: number }>;
};

export default function ChatWindow({ onClose }: ChatWindowProps) {
  const t = useTranslations("chatbot");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [fallbackReplies, setFallbackReplies] = useState<FallbackReply[]>([]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
      {
        id: "welcome",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: t("welcome") }],
      } as UIMessage,
    ],
  });

  const isLoading = status === "streaming";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, fallbackReplies]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // snapshot assistant count before sending
    const prevAssistantCount = messages.filter((m) => m.role === "assistant").length;

    // send via SDK transport (keeps existing behaviour)
    try {
      sendMessage({ text: input });
    } catch (err) {
      // ignore; we'll fallback
      console.warn("sendMessage error (ignored):", err);
    }

    const textToSend = input;
    setInput("");

    // After a short delay, if no assistant reply was appended, call debug endpoint and show fallback
    const CHECK_DELAY_MS = 1500;
    setTimeout(async () => {
      try {
        const currentAssistantCount = messages.filter((m) => m.role === "assistant").length;
        if (currentAssistantCount <= prevAssistantCount) {
          // no assistant reply yet — call debug endpoint
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textToSend, debug: true }),
          });
          if (res.ok) {
            const data = await res.json();
            const replyText = data?.reply ?? data?.text ?? "(no reply)";
            const rag = Array.isArray(data?.ragSnippets) ? data.ragSnippets : data?.ragSnippets ?? [];
            setFallbackReplies((prev) => [...prev, { id: String(Date.now()), text: replyText, rag }]);
          } else {
            console.warn("Fallback debug request failed", await res.text());
          }
        }
      } catch (err) {
        console.error("Fallback fetch error:", err);
      }
    }, CHECK_DELAY_MS);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t("title")}</h3>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
          aria-label={t("close")}
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.parts.map((part: any, idx: number) => {
                  if (part.type === "text") {
                    return (
                      <p key={idx} className="text-sm whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}

        {/* Render fallback replies (from debug endpoint) */}
        {fallbackReplies.map((f) => (
          <div key={f.id} className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-800">
              <p className="text-sm whitespace-pre-wrap">{f.text}</p>
              {f.rag && f.rag.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  <div className="font-semibold">Retrieved snippets:</div>
                  {f.rag.map((s, i) => (
                    <div key={i} className="mt-1 border-l-2 pl-2">
                      <div className="text-xs font-medium">{s.file} (chunk {s.chunkIndex})</div>
                      <div className="text-xs whitespace-pre-wrap">{s.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm">{t("error")}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            {t("send")}
          </button>
        </div>
      </form>
    </div>
  );
}
