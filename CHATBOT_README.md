# AI Chatbot Setup Guide

This project includes an AI-powered chatbot using the Vercel AI SDK for tax consulting, career guidance, and business registration assistance in Vietnam and Germany.

## Features

- **Multi-language Support**: Chatbot interface in English, German, and Vietnamese
- **Streaming Responses**: Real-time streaming of AI responses using Vercel AI SDK
- **Professional Design**: Clean, responsive chat interface with Tailwind CSS
- **Smart System Prompt**: Specialized for tax consulting domain
- **Error Handling**: Graceful error handling with user-friendly messages

## Setup

### 1. Install Dependencies

All required dependencies are already installed via `npm install`:
- `ai` - Vercel AI SDK core
- `@ai-sdk/openai` - OpenAI provider for Vercel AI SDK
- `@ai-sdk/react` - React hooks for AI interactions
- `openai` - OpenAI client library

### 2. Configure API Key

Create a `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Run the Application

```bash
npm run dev
```

The chatbot will appear as a floating button in the bottom-right corner of every page.

## Architecture

### API Route (`/app/api/chat/route.ts`)

The chat API endpoint uses Vercel AI SDK's `streamText` function:

- **Model**: GPT-4o-mini (fast and cost-effective)
- **Max Output Tokens**: 500
- **Temperature**: 0.7 (balanced creativity)
- **Streaming**: Enabled via `toTextStreamResponse()`

### Frontend Components

#### ChatBot Component (`/components/chatbot/ChatBot.tsx`)
- Floating action button
- Opens/closes chat window
- Localized button label

#### ChatWindow Component (`/components/chatbot/ChatWindow.tsx`)
- Chat interface with message history
- Input field with submit button
- Loading states and error handling
- Auto-scroll to latest messages
- Uses Vercel AI SDK's `useChat` hook

### Integration

The chatbot is integrated into the main layout (`/app/[locale]/layout.tsx`), making it available on all pages across all language versions.

## Customization

### Modify System Prompt

Edit the `systemPrompt` in `/app/api/chat/route.ts`:

```typescript
const systemPrompt = `Your custom instructions here...`;
```

### Change Model

Update the model in `/app/api/chat/route.ts`:

```typescript
model: openai('gpt-4o'),  // or 'gpt-3.5-turbo', etc.
```

### Adjust Styling

Modify Tailwind CSS classes in:
- `/components/chatbot/ChatBot.tsx` - Button styles
- `/components/chatbot/ChatWindow.tsx` - Window and message styles

## Translations

Chatbot UI translations are in `/messages/{locale}.json`:

```json
"chatbot": {
  "title": "Consulting Assistant",
  "placeholder": "Ask about taxes, career guidance, or business registration...",
  "button_label": "Chat with us",
  "welcome": "Hello! How can I help you...",
  "send": "Send",
  "close": "Close",
  "error": "Sorry, an error occurred. Please try again."
}
```

## Development Notes

### Testing Without API Key

If you don't have an API key, the chatbot will show an error when trying to send messages. The UI will still work for testing purposes.

### Rate Limits

OpenAI API has rate limits. For production:
- Monitor API usage
- Implement rate limiting on your endpoint
- Consider caching common responses

### Security

- API key is stored as environment variable (never in code)
- API route runs on server-side only
- No sensitive data is logged

## Troubleshooting

### Build Errors

If you encounter TypeScript errors:
1. Ensure all dependencies are installed: `npm install`
2. Clear Next.js cache: `rm -rf .next`
3. Rebuild: `npm run build`

### Chat Not Responding

1. Check API key is set in `.env.local`
2. Verify API key is valid at OpenAI dashboard
3. Check browser console for errors
4. Verify API route is accessible: `http://localhost:3000/api/chat`

### Streaming Not Working

The Vercel AI SDK requires:
- Next.js 15+ with App Router
- Server Components support
- Edge runtime compatible code

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import repository in Vercel
3. Add `OPENAI_API_KEY` in Environment Variables
4. Deploy

### Environment Variables in Vercel

```
OPENAI_API_KEY=your-key-here
```

## Future Enhancements

Potential improvements:
- [ ] Message persistence with database
- [ ] User authentication
- [ ] Chat history export
- [ ] File upload support
- [ ] Voice input/output
- [ ] Multi-turn conversation context
- [ ] Custom training on company data
- [ ] Analytics and usage tracking

## License

Same as parent project.
