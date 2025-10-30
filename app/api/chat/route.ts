// Use local adapter to avoid TS2307 ('next/llm' not found) while keeping a Next-like API.

import { chat as llmChat } from '../../../lib/next-llm-adapter';
import fs from 'fs';
import path from 'path';

// Define a clear message shape for inbound/outbound messages
type ChatMessage = {
  role: string; // 'system' | 'user' | 'assistant' | 'tool'
  content: string;
};

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Accept either { messages: [...] } or { text: '...' } (some transports send a single text field)
    let messages: any = body?.messages;
    if (!messages && (body?.text || body?.input)) {
      const text = body.text ?? body.input;
      messages = [{ role: 'user', content: String(text) }];
    }

    // If messages exist but are in UIMessage format (with parts), normalize them
    let normalizedMessages: ChatMessage[] = [];
    if (Array.isArray(messages)) {
      normalizedMessages = messages
        .map((m: any): ChatMessage | null => {
          if (!m) return null;
          // If message already has role and content
          if (typeof m === 'object' && m.role && (m.content || m.text)) {
            return { role: m.role, content: m.content ?? m.text } as ChatMessage;
          }
          // If message uses 'parts' (Vercel AI UIMessage), join text parts
          if (typeof m === 'object' && Array.isArray(m.parts)) {
            const text = m.parts.map((p: any) => p.text ?? p.content ?? '').join('');
            return { role: m.role ?? 'user', content: text } as ChatMessage;
          }
          // If it's a simple string
          if (typeof m === 'string') return { role: 'user', content: m } as ChatMessage;
          // Fallback: stringify
          return { role: (m && m.role) || 'user', content: JSON.stringify(m) } as ChatMessage;
        })
        .filter(Boolean) as ChatMessage[];
    } else if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    }

    // Use normalizedMessages from now on
    messages = normalizedMessages;

    // Validate messages shape
    if (!Array.isArray(messages) || messages.length === 0) {
      console.warn('[chat/route] Empty or invalid messages payload:', body);
      return new Response(JSON.stringify({ error: 'Invalid request: missing messages or text' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('[chat/route] Incoming messages count:', messages.length, 'first:', messages[0]);

    // Attempt to load combined ERGO prompt (optional)
    let ergoCombined = '';
    try {
      const ergoPath = path.join(process.cwd(), 'data', 'ergo_prompt.json');
      if (fs.existsSync(ergoPath)) {
        const raw = fs.readFileSync(ergoPath, 'utf8');
        const parsed = JSON.parse(raw);
        ergoCombined = String(parsed.combinedPrompt || '').trim();
        console.log(`[chat/route] Loaded ergo_prompt.json, includedCount=${parsed.includedCount || 0}, chars=${ergoCombined.length}`);
      } else {
        console.log('[chat/route] ergo_prompt.json not found, continuing without external context');
      }
    } catch (err) {
      console.error('[chat/route] Error loading ergo_prompt.json:', err);
      ergoCombined = '';
    }

    // Build system prompt, optionally including the ERGO combined prompt (truncated)
    const MAX_CONTEXT_CHARS = 8000;
    const contextToInclude = ergoCombined ? (ergoCombined.length > MAX_CONTEXT_CHARS ? ergoCombined.slice(0, MAX_CONTEXT_CHARS) + '\n\n[TRUNCATED]' : ergoCombined) : '';

    const systemPromptBase = `You are a helpful tax consulting assistant specializing in tax advice, career guidance, and business registration in Vietnam and Germany. 

Key areas of expertise:
- Tax consulting for individuals and businesses
- Career guidance and professional development
- Business registration procedures in Vietnam and Germany
- Tax compliance and regulations
- Financial planning and accounting

Guidelines:
- Provide accurate, helpful information about tax matters
- Be professional and friendly
- If you're unsure about specific legal advice, recommend consulting with a licensed tax professional
- Keep responses concise but informative
- Support questions in English, German, and Vietnamese`;

    const systemPrompt = contextToInclude ? `Context from ERGO documents (extracted):\n\n${contextToInclude}\n\n--- End of context ---\n\n${systemPromptBase}` : systemPromptBase;

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    try {
      const res = await llmChat({ model: 'gpt-4o-mini', messages: llmMessages, temperature: 0.7, maxTokens: 500, stream: true });

      // llmChat returns a Response for streaming mode; forward it
      if (res instanceof Response) return res;

      console.error('[chat/route] Adapter returned non-Response:', typeof res);
      return new Response(JSON.stringify({ error: 'Unexpected LLM adapter response' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (adapterError) {
      // defensively extract message/detail
      const adapterDetails = (adapterError && typeof adapterError === 'object' && 'message' in adapterError) ? (adapterError as any).message : String(adapterError);
      console.error('[chat/route] LLM adapter error:', adapterError);
      // Return a helpful error to the client for debugging (avoid leaking secrets)
      return new Response(JSON.stringify({ error: 'LLM adapter failed', details: String(adapterDetails) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    // defensively extract message/detail
    const details = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error);
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: String(details) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
