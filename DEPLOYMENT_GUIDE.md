# 🚀 Deployment & Deployment Guide

## Production Deployment Checklist

### Pre-Deployment (Local)

- [ ] All tests passing: `npx ts-node lib/rag.test.ts`
- [ ] Build succeeds: `npm run build`
- [ ] Dev server works: `npm run dev`
- [ ] No TypeScript errors: Build output clean
- [ ] Environment variables validated
- [ ] `.env.local` matches production values

### Code Review

- [ ] `app/api/chat/route.ts` reviewed
- [ ] `lib/ergo-retriever.ts` reviewed
- [ ] `lib/prompt-templates.ts` reviewed
- [ ] Error handling verified
- [ ] Input validation checked

### Environment Setup

For your hosting platform (Vercel, AWS, Azure, etc.):

```bash
# Set these 4 environment variables
AZURE_OPENAI_API_KEY=<your-key>
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### Deployment Platforms

#### Vercel (Recommended for Next.js)

```bash
# 1. Push code to GitHub
git push origin main

# 2. Import project in Vercel
# Visit: https://vercel.com/new
# Select your GitHub repo

# 3. Set environment variables
# Project Settings → Environment Variables
# Add all 4 Azure OpenAI variables

# 4. Deploy
# Auto-deploys on push to main
```

#### Azure App Service

```bash
# 1. Create App Service
# Resource Group → Create → App Service

# 2. Set environment variables
# Configuration → Application settings
# Add all 4 variables

# 3. Deploy
# Via GitHub Actions / ZIP / Git
```

#### AWS Lambda (with Next.js adapter)

```bash
# 1. Install adapter
npm install @sls-next/serverless-plugin

# 2. Configure serverless.yml
# See: https://github.com/serverless-nextjs/serverless-next.js

# 3. Deploy
serverless deploy
```

#### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables at runtime
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t tax-consulting .
docker run -e AZURE_OPENAI_API_KEY=... -p 3000:3000 tax-consulting
```

---

## 🔒 Security Checklist

- [ ] API keys in environment variables (not in code)
- [ ] HTTPS enabled in production
- [ ] Rate limiting configured (prevent abuse)
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive info
- [ ] CORS configured correctly
- [ ] Dependencies audited: `npm audit`

### Security Headers

Add to `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ]
}
```

---

## 📊 Monitoring & Logging

### Azure Monitor Integration

```typescript
// In app/api/chat/route.ts
import { ApplicationInsightsClient } from "@azure/monitor-query";

// Log successful requests
console.log(`[Chat API] Query processed: ${elapsed}ms`);

// Log errors
console.error(`[Chat API] Error: ${error.message}`);
```

### Metrics to Track

- Total API calls
- Response times
- Error rates
- Azure OpenAI costs
- Cache hit rates
- Document retrieval times

### Recommended Tools

- **Vercel Analytics**: Built-in dashboard
- **Azure Monitor**: For Azure resources
- **Datadog**: Comprehensive monitoring
- **CloudWatch**: For AWS deployments

---

## 💰 Cost Optimization

### Azure OpenAI Costs

Typical pricing (varies by region):
- `gpt-4`: ~$0.03 per 1K prompt tokens
- `gpt-4`: ~$0.06 per 1K completion tokens

### Cost Reduction Tips

1. **Reduce max_tokens**
   ```typescript
   // In route.ts, reduce from 1500 to 1000
   max_tokens: 1000
   ```

2. **Cache RAG Results**
   ```typescript
   // Store frequently asked questions
   const ragCache = new Map();
   ```

3. **Use Cheaper Model**
   ```typescript
   // If acceptable, use gpt-4-turbo instead
   // Costs ~$0.01 per 1K tokens
   ```

4. **Batch Requests**
   - Process multiple requests together
   - Use async queues

### Monitor Costs

In Azure Portal:
1. Go to Azure OpenAI resource
2. Cost Management → Budgets
3. Set alerts at 80% of budget

---

## 🚨 Error Handling & Recovery

### Common Production Issues

#### 1. Azure OpenAI API Timeout

```typescript
// Add retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function callAzureOpenAI(messages, retries = 0) {
  try {
    return await fetch(url, { timeout: 30000 });
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return callAzureOpenAI(messages, retries + 1);
    }
    throw error;
  }
}
```

