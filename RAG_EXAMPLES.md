
[Document 1 content...]
[Document 2 content...]
[Document 3 content...]

---

Wichtigste Richtlinien:
1. Antworte immer in der Sprache des Nutzers
2. Beziehe dich auf die bereitgestellte ERGO-Dokumentation wenn relevant
3. Zitiere oder paraphrasiere relevante Passagen aus den Dokumenten
4. Wenn gefragt zu Themen außerhalb der Dokumentation, sage das explicitly
5. Bei komplexen Steuerfragen empfehle einen zertifizierten Steuerberater
6. Sei professionell, freundlich und genaue`;

const englishSystemPrompt = `You are a helpful assistant specialized in tax consulting and ERGO insurance products.
You are fluent in German, English, and Vietnamese.

IMPORTANT: You have access to ERGO documentation below. Use it to answer questions accurately.

## Relevant ERGO Documentation

Use the following information from ERGO documents to answer:

[Document 1 content...]
[Document 2 content...]
[Document 3 content...]

---

Key guidelines:
1. Always respond in the user's language
2. Reference the ERGO documentation provided when relevant
3. Quote or paraphrase relevant sections from the documentation
4. If asked about topics not covered in the documentation, say so explicitly
5. For complex tax matters, suggest consulting a certified tax advisor
6. Be professional, friendly, and accurate`;

const vietnameseSystemPrompt = `Bạn là một trợ lý hữu ích chuyên về tư vấn thuế và sản phẩm bảo hiểm ERGO.
Bạn nói thành thạo Tiếng Đức, Tiếng Anh và Tiếng Việt.

QUAN TRỌNG: Bạn có quyền truy cập tài liệu ERGO (dưới đây). Sử dụng nó để trả lời chính xác.

## Tài liệu ERGO Liên quan

Sử dụng thông tin sau từ tài liệu ERGO để trả lời:

[Nội dung tài liệu 1...]
[Nội dung tài liệu 2...]
[Nội dung tài liệu 3...]

---

