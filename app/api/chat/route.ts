import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // System prompt for tax consulting chatbot
    const systemPrompt = `You are a helpful tax consulting assistant specializing in tax advice, career guidance, and business registration in Vietnam and Germany. 

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

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      maxOutputTokens: 500,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
