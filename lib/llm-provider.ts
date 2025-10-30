// Simple pluggable LLM provider adapter.
// Supports providers by reading process.env.LLM_PROVIDER.
// Providers implemented: 'openai' (uses @ai-sdk/openai + ai.streamText), 'huggingface' (Inference API), 'ollama' (local), 'mock' (dev only).

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string };

export async function callLLM(opts: {
  provider?: string;
  model?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}): Promise<Response | { text: string } | string> {
  const provider = (opts.provider || process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const model = opts.model || 'gpt-4o-mini';
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 500;
  const stream = opts.stream ?? false;

  // Build a single prompt from messages for providers that don't support chat natively
  const prompt = opts.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  if (provider === 'openai') {
    // Use existing streamText / @ai-sdk/openai provider
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY');
    }
    const providerModel = openai(model);
    const result = streamText({ model: providerModel, messages: opts.messages as any, temperature, maxOutputTokens: maxTokens });
    if (stream && typeof (result as any).toTextStreamResponse === 'function') return (result as any).toTextStreamResponse();
    if (typeof (result as any).text === 'function') {
      const text = await (result as any).text();
      return text;
    }
    return result as any;
  }

  if (provider === 'huggingface') {
    const key = process.env.HUGGINGFACE_API_KEY;
    if (!key) throw new Error('Missing HUGGINGFACE_API_KEY');
    const hfModel = model; // user should set model to HF model name
    const res = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
    });
    if (!res.ok) throw new Error(`HuggingFace API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const text = (data?.generated_text) || (Array.isArray(data) && data[0]?.generated_text) || JSON.stringify(data);
    return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
  }

  if (provider === 'ollama') {
    const base = process.env.OLLAMA_URL || 'http://localhost:11434';
    const res = await fetch(`${base}/api/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const output = data?.output;
    const text = Array.isArray(output) ? output.join('\n') : (typeof output === 'string' ? output : JSON.stringify(output));
    return new Response(text, { headers: { 'Content-Type': 'text/plain' } });
  }

  // Mock provider for development: echo last user message
  if (provider === 'mock') {
    const lastUser = opts.messages.slice().reverse().find((m) => m.role === 'user');
    const reply = lastUser ? `Mock reply: ${lastUser.content}` : 'Mock reply: hello';
    return new Response(reply, { headers: { 'Content-Type': 'text/plain' } });
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

