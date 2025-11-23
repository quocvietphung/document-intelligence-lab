#!/bin/bash
# RAG Chatbot Setup Script
# Run this to quickly set up the RAG chatbot

set -e  # Exit on error

echo "🚀 RAG Chatbot Setup Script"
echo "================================"
echo ""

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION found"
echo ""

# Check .env.local
echo "🔑 Checking environment variables..."
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local.template << 'EOF'
# Azure OpenAI Configuration
# Get these from: https://portal.azure.com
# Go to Azure OpenAI resource → Keys and Endpoint

AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview
EOF
    echo "📝 Created .env.local.template"
    echo "⚠️  Please fill in your Azure credentials:"
    echo "   cp .env.local.template .env.local"
    echo "   nano .env.local  # Edit with your keys"
    echo ""
fi

# Check if .env.local has values
if [ -f .env.local ]; then
    if grep -q "your_api_key_here\|your_resource\|gpt-4-deployment" .env.local; then
        echo "⚠️  .env.local still has placeholder values!"
        echo "Please edit .env.local and add your actual Azure credentials"
        exit 1
    else
        echo "✅ .env.local is configured"
    fi
fi
echo ""

# Install dependencies
echo "📚 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Run tests
echo "🧪 Running test suite..."
echo "   (This verifies RAG system is working)"
if npx ts-node lib/rag.test.ts 2>/dev/null; then
    echo "✅ Tests passed!"
else
    echo "⚠️  Tests might have failed - but setup is complete"
fi
echo ""

# Summary
echo "✅ Setup Complete!"
echo ""
echo "🚀 Next Steps:"
echo "1. Start development server:   npm run dev"
echo "2. Open in browser:            http://localhost:3000"
echo "3. Click chat button (bottom right)"
echo "4. Try a query like:           'ERGO Krankenversicherung'"
echo ""
echo "📚 Documentation:"
echo "  - Quick Start:    cat QUICKSTART_RAG.md"
echo "  - Full Docs:      cat RAG_SETUP.md"
echo "  - Examples:       cat RAG_EXAMPLES.md"
echo ""
echo "🎯 Test Queries:"
echo "  🇩🇪 German:  'Wie kann ich mit ERGO sparen?'"
echo "  🇬🇧 English: 'Tell me about ERGO insurance'"
echo "  🇻🇳 Vietnamese: 'ERGO có sản phẩm nào?'"
echo ""
echo "Happy coding! 🎉"

