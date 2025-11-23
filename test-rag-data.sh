#!/bin/bash

echo "🧪 Testing RAG System"
echo "===================="
echo ""

# Test 1: Check if ergo_docs.json exists and has data
echo "Test 1: Checking ergo_docs.json..."
if [ -f "data/ergo_docs.json" ]; then
  SIZE=$(wc -c < data/ergo_docs.json)
  LINES=$(wc -l < data/ergo_docs.json)
  echo "✅ File exists: $SIZE bytes, $LINES lines"
else
  echo "❌ File not found!"
  exit 1
fi

echo ""
echo "Test 2: Checking if JSON is valid..."
if jq empty data/ergo_docs.json 2>/dev/null; then
  echo "✅ JSON is valid"

  # Count keys
  KEYS=$(jq 'keys | length' data/ergo_docs.json)
  echo "📊 Number of document keys: $KEYS"

  # Get first key
  FIRST_KEY=$(jq -r 'keys[0]' data/ergo_docs.json)
  FIRST_CHUNKS=$(jq ".\"$FIRST_KEY\" | length" data/ergo_docs.json)
  echo "📄 First document: $FIRST_KEY with $FIRST_CHUNKS chunks"
else
  echo "❌ JSON is invalid!"
  exit 1
fi

echo ""
echo "Test 3: Check ergo_prompt.json..."
if [ -f "data/ergo_prompt.json" ]; then
  INCLUDED=$(jq '.includedCount' data/ergo_prompt.json)
  echo "✅ Metadata: $INCLUDED documents included"
else
  echo "⚠️  ergo_prompt.json not found"
fi

echo ""
echo "✅ All tests passed! RAG data is ready."
echo ""
echo "🚀 Now start the dev server:"
echo "   npm run dev"

