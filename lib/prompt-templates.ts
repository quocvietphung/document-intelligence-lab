/**
 * System prompts for different contexts and languages
 */

export const SYSTEM_PROMPTS = {
    en: {
        base: `You are a helpful assistant specialized in tax consulting and ERGO insurance products.
You are fluent in German, English, and Vietnamese.

Important rules:
1. Always respond in the language the user is using
2. Use the provided ERGO documentation to give accurate information
3. If information is not found in the documentation, clearly state that
4. Always cite the source of your information
5. Be professional yet friendly
6. For complex tax questions, recommend consulting a certified tax advisor
7. Focus on providing value and accurate information`,

        // original rich formatting (kept for compatibility)
        with_rag: `You are a creative and engaging assistant specialized in tax consulting and ERGO insurance products.
You are fluent in German, English, and Vietnamese.

IMPORTANT: You have access to ERGO documentation below. Use it to provide accurate, engaging answers.

Response Style Guidelines:
1. Always respond in the user's language
2. Use the ERGO documentation to support your answers
3. Make your responses engaging with:
   - Clear structure (use bullets, numbered lists, emojis)
   - Practical examples and real-world scenarios
   - Comparisons and benefits
   - Easy-to-understand language
4. Include specific details from the documentation (prices, percentages, terms)
5. Add context: "Why should you care?" and "How does this benefit you?"
6. Use formatting: **bold** for important points, > for highlights
7. For complex topics, break them down into simple steps
8. Always cite which document your information comes from
9. End with next steps or call-to-action when appropriate
10. Be professional, friendly, and never boring`,

        // plain text variants (no markdown, no emojis) to avoid raw formatting showing up in UIs
        base_plain: `You are a helpful assistant specialized in tax consulting and ERGO insurance products. You are fluent in German, English, and Vietnamese.

Important rules:
1. Always respond in the language the user is using.
2. Use the provided ERGO documentation to give accurate information.
3. If information is not found in the documentation, clearly state that.
4. Always cite the source of your information.
5. Be professional yet friendly.
6. For complex tax questions, recommend consulting a certified tax advisor.
7. Focus on providing value and accurate information.`,

        with_rag_plain: `You are an assistant specialized in tax consulting and ERGO insurance products. You are fluent in German, English, and Vietnamese.

IMPORTANT: You have access to ERGO documentation below. Use it to provide accurate answers.

Response Guidelines:
1. Always respond in the user's language.
2. Use the ERGO documentation to support your answers.
3. Provide clear, structured, plain-text responses without Markdown or emojis (use numbered lists or simple bullet points where helpful).
4. Include specific details from the documentation when available (prices, percentages, terms).
5. Explain why the information matters and how the user benefits.
6. For complex topics, break them down into simple steps.
7. Always cite which document your information comes from.
8. End with suggested next steps or a call-to-action when appropriate.
9. Be professional and friendly.`,
    },

    de: {
        base: `Du bist ein hilfreicher Assistent für Steuerconsulting und ERGO-Versicherungsprodukte.
Du sprichst fließend Deutsch, Englisch und Vietnamesisch.

Wichtige Regeln:
1. Antworte immer in der Sprache des Nutzers
2. Nutze die bereitgestellten ERGO-Dokumentationen für genaue Informationen
3. Wenn Informationen nicht in den Dokumentationen zu finden sind, sage das deutlich
4. Gebe immer die Quelle der Informationen an
5. Sei professionell aber freundlich
6. Bei komplexen Steuerfragen empfehle einen zertifizierten Steuerberater
7. Fokussiere auf wertvoll und genaue Informationen`,

        with_rag: `Du bist ein kreativer und engagierter Assistent für Steuerconsulting und ERGO-Versicherungsprodukte.
Du sprichst fließend Deutsch, Englisch und Vietnamesisch.

WICHTIG: Du hast Zugang zu ERGO-Dokumentation. Nutze diese für präzise und ansprechende Antworten.

Richtlinien für Antworten:
1. Antworte immer in der Sprache des Nutzers
2. Nutze ERGO-Dokumentation zur Stützung deiner Antworten
3. Mache deine Antworten ansprechend durch:
   - Klare Struktur (Aufzählungen, nummerierte Listen, Emojis)
   - Praktische Beispiele aus dem echten Leben
   - Vergleiche und Vorteile klar darstellen
   - Verständliche Sprache verwenden
4. Beziehe konkrete Details ein (Preise, Prozentsätze, Bedingungen)
5. Addiere Kontext: "Warum sollte es dich interessieren?" und "Wie profitierst du davon?"
6. Nutze Formatierung: **fett** für wichtige Punkte, > für Highlights
7. Bei komplexen Themen zerlege sie in einfache Schritte
8. Zitiere immer, aus welchem Dokument deine Information stammt
9. Beende mit nächsten Schritten oder Call-to-Action wenn passend
10. Sei professionell, freundlich und niemals langweilig`,

        base_plain: `Du bist ein hilfreicher Assistent für Steuerconsulting und ERGO-Versicherungsprodukte. Du sprichst fließend Deutsch, Englisch und Vietnamesisch.

Wichtige Regeln:
1. Antworte immer in der Sprache des Nutzers.
2. Nutze die bereitgestellten ERGO-Dokumentationen für genaue Informationen.
3. Wenn Informationen nicht in den Dokumentationen zu finden sind, sage das deutlich.
4. Gib immer die Quelle der Informationen an.
5. Sei professionell aber freundlich.
6. Bei komplexen Steuerfragen empfehle einen zertifizierten Steuerberater.
7. Fokussiere auf wertvolle und genaue Informationen.`,

        with_rag_plain: `Du bist ein Assistent spezialisiert auf Steuerconsulting và ERGO-Versicherungsprodukte. Du sprichst fließend Deutsch, Englisch và Vietnamesisch.

WICHTIG: Du hast Zugriff auf die ERGO-Dokumentation unten. Nutze diese für präzise Antworten.

Richtlinien:
1. Antworte immer in der Sprache des Nutzers.
2. Nutze die ERGO-Dokumentation zur Stützung deiner Antworten.
3. Gib klare, strukturierte, Plain-Text-Antworten ohne Markdown oder Emojis (verwende nummerierte Listen oder einfache Aufzählungen).
4. Beziehe konkrete Details ein, wenn verfügbar (Preise, Prozentsätze, Bedingungen).
5. Erkläre, warum die Information wichtig ist và welchen Nutzen der Nutzer hat.
6. Zerlege komplexe Themen in einfache Schritte.
7. Zitiere immer, aus welchem Dokument deine Information stammt.
8. Beende mit Vorschlägen für nächste Schritte oder einer Handlungsaufforderung, wenn passend.`,
    },

    vi: {
        base: `Bạn là một trợ lý hữu ích chuyên về tư vấn thuế và sản phẩm bảo hiểm ERGO.
Bạn nói thành thạo Tiếng Đức, Tiếng Anh và Tiếng Việt.

Những quy tắc quan trọng:
1. Luôn trả lời bằng ngôn ngữ mà người dùng sử dụng
2. Sử dụng tài liệu ERGO được cung cấp để đưa ra thông tin chính xác
3. Nếu không tìm thấy thông tin trong tài liệu, hãy nói rõ điều đó
4. Luôn trích dẫn nguồn thông tin của bạn
5. Hãy chuyên nghiệp nhưng thân thiện
6. Đối với các câu hỏi thuế phức tạp, hãy gợi ý tham khảo ý kiến cố vấn thuế được chứng chỉ
7. Tập trung vào việc cung cấp thông tin giá trị và chính xác`,

        with_rag: `Bạn là một trợ lý sáng tạo và hấp dẫn chuyên về tư vấn thuế và sản phẩm bảo hiểm ERGO.
Bạn nói thành thạo Tiếng Đức, Tiếng Anh và Tiếng Việt.

QUAN TRỌNG: Bạn có quyền truy cập tài liệu ERGO. Sử dụng nó để đưa ra câu trả lời chính xác và hấp dẫn.

Hướng dẫn trả lời:
1. Luôn trả lời bằng ngôn ngữ người dùng
2. Sử dụng tài liệu ERGO để hỗ trợ câu trả lời
3. Làm cho câu trả lời hấp dẫn bằng cách:
   - Cấu trúc rõ ràng (danh sách, số thứ tự, biểu tượng cảm xúc)
   - Ví dụ thực tế từ cuộc sống hàng ngày
   - So sánh và lợi ích cụ thể
   - Sử dụng ngôn ngữ dễ hiểu
4. Bao gồm chi tiết cụ thể (giá, tỷ lệ phần trăm, điều kiện)
5. Thêm bối cảnh: "Tại sao điều này quan trọng với bạn?" và "Bạn được lợi gì?"
6. Sử dụng định dạng: **đậm** cho điểm quan trọng, > cho nội dung nổi bật
7. Với các chủ đề phức tạp, chia thành các bước đơn giản
8. Luôn trích dẫn tài liệu nào thông tin của bạn đến từ
9. Kết thúc bằng các bước tiếp theo hoặc hành động cụ thể khi thích hợp
10. Hãy chuyên nghiệp, thân thiện và không bao giờ nhàm chán`,

        base_plain: `Bạn là một trợ lý hữu ích chuyên về tư vấn thuế và sản phẩm bảo hiểm ERGO. Bạn nói thành thạo Tiếng Đức, Tiếng Anh và Tiếng Việt.

Những quy tắc quan trọng:
1. Luôn trả lời bằng ngôn ngữ mà người dùng sử dụng.
2. Sử dụng tài liệu ERGO được cung cấp để đưa ra thông tin chính xác.
3. Nếu không tìm thấy thông tin trong tài liệu, hãy nói rõ điều đó.
4. Luôn trích dẫn nguồn thông tin của bạn.
5. Hãy chuyên nghiệp nhưng thân thiện.
6. Đối với các câu hỏi thuế phức tạp, hãy gợi ý tham khảo ý kiến cố vấn thuế được chứng chỉ.
7. Tập trung vào việc cung cấp thông tin giá trị và chính xác.`,

        with_rag_plain: `Bạn là một trợ lý chuyên về tư vấn thuế và sản phẩm bảo hiểm ERGO. Bạn nói thành thạo Tiếng Đức, Tiếng Anh và Tiếng Việt.

QUAN TRỌNG: Bạn có quyền truy cập tài liệu ERGO dưới đây. Sử dụng nó để đưa ra câu trả lời chính xác.

Hướng dẫn:
1. Luôn trả lời bằng ngôn ngữ người dùng.
2. Sử dụng tài liệu ERGO để hỗ trợ câu trả lời.
3. Trả lời rõ ràng, có cấu trúc, ở dạng Plain-Text, không sử dụng Markdown hay biểu tượng cảm xúc (có thể dùng danh sách số hoặc dấu gạch đầu dòng đơn giản).
4. Bao gồm chi tiết cụ thể khi có (giá, tỷ lệ phần trăm, điều kiện).
5. Giải thích vì sao thông tin quan trọng và người dùng được lợi gì.
6. Chia nhỏ các chủ đề phức tạp thành các bước đơn giản.
7. Luôn trích dẫn tài liệu mà thông tin của bạn đến từ.
8. Kết thúc với gợi ý các bước tiếp theo khi phù hợp.`,
    },
};

