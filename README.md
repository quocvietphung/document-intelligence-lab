# Tax Consulting Website

A professional Next.js 15 website for tax consulting (Steuerberatung) services in Germany with bilingual support (German/English).

## Features

- ✅ **Next.js 15** with App Router and React 19
- ✅ **TypeScript** for type safety
- ✅ **Tailwind CSS** for responsive styling
- ✅ **Internationalization (i18n)** - German and English support
- ✅ **Server Actions** for form handling
- ✅ **SEO Optimized** with proper meta tags
- ✅ **GDPR Compliant** with Impressum and Datenschutz pages
- ✅ **Responsive Design** - Mobile, tablet, and desktop friendly

## Project Structure

```
tax-consulting/
├── app/
│   ├── [locale]/          # Internationalized routes
│   │   ├── blog/          # Blog pages
│   │   ├── impressum/     # Impressum (legal notice)
│   │   ├── datenschutz/   # Privacy policy (GDPR)
│   │   ├── layout.tsx     # Locale-specific layout
│   │   └── page.tsx       # Homepage
│   ├── api/
│   │   └── booking/       # Booking API endpoint
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── sections/          # Page sections
│   │   ├── HeroSection.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── ProcessSection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   └── ContactSection.tsx
│   ├── Navigation.tsx     # Navigation bar
│   └── Footer.tsx         # Footer component
├── messages/              # Translation files
│   ├── en.json           # English translations
│   └── de.json           # German translations
├── lib/                   # Utility functions
├── i18n.ts               # i18n configuration
└── middleware.ts         # Next.js middleware for i18n

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

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

The default locale is German. To access the English version, visit [http://localhost:3000/en](http://localhost:3000/en).

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

## API Routes

### POST /api/booking
Handles booking/contact form submissions.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
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

## Internationalization

The website supports German (de) and English (en) languages. Translations are managed in `messages/` directory.

- Default locale: German (de)
- Available locales: de, en
- Language switcher in navigation bar

## SEO

- Proper meta tags for search engines
- Semantic HTML structure
- Responsive images
- Clean URL structure

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Deploy with default settings

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

### Styling

- Global styles: `app/globals.css`
- Tailwind config: `tailwind.config.ts`
- Component-specific styles use Tailwind utility classes

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please visit the contact form on the website or email info@tax-consulting.de.
