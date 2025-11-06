/**
 * Custom chat hook that properly formats messages for Azure OpenAI
 * Fixes the issue where @ai-sdk/react sends messages with 'id' and 'parts'
 * but Azure OpenAI only accepts 'role' and 'content'
 */

import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useCustomChat(apiEndpoint: string = "/api/chat"): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageIdCounter = useRef(0);

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!userContent.trim()) return;

      // Add user message
      const userId = `msg-${messageIdCounter.current++}`;
      const userMessage: ChatMessage = {
        id: userId,
        role: "user",
        content: userContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        // Prepare messages in format that API expects
        const messagesToSend = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role,
            content: m.content,
          }))
          .concat({
            role: "user" as const,
            content: userContent,
          });

        console.log("[useCustomChat] Sending messages:", messagesToSend);

        // Send to API
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messagesToSend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error || `API error: ${response.status}`;
          throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("[useCustomChat] Got response:", data);

        // Extract assistant response
        const assistantContent =
          data.choices?.[0]?.message?.content ||
          "Xin lỗi, tôi không thể lấy được phản hồi";

        // Add assistant message
        const assistantId = `msg-${messageIdCounter.current++}`;
        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: assistantContent,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Store RAG documents if available (for later display)
        if (data.ragDocuments) {
          // Add to last message as metadata
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg) {
              (lastMsg as any).ragDocuments = data.ragDocuments;
            }
            return updated;
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err) || "Unknown error";
        console.error("[useCustomChat] Error:", errorMsg);
        setError(errorMsg);

        // Add error message
        const errorId = `msg-${messageIdCounter.current++}`;
        const errorMessage: ChatMessage = {
          id: errorId,
          role: "assistant",
          content: `Lỗi: ${errorMsg}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, apiEndpoint]
  );

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    error,
  };
}

