# 🤖 RAG-Integrated Chatbot for ERGO Tax Consulting

## 📋 Quick Summary

Hệ thống chatbot đã được tích hợp với **RAG (Retrieval-Augmented Generation)** để cải thiện độ chính xác khi trả lời các câu hỏi liên quan đến sản phẩm bảo hiểm ERGO và tư vấn thuế.

### Điểm Chính Cải Thiện:
✅ **Retrieval**: Tự động tìm tài liệu ERGO liên quan  
✅ **Accuracy**: Câu trả lời dựa trên tài liệu chính thức  
✅ **Transparency**: Hiển thị sources cho mỗi response  
✅ **Multilingual**: Hỗ trợ Tiếng Đức, Anh, Việt  
✅ **Smart Filtering**: Chỉ lấy documents khi query liên quan đến ERGO  

---

## 🚀 Getting Started

### 1. Environment Setup

Thêm vào `.env.local`:

```bash
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### 2. Install & Run

```bash
npm install
npm run dev
```

### 3. Test Chatbot

- Mở http://localhost:3000
- Click chat button ở góc dưới phải
- Ghi câu hỏi về ERGO hoặc thuế

---

## 📁 New Files Added

```
lib/
├── ergo-retriever.ts      ← Core RAG retrieval logic
├── rag-utils.ts           ← Advanced scoring & utilities
├── prompt-templates.ts    ← Multilingual prompts
└── rag.test.ts            ← Test suite

app/api/chat/
└── route.ts               ← Updated with RAG integration

components/chatbot/
├── ChatBot.tsx            ← No changes
└── ChatWindow.tsx         ← Shows RAG sources

data/
├── ergo_docs.json         ← ERGO documents (chunks)
└── ergo_prompt.json       ← Metadata

docs/
├── RAG_SETUP.md           ← Full documentation
└── RAG_EXAMPLES.md        ← Usage examples
```

---

## 🔍 How It Works

### User Asks Question in Chatbot
```
"ERGO Krankenversicherung - welche Zusatzleistungen?"
```

### Backend Processing

1. **Detect Language** → German
2. **Check ERGO Relevance** → ✓ Yes (contains "ERGO" + "Krankenversicherung")
3. **Retrieve Documents** → Load top 3 relevant from `ergo_docs.json`
4. **Format Context** → Prepare documents for AI
5. **Call Azure OpenAI** → With context injected in system prompt
6. **Return Response** → With source citations

### Frontend Display
```
Assistant: "Die ERGO Krankenversicherung bietet..."

📚 Quellen (ERGO Dokumentation):
  • ERGO_products_data/health/50076048-KV...
    "Informationen über die DKV und EKV..."
  
  • ERGO_products_data/health/...
    "Details zu den Zusatzleistungen..."
```

---

## 🎯 Key Features

### 1. Smart Document Retrieval
- Scans user query for ERGO-related keywords
- Uses BM25-like relevance scoring
- Supports German compound words

### 2. Multi-Language Support
Automatically detects and responds in:
- 🇩🇪 **Deutsch** (German)
- 🇬🇧 **English**
- 🇻🇳 **Tiếng Việt** (Vietnamese)

### 3. Relevance Scoring Algorithm
```
Score = (exact_matches × 10) + (partial_matches × 3) + log(doc_length)
```

### 4. Transparent Sourcing
Each response shows:
- Which documents were used
- File names and chunks
- Relevance preview

---

## 📝 Example Queries

### German
```
"Wie kann ich mit ERGO vorsorgen?"
→ Retrieves: Pension/Altersvorsorge documents
→ Response in German

"ERGO Sachversicherung für mein Haus"
→ Retrieves: Property insurance documents
→ Response in German
```

### English
```
"Tell me about ERGO insurance products"
→ Retrieves: All relevant ERGO docs
→ Response in English
```

### Vietnamese
```
"ERGO có các sản phẩm bảo hiểm nào?"
→ Retrieves: Relevant ERGO documents
→ Response in Vietnamese
```

---

## 🧪 Testing

### Run Test Suite
```bash
npx ts-node lib/rag.test.ts
```

### What Gets Tested
- Language detection (DE/EN/VI)
- ERGO relevance checking
- Document retrieval
- Relevance scoring
- System prompt generation
- Full RAG flow
- Error handling

---

## 🔧 Configuration

### Adjust RAG Parameters

In `ergo-retriever.ts`:
```typescript
// Change number of documents to retrieve
const documents = await retrieveErgoDocuments(query, 5); // Default: 3

