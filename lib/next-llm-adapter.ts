// Simple adapter that calls the pluggable LLM provider (lib/llm-provider.ts)

import { callLLM } from './llm-provider';

type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

type ChatOptions = {
  model?: string;
  messages: Array<{ role: MessageRole; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export async function chat(opts: ChatOptions) {
  const { model = 'gpt-4o-mini', messages, temperature = 0.7, maxTokens = 500, stream = true } = opts;
  const provider = process.env.LLM_PROVIDER || 'mock';

  // call generic provider
  const res = await callLLM({ provider, model, messages, temperature, maxTokens, stream });

  // If callLLM returned a Response, forward it
  if (res instanceof Response) return res;

  // If callLLM returned text or object, convert to Response
  if (typeof res === 'string') return new Response(res, { headers: { 'Content-Type': 'text/plain' } });
  if (res && typeof (res as any).text === 'string') return new Response((res as any).text, { headers: { 'Content-Type': 'text/plain' } });

  return new Response(JSON.stringify({ error: 'Unexpected provider response' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}