Hướng dẫn chính:
1. Luôn trả lời bằng ngôn ngữ người dùng
2. Tham khảo tài liệu ERGO được cung cấp khi liên quan
3. Trích dẫn hoặc diễn giải lại các phần liên quan từ tài liệu
4. Nếu được hỏi về các chủ đề không được đề cập trong tài liệu, hãy nói rõ điều đó
5. Đối với các câu hỏi thuế phức tạp, hãy gợi ý tham khảo ý kiến cố vấn thuế được chứng chỉ
6. Hãy chuyên nghiệp, thân thiện và chính xác`;

// ============================================
// Document Retrieval Flow
// ============================================

/*
Step 1: Load cached ERGO documents
- On first load: Read from ergo_docs.json
- Cache in memory for faster subsequent loads

Step 2: Calculate relevance scores
- For each document chunk:
  - Count keyword matches (exact word boundaries)
  - Count term frequency (partial matches)
  - Calculate document length factor
  - Total Score = (matches × 10) + (frequency × 3) + log(length)

Step 3: Sort and select top K
- Sort all scored documents by score descending
- Return top 3 (or configurable K value)

Step 4: Format for context
- Truncate each document to 600 characters
- Add source file information
- Create readable context block

Step 5: Inject into system prompt
- Combine base system prompt with RAG context
- Add specific instructions for using the documents
- Send to Azure OpenAI API
*/

// ============================================
// Key Features
// ============================================

/*
✓ Automatic Language Detection
  - Detects German, English, Vietnamese
  - Responds in the user's language

✓ Smart RAG Filtering
  - Only retrieves documents if query is ERGO-related
  - Non-ERGO queries still get answered but without context

✓ Multilingual System Prompts
  - Complete prompts in each language
  - Instruction clarity in user's language

✓ Advanced Relevance Scoring
  - BM25-like algorithm
  - Handles German compound words
  - Prefers longer, more detailed content

✓ Caching & Performance
  - ERGO docs cached after first load
  - Fast retrieval for subsequent requests

✓ Transparent Sourcing
  - RAG documents displayed to user
  - Shows which ERGO files were used
  - Builds trust in responses
*/
/**
 * Example usage of the RAG-integrated chatbot
 * 
 * This file demonstrates how the RAG system works with different queries
 */

// ============================================
// Example 1: German query about health insurance
// ============================================

const germanQuery = "Welche Zusatzleistungen bietet die ERGO Krankenversicherung?";

// Expected flow:
// 1. detectLanguage("Welche Zusatzleistungen...") → "de" (German)
// 2. isErgoRelated("Welche Zusatzleistungen...") → true (contains "ERGO" + "Krankenversicherung")
// 3. retrieveErgoDocuments("Welche Zusatzleistungen...") → returns [
//    { id: "50076048-KV...", file: "ERGO_products_data/health/50076048-KV...", text: "..." },
//    { id: "...", ... },
//    { id: "...", ... }
// ]
// 4. createSystemMessage(query, ragContext) → returns German system prompt with retrieved documents
// 5. Azure OpenAI gọi với messages:
//    [
//      { role: "system", content: "Du bist ein hilfreicher Assistent... [ERGO Documents]" },
//      { role: "user", content: "Welche Zusatzleistungen bietet die ERGO Krankenversicherung?" }
//    ]
// 6. Response: Detailed answer about ERGO health insurance with sources

// ============================================
// Example 2: English query about pension
// ============================================

const englishQuery = "Tell me about ERGO pension products";

// Expected flow:
// 1. detectLanguage("Tell me about ERGO pension...") → "en" (English)
// 2. isErgoRelated("Tell me about ERGO pension...") → true (contains "ERGO" + "pension")
// 3. retrieveErgoDocuments("Tell me about ERGO pension...") → returns pension documents
// 4. createSystemMessage(query, ragContext) → English system prompt
// 5. Azure OpenAI response in English with sources from pension product files

// ============================================
// Example 3: Vietnamese query about taxes
// ============================================

const vietnameseQuery = "ERGO có cung cấp các sản phẩm bảo hiểm về thuế không?";

// Expected flow:
// 1. detectLanguage("ERGO có cung cấp...") → "vi" (Vietnamese)
// 2. isErgoRelated(...) → true (contains "ERGO" + "bảo hiểm")
// 3. retrieveErgoDocuments(...) → returns relevant documents
// 4. createSystemMessage(...) → Vietnamese system prompt
// 5. Azure OpenAI response in Vietnamese

// ============================================
// Example 4: Non-ERGO related query
// ============================================

const nonErgoQuery = "What's the capital of France?";

// Expected flow:
// 1. detectLanguage("What's the capital...") → "en"
// 2. isErgoRelated("What's the capital...") → FALSE
// 3. retrieveErgoDocuments(...) → returns [] (empty array)
// 4. createSystemMessage(query, "") → base system prompt WITHOUT RAG context
// 5. Azure OpenAI responds without ERGO context
// 6. Response: General answer about France (not relevant to ERGO)

// ============================================
// API Response Examples
// ============================================

// Successful response with RAG documents:
const successResponse = {
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Die ERGO Krankenversicherung bietet umfangreiche Zusatzleistungen...",
      },
      finish_reason: "stop",
    },
  ],
  ragDocuments: [
    {
      id: "50076048-KV Zusatzmappe_DKV und EKV_01.2026::0",
      file: "ERGO_products_data/health/50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
      chunkIndex: 0,
      summary:
        "Informationen über die DKV und EKV Zusatzversicherungen der ERGO...",
    },
    {
      id: "50076048-KV Zusatzmappe_DKV und EKV_01.2026::1",
      file: "ERGO_products_data/health/50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
      chunkIndex: 1,
      summary: "Details zu den Zusatzleistungen und Deckungsumfang...",
    },
  ],
};

// Frontend display logic for RAG documents:
/*
const renderRagSources = (ragDocuments) => {
  return (
    <div className="mt-3 text-xs text-gray-600 border-t pt-2">
      <div className="font-semibold text-gray-700 mb-2">📚 Quellen (ERGO Dokumentation):</div>
      <div className="space-y-2">
        {ragDocuments.map((doc, i) => (
          <div key={i} className="bg-white rounded p-2 border border-gray-200">
            <div className="text-xs font-medium text-blue-600">{doc.file}</div>
            <div className="text-xs text-gray-600 mt-1">{doc.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
*/

// ============================================
// Testing the Relevance Scoring
// ============================================

/*
Test Case 1: ERGO Altersvorsorge
Query: "Wie kann ich meine Altersvorsorge mit ERGO planen?"
Expected Matches:
- "ERGO" (exact) → 10 points
- "Altersvorsorge" (exact) → 10 points
- "Altersvorsorge" (partial) in document
- "vorsorge", "plan", "ergo" variations

Relevance Score High ✓

Test Case 2: ERGO Sachversicherung
Query: "Versicherungen für mein Eigenheim"
Expected Matches:
- "Versicherung" (exact) → 10 points
- "Eigenheim", "Haus", "Haus" (partial matches)
- Document length factor

Relevance Score Medium to High ✓

Test Case 3: Unrelated Query
Query: "Wie macht man Pizza?"
Expected Matches: NONE
Relevance Score: 0 → Returns empty array ✓
*/

// ============================================
// Multi-language System Prompts
// ============================================

const germanSystemPrompt = `Du bist ein hilfreicher Assistent für Steuerconsulting und ERGO-Versicherungsprodukte.
Du sprichst fließend Deutsch, Englisch und Vietnamesisch.

WICHTIG: Du hast Zugang zu ERGO-Dokumentation (unten). Nutze diese zur genauen Beantwortung.

## Relevante ERGO Dokumentation

Nutze folgende Informationen aus den ERGO Dokumenten zur Beantwortung:

