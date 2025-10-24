# Tax Consulting Website

A professional Next.js 15 website for tax consulting (Steuerberatung) services in Germany and Vietnam with trilingual support (German/English/Vietnamese) and AI-powered chatbot assistance.

## Features

- ✅ **Next.js 15** with App Router and React 19
- ✅ **TypeScript** for type safety
- ✅ **Tailwind CSS** for responsive styling
- ✅ **Internationalization (i18n)** - German, English, and Vietnamese support
- ✅ **AI Chatbot** - Powered by Vercel AI SDK with OpenAI integration
- ✅ **Server Actions** for form handling
- ✅ **SEO Optimized** with proper meta tags
- ✅ **GDPR Compliant** with Impressum, Datenschutz, and Terms of Service pages
- ✅ **Responsive Design** - Mobile, tablet, and desktop friendly

## Project Structure

```
tax-consulting/
├── app/
│   ├── [locale]/          # Internationalized routes
│   │   ├── blog/          # Blog pages
│   │   ├── impressum/     # Impressum (legal notice)
│   │   ├── datenschutz/   # Privacy policy (GDPR)
│   │   ├── terms/         # Terms of Service
│   │   ├── layout.tsx     # Locale-specific layout
│   │   └── page.tsx       # Homepage
│   ├── api/
│   │   ├── booking/       # Booking API endpoint
│   │   └── chat/          # AI Chatbot API endpoint
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── sections/          # Page sections
│   │   ├── HeroSection.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── ProcessSection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   └── ContactSection.tsx
│   ├── chatbot/           # AI Chatbot components
│   │   ├── ChatBot.tsx    # Floating chat button
│   │   └── ChatWindow.tsx # Chat interface
│   ├── Navigation.tsx     # Navigation bar
│   └── Footer.tsx         # Footer component
├── messages/              # Translation files
│   ├── en.json           # English translations
│   ├── de.json           # German translations
│   └── vi.json           # Vietnamese translations
├── lib/                   # Utility functions
├── i18n.ts               # i18n configuration
├── middleware.ts         # Next.js middleware for i18n
└── .env.example          # Environment variables template

```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/quocvietphung/tax-consulting.git
cd tax-consulting
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys and SMTP settings:
```
# OpenAI API key for chatbot
OPENAI_API_KEY=your-openai-api-key-here

# Gmail SMTP for booking email system
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
ADMIN_EMAIL=admin@yourdomain.com
```

**Setting up Gmail App Password:**
1. Enable 2-factor authentication on your Gmail account
2. Go to [Google Account Settings](https://myaccount.google.com/security)
3. Select "2-Step Verification" → "App passwords"
4. Generate a new app password for "Mail"
5. Copy the 16-character password to `SMTP_PASS` in `.env.local`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

The default locale is German. To access other versions:
- English: [http://localhost:3000/en](http://localhost:3000/en)
- Vietnamese: [http://localhost:3000/vi](http://localhost:3000/vi)

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Pages

### Homepage
- Hero section with call-to-action
- Services overview (Tax Declaration, Business Consulting, Accounting)
- 3-step process explanation
- Client testimonials
- Contact/booking form

### Blog
- Tax tips and news articles
- Responsive blog post grid
- Read more functionality

### Legal Pages
- **Impressum** - Legal notice (required in Germany)
- **Datenschutz** - Privacy policy (GDPR compliant)
- **Terms of Service** - User agreement and terms

## AI Chatbot

The website features an AI-powered chatbot that helps users with:
- Tax consulting questions
- Career guidance
- Business registration in Vietnam and Germany

See [CHATBOT_README.md](./CHATBOT_README.md) for detailed setup and customization instructions.

## API Routes

### POST /api/booking
Handles booking/contact form submissions and sends email notifications.

**Features:**
- Sends confirmation email to the customer
- Sends notification email to the admin
- Uses Gmail SMTP (requires App Password)
- No database storage required

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string (optional)",
  "message": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking email sent successfully"
}
```

**Testing Locally:**
1. Set up SMTP credentials in `.env.local` (see Installation section)
2. Use the `BookingForm` component or send a POST request:
```bash
curl -X POST http://localhost:3000/api/booking \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","message":"Test booking"}'
```
3. Check both admin and customer emails for confirmations

### POST /api/chat
AI chatbot endpoint using Vercel AI SDK.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "parts": [{ "type": "text", "text": "Your question here" }]
    }
  ]
}
```

**Response:** Streaming text response from OpenAI GPT-4o-mini model.

## Internationalization

The website supports German (de), English (en), and Vietnamese (vi) languages. Translations are managed in `messages/` directory.

- Default locale: German (de)
- Available locales: de, en, vi
- Language switcher in navigation bar with flag icons

## SEO

- Proper meta tags for search engines
- Semantic HTML structure
- Responsive images
- Clean URL structure

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variable: `OPENAI_API_KEY=your-key-here`
4. Deploy with default settings

### Other Platforms

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Customization

### Adding Content

1. **Services**: Edit `components/sections/ServicesSection.tsx`
2. **Testimonials**: Edit `components/sections/TestimonialsSection.tsx`
3. **Blog Posts**: Edit `app/[locale]/blog/page.tsx`

### Translations

Add or modify translations in:
- `messages/en.json` (English)
- `messages/de.json` (German)
- `messages/vi.json` (Vietnamese)

Each file includes sections for:
- Navigation
- Hero section
- Services
- Process
- Testimonials
- Contact form
- Footer
- Chatbot interface

### Styling

- Global styles: `app/globals.css`
- Tailwind config: `tailwind.config.ts`
- Component-specific styles use Tailwind utility classes

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please visit the contact form on the website or email info@tax-consulting.de.