#### 2. Out of Memory

```typescript
// In ergo-retriever.ts
// Limit cache size
if (cache.size > 100) {
  cache.delete(cache.keys().next().value);
}
```

#### 3. Rate Limiting

```typescript
// Add rate limiter
import Ratelimit from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "10 s"),
});

// In route handler
const { success } = await ratelimit.limit(req.ip);
if (!success) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429 }
  );
}
```

---

## 📈 Scaling

### Horizontal Scaling

For high traffic:

1. **Stateless API**
   - Current implementation is already stateless
   - Can run multiple instances

2. **Load Balancer**
   - Route requests across instances
   - Vercel does this automatically

3. **Database for Caching**
   - Replace in-memory cache with Redis
   - Share cache across instances

### Vertical Scaling

- Increase machine RAM/CPU
- Use faster APIs
- Optimize database queries

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      - run: npx ts-node lib/rag.test.ts
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

---

## 🌍 Multi-Region Deployment

### Benefits

- Lower latency for users
- Better availability
- Compliance with data residency

### Setup

1. **Duplicate Infrastructure**
   - Deploy to multiple regions
   - Each region has own database

2. **Global Load Balancer**
   - Route to nearest region
   - Automatic failover

3. **Data Synchronization**
   - Sync ERGO documents across regions
   - Consistent experience

---

## 📋 Post-Deployment

### Validation

- [ ] Chatbot works in production
- [ ] RAG retrieval functioning
- [ ] Sources display correctly
- [ ] Multilingual support working
- [ ] Error handling tested
- [ ] Performance acceptable (~3-7s)

### Monitoring (First Week)

- [ ] Monitor error logs daily
- [ ] Check response times
- [ ] Monitor Azure OpenAI costs
- [ ] Gather user feedback
- [ ] Fix any issues

### Long-term Maintenance

- [ ] Weekly: Review error logs
- [ ] Weekly: Monitor performance
- [ ] Monthly: Update ERGO documents
- [ ] Monthly: Review costs
- [ ] Quarterly: Update dependencies

---

## 🎯 Performance Optimization

### Frontend

```typescript
// Debounce input to reduce API calls
const [input, setInput] = useState("");
const [debouncedInput] = useDebounce(input, 500);
```

### Backend

```typescript
// Cache ERGO documents
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
cache.set(key, value, CACHE_TTL);
```

### Network

```typescript
// Gzip compression
// Enable in Next.js: already enabled by default

// CDN for static files
// Configure in hosting platform
```

---

## 📞 Support & Debugging

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# View Azure OpenAI logs
az cognitiveservices account logs show \
  --name <resource-name> \
  --resource-group <group-name>
```

### Common Commands

```bash
# Build and test before deploying
npm run build
npx ts-node lib/rag.test.ts

# Check for issues
npm run lint

# View logs (in production)
# Depends on hosting platform
# Vercel: https://vercel.com/<project>/logs
# AWS: CloudWatch Logs
# Azure: Application Insights
```

---

## 🎉 Deployment Success Criteria

✅ **Functionality**
- Chat works end-to-end
- RAG retrieval working
- Sources displaying
- Error messages appropriate

✅ **Performance**
- Response time < 10 seconds
- < 5% error rate
- Azure OpenAI available

✅ **Security**
- No API keys in logs
- HTTPS only
- Input validated
- Rate limiting active

✅ **Monitoring**
- Logs being collected
- Metrics being tracked
- Alerts configured
- Team aware of setup

---

## 📚 Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment/vercel)
- [Azure OpenAI API](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions](https://github.com/features/actions)

---

**Deployment Date**: Ready when you are! 🚀  
**Maintenance**: Weekly monitoring recommended  
**Support**: Use documentation and logs for debugging

---

## Quick Deployment Steps

```bash
# 1. Verify everything works locally
npm run dev
npm run build
npx ts-node lib/rag.test.ts

# 2. Push to GitHub
git add .
git commit -m "Add RAG chatbot integration"
git push origin main

# 3. Deploy to Vercel (or your platform)
# Set environment variables
# Deploy!

# 4. Monitor
# Check logs daily for first week
# Monitor costs
# Gather feedback

# 5. Optimize
# Adjust parameters based on metrics
# Update documents as needed
# Improve based on user feedback
```

**You're ready to deploy! 🎉**