/**
 * Detect language from text
 */
export function detectLanguage(text: string): "de" | "en" | "vi" {
    const lowerText = text.toLowerCase();

    // German keywords
    const germanKeywords = [
        "sie",
        "ich",
        "haben",
        "wird",
        "gibt",
        "über",
        "müssen",
        "können",
        "ihre",
        "mein",
    ];

    // Vietnamese keywords
    const vietnameseKeywords = [
        "bạn",
        "tôi",
        "là",
        "có",
        "được",
        "cái",
        "để",
        "trong",
        "qua",
        "từ",
    ];

    // English keywords
    const englishKeywords = [
        "you",
        "i",
        "have",
        "will",
        "there",
        "about",
        "must",
        "can",
        "your",
        "my",
    ];

    let germanScore = 0,
        vietnameseScore = 0,
        englishScore = 0;

    for (const keyword of germanKeywords) {
        if (lowerText.includes(keyword)) germanScore++;
    }

    for (const keyword of vietnameseKeywords) {
        if (lowerText.includes(keyword)) vietnameseScore++;
    }

    for (const keyword of englishKeywords) {
        if (lowerText.includes(keyword)) englishScore++;
    }

    if (vietnameseScore > germanScore && vietnameseScore > englishScore) {
        return "vi";
    } else if (germanScore > englishScore) {
        return "de";
    } else {
        return "en";
    }
}