// In chat route:
const ragDocuments = await retrieveErgoDocuments(lastUserMessage.content, 5);
```

### Adjust Max Tokens

In `app/api/chat/route.ts`:
```typescript
body: JSON.stringify({
  messages,
  max_tokens: 2000,  // Adjust as needed (default: 1500)
  temperature: 0.7,
})
```

---

## ⚙️ System Requirements

- **Node.js**: 18+
- **Next.js**: 15.0+
- **Azure OpenAI**: Access to gpt-4 deployment
- **ERGO Documents**: `data/ergo_docs.json` file

---

## 📊 Performance

- **First Load**: ~100-200ms (loads and caches ERGO docs)
- **Subsequent Queries**: ~50-100ms (retrieval only)
- **Azure OpenAI API**: ~2-5s (depends on API)
- **Total Response**: ~3-7 seconds

---

## 🐛 Troubleshooting

### Problem: "Missing AZURE_OPENAI_API_KEY"
**Solution**: Check `.env.local` has all required variables

### Problem: No documents retrieved
**Solution**: 
- Query must contain ERGO-related keywords
- Check `isErgoRelated()` in `rag-utils.ts`
- Try: "ERGO Versicherung" instead of just "insurance"

### Problem: Wrong language response
**Solution**:
- Language detection is automatic
- If wrong, query might have mixed languages
- Start query in one language

### Problem: API rate limit
**Solution**:
- Reduce `max_tokens` in route.ts
- Add request throttling in frontend
- Check Azure subscription limits

---

## 🚀 Future Enhancements

1. **Vector Embeddings**: Use semantic search instead of keyword matching
2. **Caching**: Cache RAG results for common queries
3. **Analytics**: Track which documents are used most
4. **Fine-tuning**: Improve Azure OpenAI prompts based on feedback
5. **Context Memory**: Keep conversation history for better responses
6. **Document Classification**: Auto-categorize ERGO documents

---

## 📚 Documentation

- **[RAG_SETUP.md](./RAG_SETUP.md)** - Full technical documentation
- **[RAG_EXAMPLES.md](./RAG_EXAMPLES.md)** - Usage examples & flow diagrams
- **[rag.test.ts](./lib/rag.test.ts)** - Test cases & examples

---

## 🛠️ Code Structure

### Core Files

**`ergo-retriever.ts`**
```typescript
- loadErgoDocs()                      // Load from JSON cache
- retrieveErgoDocuments(query, topK)  // Main retrieval function
- formatRetrievedContext()            // Format for prompts
```

**`rag-utils.ts`**
```typescript
- calculateAdvancedRelevance()        // Scoring algorithm
- isErgoRelated(query)                // Check relevance
- formatDocumentText()                // Truncate text
- detectLanguage()                    // Language detection
```

**`prompt-templates.ts`**
```typescript
- createSystemMessage()               // Build system prompt
- detectLanguage()                    // Language detection
- getSystemPrompt()                   // Get template by language
```

**`app/api/chat/route.ts`**
```typescript
- POST()                              // Main endpoint
- handleDebugMode()                   // Fallback handling
- handleRegularChat()                 // Regular requests
```

---

## 🎓 Learning Resources

### How RAG Works
1. **Retrieval**: Find relevant documents based on query
2. **Augmentation**: Add documents to AI context
3. **Generation**: AI generates response using augmented context

### Why RAG for ERGO?
- ✅ Accurate information from official documents
- ✅ Reduces hallucinations
- ✅ Transparent sourcing
- ✅ Easy to update with new documents

---

## 📞 Support

For issues or questions:
1. Check [RAG_SETUP.md](./RAG_SETUP.md) troubleshooting
2. Review test cases in `rag.test.ts`
3. Check Azure OpenAI logs for API errors
4. Verify `ergo_docs.json` exists and is valid

---

## 📄 License

Same as main project

---

**Version**: 1.0  
**Last Updated**: 2025-11-06  
**Status**: ✅ Production Ready

