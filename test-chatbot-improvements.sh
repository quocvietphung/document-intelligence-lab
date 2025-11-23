#!/bin/bash
# Test script để xác minh RAG chatbot hoạt động đúng

echo "🔍 Testing RAG Chatbot Improvements..."
echo "======================================"
echo ""

# 1. Check if ergo_docs.json exists and has content
echo "✅ Test 1: Checking ergo_docs.json..."
if [ -f "data/ergo_docs.json" ]; then
    DOCS_COUNT=$(grep -o '"file"' data/ergo_docs.json | wc -l)
    FILE_SIZE=$(ls -lh data/ergo_docs.json | awk '{print $5}')
    echo "   ✓ File exists"
    echo "   ✓ Size: $FILE_SIZE"
    echo "   ✓ Documents found: $DOCS_COUNT"
else
    echo "   ✗ ergo_docs.json not found!"
fi
echo ""

# 2. Check TypeScript compilation
echo "✅ Test 2: Checking TypeScript..."
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo "   ✗ TypeScript errors found!"
    npx tsc --noEmit
else
    echo "   ✓ No TypeScript errors"
fi
echo ""

# 3. Check key files exist
echo "✅ Test 3: Checking key files..."
FILES=(
    "lib/prompt-templates.ts"
    "lib/ergo-retriever.ts"
    "lib/rag-utils.ts"
    "app/api/chat/route.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file exists"
    else
        echo "   ✗ $file missing!"
    fi
done
echo ""

# 4. Check for updated prompts
echo "✅ Test 4: Checking for improved prompts..."
if grep -q "MÜSSEN spezifische Details" lib/prompt-templates.ts; then
    echo "   ✓ German prompt updated"
else
    echo "   ✗ German prompt not updated!"
fi

if grep -q "MUST FOLLOW" lib/prompt-templates.ts; then
    echo "   ✓ English prompt updated"
else
    echo "   ✗ English prompt not updated!"
fi

if grep -q "PHẢI TUÂN THỦ" lib/prompt-templates.ts; then
    echo "   ✓ Vietnamese prompt updated"
else
    echo "   ✗ Vietnamese prompt not updated!"
fi
echo ""

# 5. Check for improved RAG formatting
echo "✅ Test 5: Checking for improved RAG formatting..."
if grep -q "📚 ERGO DOKUMENTENQUELLEN" lib/ergo-retriever.ts; then
    echo "   ✓ RAG context formatting updated"
else
    echo "   ✗ RAG context formatting not updated!"
fi
echo ""

echo "======================================"
echo "✨ All checks completed!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Test: Ask 'Was ist DKV?' to the chatbot"
echo "3. Check: Response should have specific details from PDFs"

