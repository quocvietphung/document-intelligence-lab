#!/bin/bash

# Test Chat API Format
# Run this to verify messages are properly formatted

echo "🧪 Testing Chat API Message Format"
echo "===================================="
echo ""

# Test 1: Simple message
echo "Test 1: Simple user message"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Xin chào"}
    ]
  }' 2>/dev/null | jq '.choices[0].message.content' | head -5

echo ""
echo "Test 2: Multi-turn conversation"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Xin chào"},
      {"role": "assistant", "content": "Chào bạn! Tôi có thể giúp gì cho bạn?"},
      {"role": "user", "content": "ERGO bảo hiểm gì?"}
    ]
  }' 2>/dev/null | jq '.choices[0].message.content' | head -5

echo ""
echo "Test 3: With RAG context (ERGO-related)"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "ERGO Krankenversicherung là gì?"}
    ]
  }' 2>/dev/null | jq '.ragDocuments | length'

echo ""
echo "✅ If you see responses above, API is working correctly!"

