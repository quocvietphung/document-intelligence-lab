# Component Style Guide

## 📋 Naming Conventions

- **File names**: PascalCase (e.g., `Navigation.tsx`, `ChatBot.tsx`)
- **Folder names**: lowercase (e.g., `components/ui/`, `components/sections/`)
- **Component exports**: Default export from component file
- **Index files**: Named exports for barrel exporting

## 🎨 Component Template

### Basic Component
```typescript
import { FC } from 'react';

interface ComponentProps {
  /** Description of prop */
  prop1: string;
  /** Optional prop with default */
  prop2?: number;
}

/**
 * ComponentName - Brief description of what this component does
 * 
 * @example
 * <ComponentName prop1="value" />
 */
const ComponentName: FC<ComponentProps> = ({ prop1, prop2 = 0 }) => {
  return (
    <div className="component-name">
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

### Client Component (with hooks)
```typescript
'use client';

import { FC, useState } from 'react';

interface ComponentProps {
  /** Description */
  prop: string;
}

/**
 * ClientComponentName - Description
 */
const ClientComponentName: FC<ComponentProps> = ({ prop }) => {
  const [state, setState] = useState('');

  return (
    <div>
      {/* Content */}
    </div>
  );
};

export default ClientComponentName;
```

## 📁 Component Organization

### New Component Checklist
- [ ] File placed in appropriate subfolder (`ui/`, `sections/`, etc.)
- [ ] Named with PascalCase
- [ ] Has TypeScript types defined
- [ ] Has JSDoc comment
- [ ] Exported as default
- [ ] Added to folder's `index.ts`
- [ ] Added to root `components/index.ts` (if public)

## 🎯 Folder Guidelines

| Folder | Purpose | Example |
|--------|---------|---------|
| `ui/` | Reusable UI elements | Navigation, Footer |
| `sections/` | Full-width page sections | HeroSection, ServicesSection |
| `gold/` | Domain-specific (gold) | GoldPriceWidget |
| `chatbot/` | Chatbot functionality | ChatBot, ChatWindow |
| `layout/` | Layout wrappers | BlogPostLayout |
| `form/` | Form components (future) | FormInput, FormButton |
| `common/` | Utility components (future) | Modal, Toast |

## ✅ Code Quality Checklist

- [ ] Props are properly typed
- [ ] Component is responsive (mobile-first)
- [ ] Accessibility (a11y) considered
- [ ] No console.logs in production code
- [ ] Handles loading/error states
- [ ] Proper error boundaries if needed
- [ ] Uses Tailwind CSS for styling
- [ ] No hard-coded text (use i18n where needed)

## 🔗 Import Best Practices

### ✅ Good
```typescript
// From barrel export
import { Navigation, Footer } from '@/components/ui';
import { ChatBot } from '@/components/chatbot';

// Or from root
import { Navigation, Footer } from '@/components';
```

### ❌ Avoid
```typescript
// Direct imports (less organized)
import Navigation from '@/components/ui/Navigation';
```

## 🚀 Performance Tips

1. Use React.memo for components that receive same props
2. Split large components into smaller ones
3. Lazy load components if needed
4. Use 'use client' only when necessary
5. Avoid unnecessary re-renders

## 🧪 Testing

Components should have:
- Props properly typed
- Prop validation (if needed)
- Default values for optional props
- Clear error messages

