import { NextRequest, NextResponse } from "next/server";
import { retrieveErgoDocuments, formatRetrievedContext } from "@/lib/ergo-retriever";
import { createSystemMessage } from "@/lib/prompt-templates";

/**
 * Azure OpenAI API Configuration from environment variables
 */
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION;

/**
 * Validate environment variables
 */
function validateEnvironment(): string | null {
  if (!AZURE_OPENAI_API_KEY) {
    return "Missing AZURE_OPENAI_API_KEY";
  }
  if (!AZURE_OPENAI_ENDPOINT) {
    return "Missing AZURE_OPENAI_ENDPOINT";
  }
  if (!AZURE_OPENAI_DEPLOYMENT_NAME) {
    return "Missing AZURE_OPENAI_DEPLOYMENT_NAME";
  }
  if (!AZURE_OPENAI_API_VERSION) {
    return "Missing AZURE_OPENAI_API_VERSION";
  }
  return null;
}

/**
 * Convert message from AI SDK format to Azure OpenAI format
 * @param message - Message from @ai-sdk/react
 * @returns Converted message for Azure OpenAI API
 */
function convertMessage(message: any): { role: string; content: string } {
  // Handle @ai-sdk/react format
  if (message.parts && Array.isArray(message.parts)) {
    const content = message.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
    return {
      role: message.role,
      content,
    };
  }

  // Handle direct format { role, content }
  if (message.content) {
    return {
      role: message.role,
      content: message.content,
    };
  }

  // Fallback
  return {
    role: message.role || "user",
    content: String(message.content || ""),
  };
}


/**
 * POST handler for Chat requests with RAG integration
 */
export async function POST(req: NextRequest) {
  try {
    // Validate environment variables
    const envError = validateEnvironment();
    if (envError) {
      console.error(`[chat/route] ${envError}`);
      return NextResponse.json({ error: envError }, { status: 500 });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.error("[chat/route] Invalid JSON body", err);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Handle debug mode (for fallback in frontend)
    if (body.debug && body.text) {
      const userMessage = body.text;

      // Retrieve relevant ERGO documents
      const ragDocuments = await retrieveErgoDocuments(userMessage, 3);
      const ragContext = formatRetrievedContext(ragDocuments);

      // Create system prompt
      const systemPrompt = createSystemMessage(userMessage, ragContext);

      // Create messages for Azure OpenAI (proper format only)
      const messages = [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ];

      console.log("[chat/route] Debug mode - messages:", JSON.stringify(messages, null, 2));

      // Call Azure OpenAI API
      const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY || "",
        },
        body: JSON.stringify({
          messages,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[chat/route] Azure OpenAI API error:", errorData);
        return NextResponse.json(
          { error: "Failed to get response from AI" },
          { status: response.status }
        );
      }

      const data = await response.json();
      const reply =
        data.choices?.[0]?.message?.content || "Không thể lấy được phản hồi";

      console.log("[chat/route] Debug response:", reply.substring(0, 100));

      const formattedRagDocs = ragDocuments
        .filter(
          (doc) =>
            doc &&
            typeof doc === "object" &&
            doc.file &&
            doc.text
        )
        .map((doc) => {
          const fileName = String(doc.file || "Unknown");
          const summary = (doc.text || "").slice(0, 300).trim();

          return {
            id: doc.id || "",
            file: fileName,
            chunkIndex: doc.chunkIndex || 0,
            summary: summary || "No summary available",
          };
        });

      return NextResponse.json({
        reply,
        ragSnippets: formattedRagDocs.map((doc) => ({
          id: doc.id,
          file: doc.file,
          chunkIndex: doc.chunkIndex,
          text: doc.summary,
        })),
        ragDocuments: formattedRagDocs,
      });
    }

    // Validate messages format
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      console.error("[chat/route] Invalid messages format", body);
      return NextResponse.json(
        { error: "Missing or invalid messages array in request body" },
        { status: 400 }
      );
    }

    console.log(`[chat/route] Incoming messages count: ${body.messages.length}`);
    if (body.messages.length > 0) {
      console.log(`[chat/route] First message:`, body.messages[0]);
    }

    // Convert messages to Azure OpenAI format
    const convertedMessages = body.messages.map(convertMessage);

    // Extract user's last message for RAG retrieval
    const lastUserMessage = convertedMessages
      .slice()
      .reverse()
      .find((m: { role: string; content: string }) => m.role === "user");

    let ragContext = "";
    let ragDocuments: any[] = [];

    if (lastUserMessage && lastUserMessage.content) {
      console.log("[chat/route] Last user message:", lastUserMessage.content.substring(0, 50));

      // Retrieve relevant ERGO documents based on user's message
      ragDocuments = await retrieveErgoDocuments(lastUserMessage.content, 3);
      console.log(`[chat/route] RAG snippets count: ${ragDocuments.length}`);

      ragContext = formatRetrievedContext(ragDocuments);
    }

    // Create system prompt with RAG context
    const systemPrompt =
      lastUserMessage && lastUserMessage.content
        ? createSystemMessage(lastUserMessage.content, ragContext)
        : createSystemMessage("");

    // Build final messages with system prompt and all previous messages
    // Keep the full conversation history for better context
    const messagesWithSystem = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...convertedMessages,
    ];

    console.log(`[chat/route] Sending ${messagesWithSystem.length} messages to Azure OpenAI`);

    // Build Azure OpenAI API URL
    const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

    // Call Azure OpenAI API
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY || "",
      },
      body: JSON.stringify({
        messages: messagesWithSystem,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.text();
      console.error("[chat/route] Azure OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "Failed to get response from AI service" },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log("[chat/route] Got response from Azure OpenAI");

    // Add RAG metadata to response
    const formattedRagDocuments = ragDocuments
      .filter(
        (doc) =>
          doc &&
          typeof doc === "object" &&
          doc.file &&
          doc.text
      )
      .map((doc) => {
        // Ensure file name is clean
        const fileName = String(doc.file || "Unknown");
        const summary = (doc.text || "").slice(0, 300).trim();

        return {
          id: doc.id || "",
          file: fileName,
          chunkIndex: doc.chunkIndex || 0,
          summary: summary || "Keine Zusammenfassung verfügbar",
        };
      });


    return NextResponse.json({
      ...data,
      ragDocuments: formattedRagDocuments,
    });
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET handler (optional - for health check)
 */
export async function GET() {
  return NextResponse.json({ message: "Chat API is running" });
}

