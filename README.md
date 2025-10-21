# Tax Consulting Web App

Next.js 15 web app for tax consulting (Steuerberatung) in Germany with booking and multilingual support.

## Features

- 🌐 **Multilingual Support**: German and English with next-intl
- 📱 **Responsive Design**: Mobile-first design with Tailwind CSS
- ⚡ **Next.js 15**: Using App Router and React 19
- 🎨 **Modern UI**: Clean and professional design
- 📧 **Contact Form**: Consultation booking with API route
- 📝 **Blog Section**: Tax tips and news
- 🔒 **GDPR Compliant**: Impressum and Datenschutz pages
- 🎯 **SEO Optimized**: Meta tags and semantic HTML

## Pages

- **Homepage**: Hero, services, process steps, testimonials, contact form
- **Services**: 
  - Steuerberatung (Tax Consulting)
  - Einkommensteuer (Income Tax)
  - Umsatzsteuer (VAT/Sales Tax)
- **Blog**: Tax tips and news articles
- **Impressum**: Legal notice (required by German law)
- **Datenschutz**: Privacy policy (GDPR compliant)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build

```bash
npm run build
```

### Production

```bash
npm run start
```

## Project Structure

```
├── app/
│   ├── [locale]/          # Localized routes
│   │   ├── page.tsx       # Homepage
│   │   ├── blog/          # Blog section
│   │   ├── impressum/     # Legal notice
│   │   └── datenschutz/   # Privacy policy
│   ├── api/
│   │   └── booking/       # Booking API route
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Navigation.tsx
│   ├── Hero.tsx
│   ├── Services.tsx
│   ├── Process.tsx
│   ├── Testimonials.tsx
│   ├── ContactForm.tsx
│   └── Footer.tsx
├── i18n/                  # Internationalization
│   ├── routing.ts
│   ├── request.ts
│   └── messages/
│       ├── de.json        # German translations
│       └── en.json        # English translations
└── middleware.ts          # i18n middleware
```

## Technologies

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **i18n**: next-intl
- **React**: React 19

## API Routes

### POST /api/booking

Submit a consultation booking request.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "service": "string",
  "message": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Booking request received successfully"
}
```

## License

MIT

## Author

Tax Consulting Germany
