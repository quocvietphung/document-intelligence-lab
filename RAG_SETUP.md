# RAG Chatbot Integration - Hướng Dẫn Setup

## Tổng Quan

Hệ thống chatbot đã được tích hợp với **RAG (Retrieval-Augmented Generation)** để liên kết trực tiếp với tài liệu ERGO sản phẩm bảo hiểm.

## Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (ChatWindow)                     │
│                   - Hiển thị tin nhắn                       │
│                   - Gửi user messages đến API              │
│                   - Hiển thị RAG sources                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route (/api/chat/route.ts)                 │
│         - Xử lý chat requests                              │
│         - Gọi retrieveErgoDocuments()                      │
│         - Gọi Azure OpenAI API                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬────────────────┐
        ▼                         ▼                ▼
   ┌─────────────┐      ┌──────────────┐    ┌──────────────┐
   │   RAG System│      │   Prompt     │    │ Azure OpenAI │
   │             │      │   Templates  │    │   (gpt-4)    │
   │ Retrieval   │      │              │    │              │
   │ Functions   │      │ Multilingual │    │ Completions  │
   └─────────────┘      │ Support      │    │              │
        │               └──────────────┘    └──────────────┘
        ▼
   ┌─────────────────────────────────┐
   │  ERGO Data (ergo_docs.json)     │
   │  - Health Insurance Products    │
   │  - Pension/Altersvorsorge       │
   │  - Property & Casualty          │
   └─────────────────────────────────┘
```

## File Structure

```
lib/
├── ergo-retriever.ts       # Core RAG retrieval logic
├── rag-utils.ts            # Advanced relevance scoring
└── prompt-templates.ts     # Multilingual prompt templates

app/api/chat/
├── route.ts               # Main API route handler

components/chatbot/
├── ChatBot.tsx            # Chat button component
└── ChatWindow.tsx         # Chat interface with RAG sources display

data/
├── ergo_docs.json        # ERGO documents (chunks from PDFs)
└── ergo_prompt.json      # Prompt metadata
```

## Các Thành Phần Chính

### 1. **ergo-retriever.ts**
- `loadErgoDocs()`: Load tài liệu ERGO từ JSON
- `retrieveErgoDocuments(query, topK)`: Tìm kiếm tài liệu liên quan dựa trên query
- `formatRetrievedContext()`: Format tài liệu để đưa vào prompt

### 2. **rag-utils.ts**
- `calculateAdvancedRelevance()`: Tính điểm liên quan nâng cao (BM25-like)
- `isErgoRelated()`: Kiểm tra xem query có liên quan đến ERGO
- `formatDocumentText()`: Format text với độ dài hợp lý
- `detectLanguage()`: Phát hiện ngôn ngữ (German/English/Vietnamese)

### 3. **prompt-templates.ts**
- `getSystemPrompt()`: Lấy system prompt theo ngôn ngữ
- `createSystemMessage()`: Tạo message với RAG context
- `detectLanguage()`: Hỗ trợ đa ngôn ngữ (DE/EN/VI)

### 4. **app/api/chat/route.ts**
- `POST()`: Xử lý chat requests từ frontend
- `handleDebugMode()`: Xử lý fallback requests
- `handleRegularChat()`: Xử lý regular chat requests
- Tích hợp RAG để lấy context trước khi gọi Azure OpenAI

## Environment Variables (.env.local)

```bash
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

## Cách Sử Dụng

### Frontend (Client Side)
1. Người dùng click button chat
2. ChatWindow mở lên
3. User nhập câu hỏi
4. Message được gửi đến `/api/chat`

### Backend (Server Side)
1. API nhận request
2. Gọi `retrieveErgoDocuments()` để tìm tài liệu liên quan
3. Format tài liệu vào system prompt
4. Gọi Azure OpenAI API
5. Return response với RAG metadata

