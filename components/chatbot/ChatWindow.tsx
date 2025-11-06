"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useCustomChat, type ChatMessage } from "@/lib/useCustomChat";

interface ChatWindowProps {
  onClose: () => void;
}

type RagDocument = {
  id: string;
  file: string;
  chunkIndex: number;
  summary: string;
};

export default function ChatWindow({ onClose }: ChatWindowProps) {
  const t = useTranslations("chatbot");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, input, setInput, sendMessage, isLoading, error } =
    useCustomChat("/api/chat");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p>{t("welcome")}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            const ragDocs = (message as any).ragDocuments as
              | RagDocument[]
              | undefined;

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900"
                  }`}
                >
                  {/* Message content */}
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>

                  {/* RAG Sources (for assistant messages) */}
                  {!isUser && ragDocs && ragDocs.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-300 text-xs">
                      <div className="font-semibold text-blue-700 mb-2">
                        📚 Nguồn (ERGO):
                      </div>
                      <div className="space-y-1">
                        {ragDocs.map((doc, i) => (
                          <div
                            key={i}
                            className="bg-white rounded p-1.5 text-gray-700"
                          >
                            <div className="font-medium text-blue-600">
                              {doc.file.split("/").pop()}
                            </div>
                            <div className="text-gray-600 line-clamp-2">
                              {doc.summary}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            disabled={isLoading}
            autoFocus
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