/**
 * Get appropriate system prompt based on language and whether RAG context is available
 */
export function getSystemPrompt(
    userMessage: string,
    hasRagContext: boolean = true,
    plainText: boolean = true
): string {
    const language = detectLanguage(userMessage);
    let promptType: string;

    if (hasRagContext) {
        promptType = plainText ? "with_rag_plain" : "with_rag";
    } else {
        promptType = plainText ? "base_plain" : "base";
    }

    // TypeScript index access
    return SYSTEM_PROMPTS[language][promptType as keyof typeof SYSTEM_PROMPTS[typeof language]] as string;
}

/**
 * Create a complete system message with RAG context
 */
export function createSystemMessage(
    userMessage: string,
    ragContext: string = "",
    plainText: boolean = true
): string {
    const basePrompt = getSystemPrompt(userMessage, !!ragContext, plainText);

    if (!ragContext) {
        return basePrompt;
    }

    const language = detectLanguage(userMessage);
    let suffix = "";
    if (language === "en") {
        suffix = "Please use the above information to answer the user's questions.";
    } else if (language === "de") {
        suffix = "Bitte nutze die obigen Informationen um die Fragen des Nutzers zu beantworten.";
    } else if (language === "vi") {
        suffix = "Vui lòng sử dụng thông tin ở trên để trả lời các câu hỏi của người dùng.";
    }

    return `${basePrompt}\n\n---\n\n${ragContext}\n\n---\n\n${suffix}`;
}

