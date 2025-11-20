# Components Structure

Cấu trúc component được tổ chức theo chức năng và loại component:

## 📁 Directory Structure

```
components/
├── ui/                          # Basic UI components (reusable UI elements)
│   ├── Footer.tsx
│   ├── Navigation.tsx
│   └── index.ts
│
├── gold/                        # Gold investment related components
│   ├── GoldPriceWidget.tsx
│   ├── GoldInvestmentCalculator.tsx
│   └── index.ts
│
├── sections/                    # Page sections (hero, services, etc.)
│   ├── HeroSection.tsx
│   ├── ServicesSection.tsx
│   ├── ProcessSection.tsx
│   ├── FAQSection.tsx
│   ├── ReviewsSection.tsx
│   ├── TestimonialsSection.tsx
│   ├── ContactSection.tsx
│   └── index.ts
│
├── chatbot/                     # Chatbot related components
│   ├── ChatBot.tsx
│   ├── ChatWindow.tsx
│   └── index.ts
│
├── layout/                      # Layout wrappers
│   ├── BlogPostLayout.tsx
│   └── index.ts
│
└── index.ts                     # Root barrel export
```

## 📦 Import Patterns

### Recommended (using barrel exports):
```typescript
import { Navigation, Footer } from '@/components/ui';
import { GoldPriceWidget, GoldInvestmentCalculator } from '@/components/gold';
import { HeroSection, ServicesSection } from '@/components/sections';
import { ChatBot, ChatWindow } from '@/components/chatbot';
import { BlogPostLayout } from '@/components/layout';
```

### Or from root:
```typescript
import { Navigation, Footer, GoldPriceWidget } from '@/components';
```

### Direct import (if needed):
```typescript
import Navigation from '@/components/ui/Navigation';
```

## 🗂️ Folder Guidelines

- **ui/**: Pure UI components that don't depend on domain logic
- **gold/**: Gold investment specific features
- **sections/**: Full-width page sections
- **chatbot/**: Chatbot functionality
- **layout/**: Page layout wrappers
- **form/**: (Future) Form components and inputs
- **common/**: (Future) Common utility components

## ✨ Best Practices

1. Use barrel exports (index.ts) for cleaner imports
2. Export as default from individual component files
3. Keep components focused and single-responsibility
4. Use TypeScript for type safety
5. Document props with JSDoc comments