### Frontend (Display)
1. Hiển thị assistant response
2. Hiển thị RAG sources dưới response
3. User có thể xem tài liệu nào được sử dụng

## Ví dụ Requests

### Request 1: Chat Message
```javascript
// Frontend sends:
{
  messages: [
    { role: "user", content: "Welche Krankenversicherung bietet ERGO?" }
  ]
}

// API Returns:
{
  choices: [{ message: { content: "..." } }],
  ragDocuments: [
    {
      id: "50076048-KV...",
      file: "ERGO_products_data/health/...",
      summary: "..."
    }
  ]
}
```

### Request 2: Debug Mode (Fallback)
```javascript
// Frontend sends:
{
  debug: true,
  text: "Tell me about ERGO pension products"
}

// API Returns:
{
  reply: "...",
  ragDocuments: [...],
  ragSnippets: [...]
}
```

## Multilingual Support

Hệ thống hỗ trợ 3 ngôn ngữ:

- **Deutsch (DE)**: Prompt đầy đủ bằng Tiếng Đức
- **English (EN)**: Prompt đầy đủ bằng Tiếng Anh
- **Việt (VI)**: Prompt đầy đủ bằng Tiếng Việt

Ngôn ngữ được tự động phát hiện dựa trên nội dung user message.

## Relevance Scoring Algorithm

Hệ thống sử dụng BM25-like scoring:

```
Score = (keyword_matches × 10) + (term_frequency × 3) + log(document_length)
```

- **keyword_matches**: Exact word matches
- **term_frequency**: Partial matches (important for German compounds)
- **document_length_factor**: Bonus cho content dài hơn (more detailed)

## Performance Tips

1. **Caching**: ERGO documents được cache sau lần load đầu tiên
2. **Top K Results**: Mặc định lấy top 3 documents
3. **Context Length**: Mỗi document được giới hạn 600 characters trong context
4. **Language Detection**: Tự động phát hiện để response đúng ngôn ngữ

## Troubleshooting

### Problem: "Missing environment variables"
- **Solution**: Kiểm tra `.env.local` có tất cả biến cần thiết

### Problem: "Failed to load ERGO documents"
- **Solution**: Kiểm tra file `data/ergo_docs.json` có tồn tại

### Problem: "Azure OpenAI API error"
- **Solution**: 
  - Kiểm tra API key và endpoint
  - Kiểm tra deployment name
  - Kiểm tra API version

### Problem: "No relevant documents found"
- **Solution**: Hệ thống chỉ tìm documents khi query liên quan đến ERGO (xem `isErgoRelated()`)

## Future Enhancements

1. **Vector Embeddings**: Sử dụng OpenAI embeddings để tìm kiếm tốt hơn
2. **Semantic Search**: Tìm kiếm dựa trên ý nghĩa chứ không chỉ từ khóa
3. **Document Classification**: Phân loại documents (health, pension, property)
4. **Context Memory**: Lưu conversation history cho context tốt hơn
5. **Analytics**: Tracking queries để cải thiện retrieval

## Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
echo "AZURE_OPENAI_API_KEY=..." >> .env.local

# 3. Build ERGO documents (if PDF files updated)
npm run build:ergo-json

# 4. Start development server
npm run dev

# 5. Test chatbot at http://localhost:3000
```

## Integration with Existing Code

- ✅ ChatBot.tsx: Không thay đổi logic, chỉ render ChatWindow
- ✅ ChatWindow.tsx: Cập nhật để hiển thị RAG sources
- ✅ API route: Hoàn toàn mới, tích hợp RAG

## Notes

- Hệ thống tự động kiểm tra xem query có liên quan đến ERGO trước khi lấy documents
- Nếu không có documents liên quan, vẫn gọi Azure OpenAI nhưng không có RAG context
- Tất cả responses đều multi-language support
- RAG sources được hiển thị dưới response để user biết information từ đâu

---

**Created**: 2025-11-06
**Version**: 1.0

