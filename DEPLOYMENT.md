# Deployment Guide

## Quick Deployment to Vercel (Recommended)

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository: `quocvietphung/tax-consulting`
4. Vercel will automatically detect Next.js
5. Click "Deploy"

That's it! Vercel will automatically:
- Build your Next.js application
- Deploy to a production URL
- Set up automatic deployments for future commits
- Configure edge network for fast global delivery

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to your project
cd tax-consulting

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Alternative Deployment Options

### Deploy to Netlify

1. Connect your GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Click "Deploy"

### Deploy to Custom Server

```bash
# Build the application
npm run build

# Start production server
npm start
```

The app will run on port 3000 by default.

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t tax-consulting .
docker run -p 3000:3000 tax-consulting
```

## Environment Variables

Currently, the application doesn't require any environment variables. However, if you add features like email notifications or database connections, create a `.env.local` file:

```env
# Example environment variables
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
DATABASE_URL=postgresql://...
```

## Post-Deployment Checklist

After deployment, verify:

- [ ] Website loads at your domain
- [ ] Both German and English versions work
- [ ] Language switcher functions correctly
- [ ] All navigation links work
- [ ] Contact form submits successfully
- [ ] Blog page displays correctly
- [ ] Impressum page is accessible
- [ ] Datenschutz page is accessible
- [ ] Mobile responsiveness works
- [ ] SEO meta tags are present

## Custom Domain Setup

### Vercel

1. Go to Project Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Add both `example.com` and `www.example.com`

### DNS Records

Add these DNS records at your domain registrar:

```
Type    Name    Value
A       @       76.76.21.21 (Vercel's IP)
CNAME   www     cname.vercel-dns.com
```

## SSL Certificate

Both Vercel and Netlify automatically provide free SSL certificates via Let's Encrypt.

## Performance Optimization

The application is already optimized with:
- Static Site Generation (SSG)
- Code splitting
- Image optimization (when images are added)
- Minified JavaScript and CSS
- Gzip compression

## Monitoring

Consider adding:
- **Vercel Analytics**: Built-in for Vercel deployments
- **Google Analytics**: For detailed traffic insights
- **Sentry**: For error tracking
- **LogRocket**: For session replay

## Backup Strategy

Your code is backed up in GitHub. For user data:
1. Set up automated database backups
2. Export booking form submissions regularly
3. Keep configuration files in version control

## Updating the Site

1. Make changes locally
2. Test with `npm run dev`
3. Commit to GitHub
4. Push to main branch
5. Vercel automatically deploys updates

## Troubleshooting

### Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### 404 Errors

Make sure your hosting platform supports Next.js rewrites and dynamic routes.

### Slow Loading

- Enable caching headers
- Use a CDN (Vercel includes this)
- Optimize images
- Enable compression

## Support

For issues or questions:
- Check the [Next.js documentation](https://nextjs.org/docs)
- Visit [Vercel documentation](https://vercel.com/docs)
- Review [IMPLEMENTATION.md](./IMPLEMENTATION.md) for details

## Cost Estimate

### Vercel (Recommended)
- **Hobby Plan**: Free for personal projects
- **Pro Plan**: $20/month (includes team features)

### Netlify
- **Free Plan**: Available for small sites
- **Pro Plan**: $19/month

### Custom Server
- **VPS**: $5-10/month (DigitalOcean, Linode)
- **Shared Hosting**: $5-15/month

Most tax consulting websites will fit comfortably in free or low-tier plans.
