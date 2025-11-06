# 📜 Scripts Guide - 2 File Quan Trọng

**Status**: ✅ **CLEAN & OPTIMIZED**  
**Kept**: 2 scripts  
**Removed**: 4 old/unused scripts

---

## 📋 **2 Scripts Quan Trọng Nhất**

### 1️⃣ **extract-all-ergo-pdfs.js** ⭐⭐⭐

**Mục đích**: Extract toàn bộ 12 PDF ERGO → 5,076 chunks → ergo_docs.json

**Khi nào sử dụng:**
- Lần đầu extract tất cả PDF
- Thêm PDF mới vào `ERGO_products_data/`
- Cập nhật dữ liệu ERGO corpus

**Cách sử dụng:**
```bash
node scripts/extract-all-ergo-pdfs.js
```

**Output:**
```
✅ Found 12 PDF files
📄 Processing: [PDF 1]...
   ✓ Extracted 2073 chunks
[... 12 PDFs ...]
✅ SUCCESS
📄 ergo_docs.json: 20.4 MB
📚 Total Chunks: 5,076
```

**File được tạo:**
- `data/ergo_docs.json` (20.4 MB - full corpus)

---

### 2️⃣ **generate-ergo-prompt.js** ⭐⭐⭐

**Mục đích**: Score 5,076 chunks → Select top-4 → ergo_prompt.json

**Khi nào sử dụng:**
- Sau extract PDF lần đầu
- Cần tối ưu RAG prompt
- Thay đổi scoring criteria

**Cách sử dụng:**
```bash
node scripts/generate-ergo-prompt.js
```

**Output:**
```
📖 Loading ergo_docs.json...
✅ Loaded 12 documents with 5076 chunks
🔍 Scoring chunks...
✅ Processed 5076 chunks
📝 Selected 4 top chunks (~15 KB)
✅ SUCCESS
📄 ergo_prompt.json: 16.5 KB
📚 Selected: 4 chunks
```

**File được tạo:**
- `data/ergo_prompt.json` (16.5 KB - optimized RAG)

---

## 🔄 **Quy Trình Hoàn Chỉnh**

```bash
# Bước 1: Extract 12 PDF
node scripts/extract-all-ergo-pdfs.js
# ↓ Tạo: data/ergo_docs.json (20.4 MB, 5,076 chunks)

# Bước 2: Generate optimized prompt
node scripts/generate-ergo-prompt.js
# ↓ Tạo: data/ergo_prompt.json (16.5 KB, top-4 chunks)

# Bước 3: Build & test
npm run build
npm run dev

# Bước 4: Test chatbot
# Hỏi: "Chi tiết về bảo hiểm du lịch ERGO"
# Kỳ vọng: Trả lời hấp dẫn từ ERGO docs ✅
```

---

## 📊 **File Dữ Liệu Được Tạo**

| File | Size | Purpose | Update |
|------|------|---------|--------|
| `data/ergo_docs.json` | 20.4 MB | Full corpus (5,076 chunks) | extract-all-ergo-pdfs.js |
| `data/ergo_prompt.json` | 16.5 KB | Optimized RAG (top-4) | generate-ergo-prompt.js |

---

## ⚠️ **File Đã Xóa** (Old/Unused)

Các file sau đã được xóa vì không còn dùng:

- ❌ `build-ergo-json.js` - Cũ, replaced by extract-all-ergo-pdfs.js
- ❌ `extract-ergo-pdf.js` - Cũ, replaced by extract-all-ergo-pdfs.js
- ❌ `generate-ergo-prompt.js` - Cũ, replaced by generate-ergo-prompt.js
- ❌ `merge-ergo-prompt.js` - Cũ, không dùng nữa

---

## 🚀 **Khi Nào Chạy Scripts**

### **Lần Đầu Setup:**
```bash
# 1. Extract PDFs
node scripts/extract-all-ergo-pdfs.js

# 2. Generate prompt
node scripts/generate-ergo-prompt.js

# 3. Start chatbot
npm run dev
```

### **Khi Thêm PDF Mới:**
```bash
# 1. Thêm PDF vào ERGO_products_data/
# 2. Chạy extract
node scripts/extract-all-ergo-pdfs.js

# 3. Regenerate prompt
node scripts/generate-ergo-prompt.js

# 4. Rebuild
npm run build
```

### **Khi Thay Đổi Scoring:**
```bash
# Edit generate-ergo-prompt.js
# Change IMPORTANCE_KEYWORDS or scoring logic
# Then run:
node scripts/generate-ergo-prompt.js
```

---

## 📝 **Nội Dung Chi Tiết Scripts**

### **extract-all-ergo-pdfs.js:**
```
✓ Tìm 12 PDF files
✓ Extract text từ mỗi PDF
✓ Chia thành chunks (~500 words)
✓ Tạo ergo_docs.json (20.4 MB)
✓ 5,076 chunks tổng cộng
```

### **generate-ergo-prompt.js:**
```
✓ Load ergo_docs.json
✓ Score mỗi chunk bằng BM25
✓ Select top-4 chunks
✓ Tạo ergo_prompt.json (16.5 KB)
✓ Output format: JSON with metadata
```

---

## ✅ **Workspace Cleanup Summary**

**Trước:**
```
scripts/
├── build-ergo-json.js        (❌ Cũ)
├── extract-all-ergo-pdfs.js  (✅ Giữ)
├── extract-ergo-pdf.js       (❌ Cũ)
├── generate-ergo-prompt.js (✅ Giữ)
├── generate-ergo-prompt.js   (❌ Cũ)
└── merge-ergo-prompt.js      (❌ Cũ)
```

**Sau:**
```
scripts/
├── extract-all-ergo-pdfs.js  (✅ Sạch & sử dụng)
└── generate-ergo-prompt.js (✅ Sạch & sử dụng)
```

---

## 🎯 **Summary**

✅ **Giữ lại**: 2 scripts quan trọng nhất  
✅ **Xóa**: 4 scripts cũ không dùng  
✅ **Workspace**: Sạch sẽ & tối ưu  
✅ **Pipeline**: Rõ ràng & dễ hiểu  

**Status**: 🟢 **CLEAN & OPTIMIZED**

