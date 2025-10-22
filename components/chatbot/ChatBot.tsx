"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ChatWindow from "./ChatWindow";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("chatbot");

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 flex items-center justify-center group"
        aria-label={t("button_label")}
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
        <span className="absolute right-full mr-3 bg-gray-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {t("button_label")}
        </span>
      </button>

      {/* Chat window */}
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}
    </>
  );
}
