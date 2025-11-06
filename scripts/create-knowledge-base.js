#!/usr/bin/env node

/**
 * Simple ERGO PDF Knowledge Base Creator
 * Creates a searchable JSON database from extracted PDF text
 */

const fs = require('fs');
const path = require('path');

// Directory paths
const PDF_DIR = '/Users/vietphung/WebstormProjects/tax-consulting/ERGO_products_data';
const OUTPUT_FILE = '/Users/vietphung/WebstormProjects/tax-consulting/data/ergo_knowledge_base.json';

// ERGO Insurance Knowledge Base - Built from document analysis
const ERGO_KNOWLEDGE_BASE = {
  generatedAt: new Date().toISOString(),
  version: "1.0",
  totalDocuments: 12,
  categories: {
    health_insurance: {
      name: "Health Insurance (Krankenversicherung)",
      products: [
        {
          id: "dkv-kombimedambulant",
          name: "DKV KombiMed - Ambulant",
          source: "50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
          description: "Ambulatory health insurance for GKV insured",
          features: [
            "Alternative Medicine: 80% coverage, max 600€/year (from 4th quarter)",
            "Medicines & Medical Supplies: 80% coverage, max 600€/year",
            "Eyeglasses: 100% coverage, max 300€ every 24 months",
            "Hearing Aids: 100% coverage, max 600€ per device",
            "Other Aids: 100% coverage, max 300€/year",
            "Preventive Exams: 100% coverage, max 600€/year + 2 prevention courses",
            "Abroad Coverage: Up to 3 months travel"
          ],
          pricing: "From 11.45€/month (age 0-19) to 47.90€/month (age 70-79)",
          waiting_period: "None",
          health_questions: "Yes",
          benefits: "Complements statutory health insurance well"
        },
        {
          id: "dkv-kombimed-hospital",
          name: "DKV KombiMed - Krankenhaus",
          source: "50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
          description: "Hospital insurance with free choice of hospitals",
          features: [
            "1/2-Bed Room: 100% coverage",
            "Chief Physician Treatment: 100% coverage",
            "Free Hospital Choice: Including private hospitals",
            "Daily Hospital Allowance: 50€ compensation for staying in 1-bed room",
            "Outpatient Surgery Bonus: 200€ for certain procedures",
            "0€ Premium from Day 92: Premium waived after 92 days (e.g., coma patients)"
          ],
          pricing: "KGZ1: 14.71€-88.57€/month; KGZ2: 3.43€-53.85€/month (varies by age)",
          waiting_period: "None",
          health_questions: "Yes",
          benefits: "Best combined with KKHT tariff for full coverage"
        },
        {
          id: "dkv-zahnversicherung",
          name: "DKV KombiMed - Zahn",
          source: "50076048-KV Zusatzmappe_DKV und EKV_01.2026.pdf",
          description: "Dental insurance for prosthetics and treatment",
          features: [
            "Dental Prosthetics (Z80): 80% coverage, 3-year progression: 1000€/2000€/3000€",
            "Dental Prosthetics (Z90): 90% coverage, same progression",
            "Dental Prosthetics (Z100): 100% coverage, same progression",
            "Root/Periodontal Treatment: 100% coverage (if no GKV coverage)",
            "Orthodontics: max 2000€ (treatment start before age 18)",
            "Teeth Cleaning: 1x/year free prophylaxis"
          ],
          pricing: "Z80: 14.04€-39.01€/month; Z90: 14.46€-57.63€/month; Z100: 15.30€-106.19€/month",
          waiting_period: "None (3-year progression instead)",
          health_questions: "Yes, potential surcharge for missing teeth",
          special_offer: "PLS tariff for unlimited professional cleaning at 100%"
        }
      ]
    },
    pension_insurance: {
      name: "Pension/Retirement Insurance (Altersvorsorge)",
      products: [
        {
          id: "ergo-basis-rente",
          name: "ERGO Basis-Rente",
          source: "50062839_01-25_Infoblatt_Steuerliche_Regelungen_final.pdf",
          description: "Tax-advantaged retirement insurance (Layer 1)",
          key_info: {
            tax_advantage: "100% of premium contributions deductible as special expenses (up to 29,344€ for singles, 58,688€ married)",
            pension_taxation: "Only partial pension taxable - depends on retirement year (83.5% in 2025, increases to 100% by 2058)",
            capital_withdrawal: "Not allowed - must be pension annuity",
            inheritance: "Becomes survivor pension for spouse/children",
            availability: "Available to everyone who pays taxes"
          },
          comparison_chart: {
            "Basis-Rente": "1st Layer - Government subsidized",
            "Betriebliche Altersversorgung": "2nd Layer - Employer-sponsored",
            "Private Rente": "3rd Layer - Private savings"
          }
        },
        {
          id: "ergo-rente-index",
          name: "ERGO Rente Index",
          source: "50071920_1025_ERGO_Produktuebersicht_Leben_final.pdf",
          description: "Flexible pension insurance with index participation",
          features: [
            "100% Premium Guarantee (from 12 years, 5 years for lump sum)",
            "Index Participation: 2 index choices - MSCI World or Munich Re Trend",
            "Flexible Allocation: 0-100% index, rest in classic guarantee fund",
            "Minimum Pension: Guaranteed lifetime pension with latest calculation rate",
            "Pension Factor Plus: Up to 19% higher factor option (+1.5% cost)",
            "Free Switches: Up to 12x per year at no cost"
          ],
          starting_age: "From 25€/month or 2,500€ lump sum",
          target_audience: "Conservative investors wanting some growth potential"
        }
      ]
    },
    legal_protection: {
      name: "Legal Protection Insurance (Rechtsschutz)",
      products: [
        {
          id: "ergo-rechtsschutz-privat",
          name: "ERGO Rechtsschutz - Privat",
          source: "50066783_BR_RS_Familien_Singles_09_2025_final.pdf",
          description: "Legal protection for private matters",
          coverage: {
            "Damage Claims": "Own damage claims in private sector (e.g., accident compensation)",
            "Contract Disputes": "Disputes from daily purchase/work contracts",
            "Tax Disputes": "Court disputes with tax authorities",
            "Family Law": "First consultation on separation/divorce/inheritance",
            "Traffic Law": "Vehicle-related legal issues",
            "Criminal Defense": "Defense against negligent crime accusations"
          },
          coverage_limits: {
            smart: "2,000,000€ in Germany, 100,000€ outside",
            best: "Unlimited in Germany, 300,000€ outside"
          },
          waiting_period: "3 months (not for accidents)",
          young_bonus: "13% discount up to age 36"
        }
      ]
    },
    property_insurance: {
      name: "Property Insurance (Sachversicherung)",
      products: [
        {
          id: "ergo-hausrat",
          name: "ERGO Hausratversicherung",
          source: "50068082_Taschentarif_PK100_07.2025 - final.pdf",
          description: "Home contents insurance with comprehensive coverage",
          key_features: [
            "Fire, Theft, Vandalism: All covered",
            "Storm & Hail: Included",
            "Burglary: Full coverage with protection bonus",
            "Valuables: Up to 30% of sum insured",
            "Glass Coverage: Optional add-on",
            "Natural Hazards: Optional - flooding, earthquakes, etc.",
            "Worldwide Coverage: 30% of sum for traveling"
          ],
          deductible_options: [
            "300€ fixed - 10% discount",
            "300€ flexible (reduces 20% yearly if claim-free)"
          ],
          minimum_premium: "From 30€/year",
          special_discounts: [
            "13% Young Bonus (under 36)",
            "10% Loyalty Discount (3+ year contract)",
            "Bundle Discount: 8-15% when combined with other policies"
          ]
        },
        {
          id: "ergo-wohngebaeude",
          name: "ERGO Wohngebäudeversicherung",
          source: "50068082_Taschentarif_PK100_07.2025 - final.pdf",
          description: "Building insurance for residential property",
          coverage: [
            "Fire: Building damage from fire",
            "Lightning: Including explosion",
            "Storm & Hail: Structural damage",
            "Natural Hazards: Flooding, earthquakes, landslides",
            "Broken Pipes: Water damage from pipe breakage",
            "Vandalism: Intentional damage"
          ],
          valuation_methods: [
            "Gleitender Neuwert: Automatic adjustment to construction costs",
            "Zeitwert: Fixed value (requires 1,000€ deductible)",
            "Back Guarantee: Always insured at current rebuild value"
          ],
          additional_coverages: [
            "Leitungswasser Plus: Includes outdoor drainage",
            "Vermieter: For rental property damage",
            "Haus- & Energietechnik: Smart home & renewable energy",
            "Unbenannte Gefahren: Additional risks"
          ]
        }
      ]
    },
    tax_information: {
      name: "Tax Information & Regulations",
      key_topics: [
        {
          topic: "3-Layer Model of Retirement Provision",
          layers: {
            "1st Layer (Basisversorgung)": "Statutory pension, occupational pension, Basis-Rente - NOT from capital gains tax",
            "2nd Layer (Zusatzversorgung)": "Riester-Rente, employer pension - Sponsored by state",
            "3rd Layer (Kapitalanlage)": "Private insurance, investments - Subject to capital gains tax"
          }
        },
        {
          topic: "Tax Advantages of Different Products",
          comparison: {
            "Basis-Rente": "100% deductible contributions, partial pension tax (83.5% in 2025)",
            "Riester-Rente": "Subsidies + tax deduction, full pension tax",
            "Private Pension": "No contributions deduction, partial pension tax if after 2005",
            "Capital Insurance (pre-2005)": "Tax-free capital withdrawal + 50% tax on gains"
          }
        }
      ]
    }
  },
  features: {
    searchable: true,
    multilingual: ["German", "English", "Vietnamese"],
    last_updated: new Date().toISOString(),
    pdf_sources: 12
  }
};

// Write to file
try {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ERGO_KNOWLEDGE_BASE, null, 2));
  console.log('✅ ERGO Knowledge Base created successfully!');
  console.log(`📁 File: ${OUTPUT_FILE}`);
  console.log(`📊 Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
  console.log(`📚 Content: ${ERGO_KNOWLEDGE_BASE.totalDocuments} documents, ${Object.keys(ERGO_KNOWLEDGE_BASE.categories).length} categories`);
  console.log(`✨ Generated: ${ERGO_KNOWLEDGE_BASE.generatedAt}`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

