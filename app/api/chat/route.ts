import { NextRequest, NextResponse } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createAzureModel, getAzureConfig } from "@/lib/azure-openai";
import { buildCreditInstructions, demoAnswer, messageText } from "@/lib/credit-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

function demoStream(text: string) {
  const id = crypto.randomUUID();
  return createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "text-start", id });
      for (const word of text.split(" ")) {
        writer.write({ type: "text-delta", id, delta: `${word} ` });
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      writer.write({ type: "text-end", id });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }
    const latest = [...body.messages].reverse().find((message) => message.role === "user");
    if (!latest) return NextResponse.json({ error: "User message missing" }, { status: 400 });
    const question = messageText(latest).slice(0, 2_000);
    const { instructions } = buildCreditInstructions(question);
    const config = getAzureConfig();

    if (!config) {
      return createUIMessageStreamResponse({
        headers: { "Cache-Control": "no-store", "X-AI-Mode": "synthetic-demo" },
        stream: demoStream(demoAnswer(question)),
      });
    }

    const result = streamText({
      model: createAzureModel(config),
      instructions,
      messages: await convertToModelMessages(body.messages.slice(-10)),
      maxOutputTokens: 700,
      temperature: 0.15,
      maxRetries: 0,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]),
    });
    return createUIMessageStreamResponse({
      headers: { "Cache-Control": "no-store", "X-AI-Mode": "azure-oidc" },
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => "Nova ist gerade nicht erreichbar. Bitte erneut versuchen.",
      }),
    });
  } catch (error) {
    console.error("credit-chat-error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
