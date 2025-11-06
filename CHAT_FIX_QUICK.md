# 🔧 QUICK FIX - Chat Message Format & Order

## Vấn Đề
```
Azure API Error: "Additional properties are not allowed ('id', 'parts' were unexpected)"
Messages không theo thứ tự (không giống ChatGPT/Messenger)
```

## Nguyên Nhân
- `@ai-sdk/react` gửi format: `{ role, id, parts: [{type, text}] }`
- Azure OpenAI chỉ nhận: `{ role, content }`

## Giải Pháp (Đã Áp Dụng)

### 1️⃣ File Thay Đổi
```
✅ app/api/chat/route.ts       → Thêm convertMessage()
✅ lib/useCustomChat.ts         → NEW (custom hook)
✅ components/chatbot/ChatWindow.tsx → Use new hook
```

### 2️⃣ Cách Hoạt Động (Mới)

```
Frontend (ChatWindow.tsx)
    ↓ dùng useCustomChat hook
    ↓ gửi { messages: [{role, content}, ...] }
    ↓
Backend (route.ts)
    ↓ nhận messages đã clean
    ↓ gọi convertMessage() để double-check
    ↓ gửi Azure OpenAI (format chính xác)
    ↓
Azure OpenAI
    ↓ trả response
    ↓
Frontend
    ↓ hiển thị messages theo thứ tự
    ↓ + RAG sources dưới mỗi response
```

## 🚀 Dùng Ngay

### Step 1: Restart dev server
```bash
npm run dev
```

### Step 2: Test chatbot
1. Click chat button (bottom right)
2. Type: "Xin chào"
3. Xem response (không error)
4. Type: "ERGO bảo hiểm gì?"
5. Xem response + sources

### Step 3: Verify
Check browser console (F12):
```
[useCustomChat] Sending messages: [...]
(Should show clean format with role + content)
```

## ✅ Expected Result

### Lúc chat:
```
User: "Xin chào"
Assistant: "Chào bạn! Tôi có thể giúp gì?"
          📚 Sources: (if ERGO-related)
          
User: "ERGO bảo hiểm gì?"
Assistant: "ERGO cung cấp..."
          📚 Sources:
             • File 1
             • File 2
             • File 3
```

### Thứ tự
- ✅ User message đầu
- ✅ Assistant response
- ✅ User message 2
- ✅ Assistant response 2
- (Không lộn xộn)

## 📝 Files to Review

**Understand the fix**:
```bash
cat FIX_CHAT_ORDER.md      # Detailed explanation
cat lib/useCustomChat.ts    # Custom hook code
cat app/api/chat/route.ts   # API conversion
```

**Test it**:
```bash
bash test-chat-api.sh       # Quick API test
```

## 🎯 Key Changes

### Before ❌
```typescript
// @ai-sdk/react format
{
  role: "user",
  id: "msg-123",
  parts: [{ type: "text", text: "Hello" }]
}
```

### After ✅
```typescript
// Azure OpenAI format
{
  role: "user",
  content: "Hello"
}
```

## 🐛 Still Getting Error?

### Check 1: Console logs
```bash
# Terminal (should show):
[chat/route] Incoming messages count: X
[chat/route] Sending X messages to Azure OpenAI
```

### Check 2: Network tab
Open browser DevTools → Network → api/chat
- Request body should have clean messages
- No 'id' or 'parts' fields

### Check 3: Azure API response
If error, check error message in console

---

**Done! Your chat is now fixed.** ✅

Just run `npm run dev` and test it!

