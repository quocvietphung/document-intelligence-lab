"use client";

import { useState } from "react";
import ChatWindow from "./ChatWindow";

export default function ChatBot() {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <>
      {/* Professional Chat Interface - Always Visible */}
      <ChatWindow
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized(!isMinimized)}
      />
    </>
  );
}
