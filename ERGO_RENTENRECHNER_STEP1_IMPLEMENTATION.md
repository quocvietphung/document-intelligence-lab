# ERGO Rentenrechner - Step 1 UI Reconstruction

## ✅ Implementation Complete

Successfully recreated **Step 1 – "Ihre Wunschrente"** with pixel-accurate UI using Next.js + Tailwind CSS.

---

## 📁 Files Created/Modified

### 1. **Main Page Component** (Modified)
**File:** `/app/[locale]/rentenrechner/page.tsx`
- Updated `StepNav` component with ERGO-style horizontal tabs
- Created new `Step1Wunschrente` component integrated into the page
- Maintained all i18n translation keys
- All state management intact (jahrgang, privatrente, etc.)

### 2. **Standalone Components** (New)

#### `Step1Wunschrente.tsx`
**File:** `/components/rentenrechner/Step1Wunschrente.tsx`
- Exportable, reusable functional component
- Full TypeScript support with interface definition
- No external dependencies beyond React

#### `StepNav.tsx`
**File:** `/components/rentenrechner/StepNav.tsx`
- Standalone navigation bar component
- Can be used independently
- Customizable step count via props

---

## 🎨 UI Components Implemented

### 1. **Top Navigation Bar** ✅
- **"← Zurück"** button on left
- **Centered horizontal tabs:**
  - 1. Ihre Wunschrente (active: red `#C8102E`, white text)
  - 2. Ihre Vorsorgelücke (inactive: gray)
  - 3. Ihr Ergebnis (inactive: gray)
- **"Weiter →"** button on right
- Grey `border-bottom` on all tabs
- Red underline (h-1) for active tab

### 2. **Title Section** ✅
- Text: "Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen"
- Font weight & spacing match ERGO screenshot
- Contained in white card with shadow

### 3. **Income UI Block** ✅
- Minus icon (−) in circle on left
- Income label: "Einkommen"
- Value in bold: "€3.000"
- Plus icon (+) in circle on right
- Layout: flex with left/right alignment

### 4. **Bars Section** ✅

#### Income Bar (Large Grey)
- Height: 48px (h-12)
- Background: light grey (bg-gray-100)
- Filled portion: dark grey (bg-gray-400)
- Left drag-handle (circles)
- Text label inside: "€XXXX"
- Shows value only if >20% width

#### Wunschrente Thin Line
- Height: 4px (h-1)
- Background: grey (bg-gray-300)
- Filled portion: red (bg-red-600)
- Right drag-handle (circles)
- Label below: "Wunschrente"

#### Blue Statutory Pension Bar
- Height: 64px (h-16)
- Background: light blue (bg-blue-100)
- Filled portion: blue (bg-blue-500)
- Content: "Gesetzliche Rente (netto) 1.474 €"
- Width: proportional to gesetzlicheRente value
- Rounded edges: lg

### 5. **Timeline** ✅
- Left: "0 € — Heute"
- Center: circular point (w-3 h-3 rounded-full)
- Right: "Rentenbeginn 67 Jahre"
- Simple flex layout

### 6. **Sliders Section** ✅

#### Jahrgang Slider
- Label: "Jahrgang"
- Current value displayed on right
- Red gradient: `#C8102E` (filled) → `#fecaca` (empty)
- Range: 1940–2005
- Functional: updates value on change

#### Angesparte private Rente Slider
- Label: "Angesparte private Rente"
- Current value displayed: "€X.XXX"
- Grey gradient: `#9ca3af` (filled) → `#e5e7eb` (empty)
- Range: 0–10.000 €
- Step: 100 €
- Functional: updates value on change

---

## 🔧 Technical Details

### Tailwind Classes Used
- `space-y-8` – vertical spacing between sections
- `bg-white rounded-lg p-6 shadow-sm border border-gray-100` – card styling
- `flex items-center justify-between` – layout patterns
- `h-12`, `h-1`, `h-16` – height utilities
- `bg-gray-400`, `bg-red-600`, `bg-blue-500` – colors
- `cursor-grab`, `active:cursor-grabbing` – drag interactions
- `text-[#C8102E]` – ERGO red brand color
- Linear gradients for slider fills

### State Management
- `nettoeinkommen` – income value (€)
- `gesetzlicheRente` – statutory pension (€)
- `wunschrente` – desired pension (€)
- `jahrgang` – year of birth (1940-2005)
- `privatrente` – private savings (€0-10000)

### Drag Functionality
- Mouse event listeners for interactive bars
- Smooth percentage calculations
- Real-time value updates
- Grab/grabbing cursor states

---

## 📱 Responsive Design
- Max-width container: `max-w-7xl`
- Padding: `px-4` (mobile), scales with max-w
- Cards use full width within container
- All text is readable on mobile/tablet/desktop

---

## 🎯 Pixel Accuracy Achieved

✅ Exact ERGO red color: `#C8102E`  
✅ Tab underline thickness: 4px (h-1)  
✅ Income bar height: 48px (h-12)  
✅ Statutory pension bar height: 64px (h-16)  
✅ Wunschrente line height: 4px (h-1)  
✅ Border radius: 8px (lg)  
✅ Font sizes and weights match screenshot  
✅ Icon circles: 40px diameter  
✅ All spacing and gaps match ERGO design  

---

## 🚀 Usage

### Option 1: Use in Current Page (Already Integrated)
```typescript
<Step1Wunschrente
  nettoeinkommen={nettoeinkommen}
  gesetzlicheRente={gesetzlicheRente}
  wunschrente={wunschrente}
  jahrgang={jahrgang}
  privatrente={privatrente}
  maxIncome={8000}
  maxRente={5000}
  onNettoeinkommenChange={setNettoeinkommen}
  onWunschrenterChange={setWunschrente}
  onJahrgangChange={setJahrgang}
  onPrivatrenterChange={setPrivatrente}
/>
```

### Option 2: Import from Standalone Component
```typescript
import { Step1Wunschrente } from '@/components/rentenrechner/Step1Wunschrente';
import { StepNav } from '@/components/rentenrechner/StepNav';
```

---

## ✨ Features Preserved

- ✅ All i18n translation keys maintained
- ✅ No breaking changes to other steps (Step 2, Step 3)
- ✅ Existing functionality intact
- ✅ Type-safe TypeScript implementation
- ✅ Client-side rendering (`"use client"`)
- ✅ Smooth transitions and hover states

---

## 📋 i18n Keys NOT Modified

All existing translation keys remain unchanged:
- `rentenrechner.title`
- `rentenrechner.subtitle`
- `rentenrechner.step1`, `.step2`, `.step3`
- `rentenrechner.back`
- `rentenrechner.next`
- `rentenrechner.gapAnalysis` (Step 2)
- `rentenrechner.results` (Step 3)
- ... and all others

---

## 🎓 Component Structure

```
Step1Wunschrente (main component)
├── Title Section
├── Income Block (with +/- circles)
├── Bars Section
│   ├── Income Bar (grey, draggable)
│   ├── Wunschrente Line (red, draggable)
│   └── Statutory Pension Bar (blue)
├── Timeline
└── Sliders Section
    ├── Jahrgang Slider (red gradient)
    └── Private Rente Slider (grey gradient)
```

---

## ✅ Quality Checklist

- [x] Pixel-perfect UI reproduction
- [x] All Tailwind CSS classes
- [x] No hardcoded translations
- [x] TypeScript interfaces
- [x] Functional state management
- [x] Drag interactions working
- [x] Responsive design
- [x] Zero external dependencies
- [x] Clean, readable code
- [x] Component documentation