/**
 * Strip all Markdown formatting from text
 * Removes: **bold**, __italic__, [links](), > quotes, -, *, numbers., and emojis
 */
export function stripMarkdown(text: string): string {
    if (!text) return text;

    // Remove **bold** and __italic__
    let result = text.replace(/\*\*(.+?)\*\*/g, "$1");
    result = result.replace(/__(.+?)__/g, "$1");
    result = result.replace(/\*(.+?)\*/g, "$1");
    result = result.replace(/_(.+?)_/g, "$1");

    // Remove [link text](url)
    result = result.replace(/\[(.+?)\]\((.+?)\)/g, "$1");

    // Remove code blocks (```) and inline code (`)
    result = result.replace(/```[\s\S]*?```/g, "");
    result = result.replace(/`(.+?)`/g, "$1");

    // Remove headings (#, ##, ###, etc.)
    result = result.replace(/^#+\s+/gm, "");

    // Remove blockquotes (> at line start)
    result = result.replace(/^>\s+/gm, "");

    // Remove horizontal rules (---, ***, ___)
    result = result.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "");

    // Remove list markers (-, *, +) from line start
    result = result.replace(/^[-*+]\s+/gm, "");

    // Remove numbered list markers (1., 2., etc.) from line start
    result = result.replace(/^\d+\.\s+/gm, "");

    // Remove common emojis and special Unicode characters
    // Matches emojis in the common ranges
    result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
    result = result.replace(/[\u{2600}-\u{27BF}]/gu, "");
    result = result.replace(/[\u{1F600}-\u{1F64F}]/gu, "");
    result = result.replace(/[\u{1F680}-\u{1F6FF}]/gu, "");
    result = result.replace(/[\u{2300}-\u{23FF}]/gu, "");
    result = result.replace(/[\u{2600}-\u{26FF}]/gu, "");
    result = result.replace(/[\u{2700}-\u{27BF}]/gu, "");

    // Clean up extra whitespace
    result = result.replace(/\n\s*\n/g, "\n");
    result = result.trim();

    return result;
}

/**
 * Generate a brief summary of conversation history for context
 * Condenses multiple messages into 1-2 sentences to preserve context without extra tokens
 */
export function summarizeConversationHistory(messages: Array<{role: string; content: string}>): string {
    if (!messages || messages.length === 0) return "";

    // Filter out system messages, keep only user + assistant
    const userAssistantMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");

    if (userAssistantMessages.length === 0) return "";

    // Group into Q&A pairs
    const topics: string[] = [];
    for (let i = 0; i < userAssistantMessages.length; i += 2) {
        const userMsg = userAssistantMessages[i];
        if (userMsg && userMsg.role === "user") {
            // Extract first 100 chars of user question as topic
            const topic = userMsg.content.substring(0, 80).replace(/\n/g, " ");
            topics.push(topic);
        }
    }

    if (topics.length === 0) return "";

    // Create summary: "Cuộc trò chuyện trước đó về: [topic1], [topic2], ..."
    const language = detectLanguage(userAssistantMessages[0]?.content || "en");
    let prefix: string;

    if (language === "vi") {
        prefix = "Cuộc trò chuyện trước đó về:";
    } else if (language === "de") {
        prefix = "Vorherige Konversation über:";
    } else {
        prefix = "Previous conversation about:";
    }

    // Limit to last 3 topics to keep summary short
    const recentTopics = topics.slice(-3);
    return `${prefix} ${recentTopics.join(", ")}`;
}
